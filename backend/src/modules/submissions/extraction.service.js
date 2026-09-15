/**
 * extraction.service.js — ZIP extraction & project file-tree processing.
 *
 * Responsibilities:
 *   1. Extract a validated ZIP into a per-submission directory.
 *   2. Guard against path-traversal, zip-bombs, and OS junk.
 *   3. Build a flat file-tree array and persist it as a ProjectStructure.
 *   4. Serve nested tree and individual file content to the frontend.
 */
import AdmZip from "adm-zip";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import ApiError from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";
import ProjectStructure, {
  STRUCTURE_STATUS,
} from "../../models/projectStructure.model.js";
import { UPLOAD_STATUS } from "../../models/file.model.js";
import {
  SUBMISSIONS_DIR,
  EXTRACTED_DIR_NAME,
  MAX_EXTRACTED_SIZE,
  MAX_FILE_COUNT,
  IGNORED_PATTERNS,
} from "../../config/storage.config.js";

// File-type classification map
const EXTENSION_MAP = {
  // Web
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".json": "json",
  ".xml": "xml",
  ".svg": "svg",

  // Images
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".ico": "image",
  ".bmp": "image",

  // Fonts
  ".woff": "font",
  ".woff2": "font",
  ".ttf": "font",
  ".otf": "font",
  ".eot": "font",

  // Documents
  ".md": "markdown",
  ".txt": "text",
  ".pdf": "pdf",
  ".csv": "csv",

  // Config
  ".yml": "config",
  ".yaml": "config",
  ".toml": "config",
  ".ini": "config",
  ".env": "config",
  ".gitignore": "config",
  ".editorconfig": "config",
  ".eslintrc": "config",
  ".prettierrc": "config",
  ".babelrc": "config",

  // Backend
  ".py": "python",
  ".rb": "ruby",
  ".php": "php",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "header",
  ".cs": "csharp",

  // Data
  ".sql": "sql",
  ".db": "database",
  ".sqlite": "database",

  // Media
  ".mp3": "audio",
  ".wav": "audio",
  ".mp4": "video",
  ".webm": "video",

  // Archives (nested)
  ".zip": "archive",
  ".tar": "archive",
  ".gz": "archive",
  ".rar": "archive",
};

/**
 * Classify a file extension into a human-readable type.
 * @param {string} ext  e.g. ".js"
 * @returns {string}
 */
function classifyFileType(ext) {
  if (!ext) return "unknown";
  return EXTENSION_MAP[ext.toLowerCase()] || "other";
}

// Security helpers

/**
 * Returns true when the entry name contains a path-traversal attempt.
 */
function isPathTraversal(entryName) {
  const normalized = entryName.replace(/\\/g, "/");
  if (path.isAbsolute(normalized)) return true;
  const segments = normalized.split("/");
  return segments.some((s) => s === "..");
}

/**
 * Returns true when any segment of the entry path matches an ignored pattern.
 */
function isIgnored(entryName) {
  const segments = entryName.replace(/\\/g, "/").split("/");
  return segments.some((seg) =>
    IGNORED_PATTERNS.some(
      (pattern) => seg === pattern || seg.startsWith(pattern + "/"),
    ),
  );
}

// Core extraction logic

/**
 * Extract a ZIP file into `storage/submissions/<submissionId>/extracted/`.
 *
 * @param {import('../../models/file.model.js').default} file   Mongoose File doc
 * @param {import('../../models/submission.model.js').default} submission
 * @returns {Promise<import('../../models/projectStructure.model.js').default>}
 */
