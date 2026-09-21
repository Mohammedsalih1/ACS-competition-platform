/**
 * file.service.js — Business logic for the File & Code Viewer.
 *
 * Responsibilities:
 *   1. Verify user access to a submission's project files.
 *   2. Return the full project file tree (nested) with summary stats.
 *   3. List the immediate children of a single folder.
 *   4. Return detailed metadata for a single file (including viewability).
 *   5. Read and return the text content of a viewable source file.
 *
 * All file-system reads go through the existing ProjectStructure model and
 * extraction directory.  No direct interaction with the ZIP archive.
 */
import fs from 'fs/promises';
import path from 'path';
import ApiError from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../constants/errorCodes.js';
import ProjectStructure, {
  STRUCTURE_STATUS,
} from '../../models/projectStructure.model.js';
import { getSubmissionForViewer } from '../submissions/submission.service.js';
import { buildNestedTree } from '../submissions/extraction.service.js';

// ── Language map ────────────────────────────────────────────────────
// Maps file extensions to the syntax-highlighting language identifier
// the frontend code viewer should use (e.g. Prism, Highlight.js, Monaco).

const LANGUAGE_MAP = Object.freeze({
  // JavaScript / TypeScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',

  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'less',
  '.vue': 'html',
  '.svelte': 'html',

  // Data / Config
  '.json': 'json',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.ini': 'ini',
  '.env': 'plaintext',
  '.gitignore': 'plaintext',
  '.editorconfig': 'ini',
  '.eslintrc': 'json',
  '.prettierrc': 'json',
  '.babelrc': 'json',
  '.npmrc': 'ini',

  // Markup / Docs
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.txt': 'plaintext',
  '.log': 'plaintext',
  '.csv': 'plaintext',
  '.svg': 'xml',

  // Backend languages
  '.py': 'python',
  '.rb': 'ruby',
  '.php': 'php',
  '.java': 'java',
  '.kt': 'kotlin',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.dart': 'dart',
  '.r': 'r',
  '.R': 'r',
  '.lua': 'lua',
  '.pl': 'perl',

  // Shell / DevOps
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.fish': 'bash',
  '.ps1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',
  '.dockerfile': 'dockerfile',

  // Database
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',

  // Other
  '.prisma': 'prisma',
  '.proto': 'protobuf',
  '.tf': 'hcl',
  '.makefile': 'makefile',
});

// Basename overrides — files with no extension but a recognised name.
const BASENAME_MAP = Object.freeze({
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  Rakefile: 'ruby',
  Gemfile: 'ruby',
  Procfile: 'yaml',
  LICENSE: 'plaintext',
  README: 'markdown',
});

/**
 * Text-based file types that we will attempt to read and display.
 * Everything NOT in this set is treated as binary.
 */
const TEXT_FILE_TYPES = new Set([
  'html', 'css', 'javascript', 'typescript', 'json', 'xml', 'svg',
  'markdown', 'text', 'config', 'python', 'ruby', 'php', 'java',
  'go', 'rust', 'c', 'cpp', 'header', 'csharp', 'sql', 'csv',
  'other', // we try to read "other" and fall back if binary
]);

const MAX_READABLE_SIZE = 1 * 1024 * 1024; // 1 MB

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Resolve the highlight language for a given file entry.
 */
function resolveLanguage(entry) {
  // Try extension first
  if (entry.extension && LANGUAGE_MAP[entry.extension]) {
    return LANGUAGE_MAP[entry.extension];
  }
  // Try basename (Dockerfile, Makefile, …)
  if (BASENAME_MAP[entry.name]) {
    return BASENAME_MAP[entry.name];
  }
  // Known text type → plaintext fallback
  if (TEXT_FILE_TYPES.has(entry.fileType)) {
    return 'plaintext';
  }
  return null;
}

/**
 * Determine whether a file can be displayed in the code viewer.
 */
function isViewable(entry) {
  if (entry.size > MAX_READABLE_SIZE) return false;
  return TEXT_FILE_TYPES.has(entry.fileType);
}

/**
 * Load and validate the ProjectStructure for a submission.
 * Throws if not found or not yet extracted.
 */
async function loadStructure(submissionId) {
  const structure = await ProjectStructure.findOne({
    submission: submissionId,
  });

  if (!structure) {
    throw ApiError.notFound(
      'Project structure not found. Upload a ZIP first.',
      ERROR_CODES.PROJECT_NOT_EXTRACTED,
    );
  }

  if (structure.status !== STRUCTURE_STATUS.EXTRACTED) {
    throw ApiError.badRequest(
      'Project has not been extracted yet',
      ERROR_CODES.PROJECT_NOT_EXTRACTED,
    );
  }

  return structure;
}

/**
 * Count how many lines a text content string has.
 */
function countLines(content) {
  if (!content) return 0;
  // Count newline characters + 1 (last line may not end with \n)
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') count++;
  }
  return count;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * 1. Get Project Files — full overview with nested tree.
 */
export async function getProjectFiles(submissionId, user) {
  // Access check
  await getSubmissionForViewer(submissionId, user);
  const structure = await loadStructure(submissionId);

  const nestedTree = buildNestedTree(structure.tree);

  // Enrich tree nodes with language info
  const enrichTree = (nodes) =>
    nodes.map((node) => {
      const enriched = { ...node };
      if (node.type === 'file') {
        enriched.language = resolveLanguage(node);
        enriched.isViewable = isViewable(node);
      }
      if (node.children) {
        enriched.children = enrichTree(node.children);
      }
      return enriched;
    });

  return {
    submissionId,
    summary: {
      totalFiles: structure.totalFiles,
      totalFolders: structure.totalFolders,
      totalSize: structure.totalSize,
      status: structure.status,
    },
    tree: enrichTree(nestedTree),
  };
}