export async function extractAndProcess(file, submission) {
  const submissionDir = path.join(SUBMISSIONS_DIR, String(submission._id));
  const extractDir = path.join(submissionDir, EXTRACTED_DIR_NAME);

  // Remove old extraction if re-uploading
  await fs.rm(extractDir, { recursive: true, force: true });

  // Delete previous ProjectStructure for this submission (re-upload scenario)
  await ProjectStructure.deleteMany({ submission: submission._id });

  // Create a pending structure record
  const structure = await ProjectStructure.create({
    submission: submission._id,
    file: file._id,
    rootPath: extractDir,
    status: STRUCTURE_STATUS.PENDING,
  });

  try {
    // Resolve storagePath — the field is `select: false` so it may already be
    // loaded (from uploadZipForSubmission) or we need to re-query.
    const zipPath = file.storagePath;
    if (!zipPath) {
      throw ApiError.internal("File storage path is missing");
    }

    // Open ZIP & validate entries
    let zip;
    try {
      zip = new AdmZip(zipPath);
    } catch {
      throw ApiError.badRequest(
        "Corrupt or unreadable ZIP archive",
        ERROR_CODES.CORRUPT_ARCHIVE,
      );
    }

    const entries = zip.getEntries();
    if (!entries || entries.length === 0) {
      throw ApiError.badRequest(
        "ZIP archive is empty",
        ERROR_CODES.EMPTY_PROJECT,
      );
    }

    // Security: scan all entries before extracting anything
    let totalUncompressedSize = 0;
    let fileCount = 0;

    for (const entry of entries) {
      if (isPathTraversal(entry.entryName)) {
        throw new ApiError(
          400,
          ERROR_CODES.PATH_TRAVERSAL_DETECTED,
          `Blocked path-traversal attempt in entry: ${entry.entryName}`,
        );
      }

      if (!entry.isDirectory) {
        totalUncompressedSize += entry.header.size;
        fileCount++;
      }

      if (totalUncompressedSize > MAX_EXTRACTED_SIZE) {
        throw new ApiError(
          400,
          ERROR_CODES.FILE_LIMIT_EXCEEDED,
          `Extracted size exceeds ${MAX_EXTRACTED_SIZE / (1024 * 1024)} MB limit`,
        );
      }

      if (fileCount > MAX_FILE_COUNT) {
        throw new ApiError(
          400,
          ERROR_CODES.FILE_LIMIT_EXCEEDED,
          `Archive contains more than ${MAX_FILE_COUNT} files`,
        );
      }
    }

    // Extract entry by entry
    await fs.mkdir(extractDir, { recursive: true });

    for (const entry of entries) {
      if (isIgnored(entry.entryName)) continue;

      const targetPath = path.join(extractDir, entry.entryName);

      // Double-check resolved path stays within extractDir
      const resolved = path.resolve(targetPath);
      if (!resolved.startsWith(path.resolve(extractDir))) {
        throw new ApiError(
          400,
          ERROR_CODES.PATH_TRAVERSAL_DETECTED,
          "Resolved path escapes extraction directory",
        );
      }

      if (entry.isDirectory) {
        await fs.mkdir(targetPath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, entry.getData());
      }
    }

    // Handle single root folder
    // If the ZIP contains a single top-level directory and nothing else,
    // hoist its contents up one level so the tree isn't wrapped in a
    // redundant folder (common with GitHub-downloaded ZIPs).
    await hoistSingleRootFolder(extractDir);

    // Build file tree
    const tree = await buildFileTree(extractDir, extractDir);

    const totalFiles = tree.filter((e) => e.type === "file").length;
    const totalFolders = tree.filter((e) => e.type === "directory").length;
    const totalSize = tree.reduce(
      (sum, e) => sum + (e.type === "file" ? e.size : 0),
      0,
    );

    if (totalFiles === 0) {
      throw ApiError.badRequest(
        "Project contains no files after extraction",
        ERROR_CODES.EMPTY_PROJECT,
      );
    }

    // Persist tree to DB
    structure.tree = tree;
    structure.totalFiles = totalFiles;
    structure.totalFolders = totalFolders;
    structure.totalSize = totalSize;
    structure.status = STRUCTURE_STATUS.EXTRACTED;
    await structure.save();

    // Mark the File record as extracted
    file.extractedPath = extractDir;
    file.status = UPLOAD_STATUS.EXTRACTED;
    await file.save();

    return structure;
  } catch (error) {
    // Mark structure as failed but keep the record for visibility
    structure.status = STRUCTURE_STATUS.FAILED;
    structure.error =
      error instanceof ApiError ? error.message : "Extraction failed";
    await structure.save().catch(() => {});

    // Clean up partial extraction
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});

    if (error instanceof ApiError) throw error;
    throw new ApiError(
      500,
      ERROR_CODES.EXTRACTION_FAILED,
      "Failed to extract project files",
    );
  }
}

// File tree builder

/**
 * Recursively walks `dir` and returns a flat, sorted list of tree entries.
 * Directories come first at each level, then files — both sorted
 * alphabetically.
 *
 * @param {string} dir       Current directory to scan
 * @param {string} rootDir   The extraction root (for relative-path calculation)
 * @returns {Promise<Array>}
 */
async function buildFileTree(dir, rootDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];

  // Separate and sort
  const dirs = entries
    .filter((e) => e.isDirectory() && !isIgnoredFileName(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = entries
    .filter((e) => e.isFile() && !isIgnoredFileName(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Process directories first
  for (const d of dirs) {
    const fullPath = path.join(dir, d.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
    const depth = relPath.split("/").length - 1;

    result.push({
      path: relPath,
      name: d.name,
      type: "directory",
      size: 0,
      extension: null,
      fileType: null,
      depth,
    });

    // Recurse
    const children = await buildFileTree(fullPath, rootDir);
    result.push(...children);
  }

  // Then files
  for (const f of files) {
    const fullPath = path.join(dir, f.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
    const depth = relPath.split("/").length - 1;
    const stats = await fs.stat(fullPath);
    const ext = path.extname(f.name).toLowerCase() || null;

    result.push({
      path: relPath,
      name: f.name,
      type: "file",
      size: stats.size,
      extension: ext,
      fileType: classifyFileType(ext),
      depth,
    });
  }

  return result;
}

/**
 * Check if a single filename should be skipped (OS junk that survived extraction).
 */
function isIgnoredFileName(name) {
  return IGNORED_PATTERNS.includes(name);
}

/**
 * If the extraction root contains exactly one subdirectory (and nothing else),
 * move its children up.  GitHub ZIP downloads always wrap the repo in a
 * `<repo>-<branch>/` folder — this normalises that.
 */
async function hoistSingleRootFolder(extractDir) {
  const children = await fs.readdir(extractDir, { withFileTypes: true });

  if (children.length !== 1 || !children[0].isDirectory()) return;

  const singleDir = path.join(extractDir, children[0].name);
  const innerChildren = await fs.readdir(singleDir);

  for (const child of innerChildren) {
    const src = path.join(singleDir, child);
    const dest = path.join(extractDir, child);
    await fs.rename(src, dest);
  }

  await fs.rmdir(singleDir);
}

// Query helpers

/**
 * Returns the ProjectStructure for a submission (flat tree).
 */
export async function getProjectStructure(submissionId) {
  const structure = await ProjectStructure.findOne({
    submission: submissionId,
  });
  if (!structure) {
    throw ApiError.notFound("Project structure not found. Upload a ZIP first.");
  }
  return structure;
}

/**
 * Convert the flat tree into a nested hierarchy for the frontend.
 *
 * @param {Array} flatTree  The `.tree` array from ProjectStructure
 * @returns {Array}         Nested tree with `children` arrays
 */
export function buildNestedTree(flatTree) {
  const root = [];
  const map = new Map();

  for (const entry of flatTree) {
    const node = { ...entry, children: entry.type === "directory" ? [] : undefined };
    map.set(entry.path, node);

    const parentPath = entry.path.includes("/")
      ? entry.path.substring(0, entry.path.lastIndexOf("/"))
      : null;

    if (parentPath && map.has(parentPath)) {
      map.get(parentPath).children.push(node);
    } else {
      root.push(node);
    }
  }

  return root;
}

/**
 * Read the content of a single file inside the extracted project.
 * Only serves text files up to 1 MB — binary or oversized files
 * return metadata only.
 *
 * @param {string} submissionId
 * @param {string} filePath   Relative path within the extracted project
 * @returns {Promise<{ content: string|null, metadata: object }>}
 */
export async function getFileContent(submissionId, filePath) {
  const structure = await getProjectStructure(submissionId);

  if (structure.status !== STRUCTURE_STATUS.EXTRACTED) {
    throw ApiError.badRequest("Project has not been extracted yet");
  }

  // Validate the requested path exists in the tree
  const entry = structure.tree.find(
    (e) => e.path === filePath && e.type === "file",
  );
  if (!entry) {
    throw ApiError.notFound("File not found in project structure");
  }

  const absolutePath = path.join(structure.rootPath, filePath);

  // Security: ensure resolved path stays within rootPath
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(path.resolve(structure.rootPath))) {
    throw new ApiError(
      400,
      ERROR_CODES.PATH_TRAVERSAL_DETECTED,
      "Invalid file path",
    );
  }

  // Check file exists on disk
  try {
    await fs.access(absolutePath);
  } catch {
    throw ApiError.notFound("File not found on disk");
  }

  const MAX_READABLE_SIZE = 1 * 1024 * 1024; // 1 MB
  const textTypes = [
    "html", "css", "javascript", "typescript", "json", "xml",
    "markdown", "text", "config", "python", "ruby", "php",
    "java", "go", "rust", "c", "cpp", "header", "csharp",
    "sql", "svg",
  ];

  const metadata = {
    path: entry.path,
    name: entry.name,
    size: entry.size,
    extension: entry.extension,
    fileType: entry.fileType,
  };

  // Only serve text content for known text types under size limit
  if (textTypes.includes(entry.fileType) && entry.size <= MAX_READABLE_SIZE) {
    const content = await fs.readFile(absolutePath, "utf-8");
    return { content, metadata };
  }

  return {
    content: null,
    metadata: {
      ...metadata,
      notice:
        entry.size > MAX_READABLE_SIZE
          ? "File too large to preview"
          : "Binary file — preview not available",
    },
  };
}