/**
 * 2. Get Folder Contents — immediate children of a directory path.
 *
 * @param {string} submissionId
 * @param {string} folderPath  Relative path (empty string = root)
 * @param {object} user        req.user
 */
export async function getFolderContents(submissionId, folderPath, user) {
  await getSubmissionForViewer(submissionId, user);
  const structure = await loadStructure(submissionId);

  // Determine the target depth.
  // Root ("") → children are at depth 0
  // "src"     → children are at depth 1
  const normalizedPath = folderPath.replace(/\/+$/, ''); // strip trailing slash
  const targetDepth = normalizedPath === '' ? 0 : normalizedPath.split('/').length;

  // If a non-root path was requested, make sure the folder actually exists.
  if (normalizedPath !== '') {
    const folderExists = structure.tree.some(
      (e) => e.path === normalizedPath && e.type === 'directory',
    );
    if (!folderExists) {
      throw ApiError.notFound(
        `Folder "${normalizedPath}" not found in project`,
        ERROR_CODES.FOLDER_NOT_FOUND,
      );
    }
  }

  // Filter: entries whose parent path matches AND whose depth is exactly
  // targetDepth (immediate children only, no recursion).
  const entries = structure.tree
    .filter((e) => {
      if (e.depth !== targetDepth) return false;
      if (normalizedPath === '') return e.depth === 0;
      return e.path.startsWith(normalizedPath + '/');
    })
    .map((e) => {
      const entry = {
        name: e.name,
        path: e.path,
        type: e.type,
      };
      if (e.type === 'file') {
        entry.size = e.size;
        entry.extension = e.extension;
        entry.fileType = e.fileType;
        entry.language = resolveLanguage(e);
        entry.isViewable = isViewable(e);
      } else {
        // Count immediate children of this directory
        const dirPath = e.path;
        entry.childCount = structure.tree.filter(
          (c) => c.depth === e.depth + 1 && c.path.startsWith(dirPath + '/'),
        ).length;
      }
      return entry;
    });

  return {
    path: normalizedPath || '/',
    entries,
  };
}

/**
 * 3. Get File Information — detailed metadata for a single file.
 */
export async function getFileInfo(submissionId, filePath, user) {
  await getSubmissionForViewer(submissionId, user);
  const structure = await loadStructure(submissionId);

  const entry = structure.tree.find(
    (e) => e.path === filePath && e.type === 'file',
  );
  if (!entry) {
    throw ApiError.notFound(
      'File not found in project structure',
      ERROR_CODES.FILE_NOT_FOUND_IN_PROJECT,
    );
  }

  const language = resolveLanguage(entry);
  const viewable = isViewable(entry);

  const info = {
    path: entry.path,
    name: entry.name,
    size: entry.size,
    extension: entry.extension,
    fileType: entry.fileType,
    language,
    isViewable: viewable,
  };

  // If the file is viewable, try to get a line count from disk
  if (viewable) {
    try {
      const absolutePath = path.join(structure.rootPath, filePath);
      const resolved = path.resolve(absolutePath);
      if (resolved.startsWith(path.resolve(structure.rootPath))) {
        const content = await fs.readFile(absolutePath, 'utf-8');
        info.lineCount = countLines(content);
        info.encoding = 'utf-8';
      }
    } catch {
      // If we can't read, just omit lineCount — not critical.
    }
  }

  if (!viewable) {
    info.notice =
      entry.size > MAX_READABLE_SIZE
        ? 'File too large to preview'
        : 'Binary file — preview not available';
    info.noticeCode =
      entry.size > MAX_READABLE_SIZE
        ? ERROR_CODES.FILE_TOO_LARGE_TO_PREVIEW
        : ERROR_CODES.BINARY_FILE;
  }

  return info;
}

/**
 * 4. Get File Content — reads the source file for the code viewer.
 */
export async function getFileContent(submissionId, filePath, user) {
  await getSubmissionForViewer(submissionId, user);
  const structure = await loadStructure(submissionId);

  const entry = structure.tree.find(
    (e) => e.path === filePath && e.type === 'file',
  );
  if (!entry) {
    throw ApiError.notFound(
      'File not found in project structure',
      ERROR_CODES.FILE_NOT_FOUND_IN_PROJECT,
    );
  }

  const language = resolveLanguage(entry);
  const viewable = isViewable(entry);

  const metadata = {
    path: entry.path,
    name: entry.name,
    size: entry.size,
    extension: entry.extension,
    fileType: entry.fileType,
    language,
  };

  // Binary or oversized → metadata only
  if (!viewable) {
    return {
      metadata,
      content: null,
      notice:
        entry.size > MAX_READABLE_SIZE
          ? 'File too large to preview'
          : 'Binary file — preview not available',
      noticeCode:
        entry.size > MAX_READABLE_SIZE
          ? ERROR_CODES.FILE_TOO_LARGE_TO_PREVIEW
          : ERROR_CODES.BINARY_FILE,
    };
  }

  // Resolve and secure the absolute path
  const absolutePath = path.join(structure.rootPath, filePath);
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(path.resolve(structure.rootPath))) {
    throw new ApiError(
      400,
      ERROR_CODES.PATH_TRAVERSAL_DETECTED,
      'Invalid file path',
    );
  }

  // Verify the file exists on disk
  try {
    await fs.access(absolutePath);
  } catch {
    throw ApiError.notFound('File not found on disk');
  }

  const content = await fs.readFile(absolutePath, 'utf-8');
  metadata.lineCount = countLines(content);

  return { metadata, content };
}
