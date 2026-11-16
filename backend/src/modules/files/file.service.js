/**
 * file.service.js — Business logic for the File & Code Viewer.
 */
import fs from 'fs/promises';
import ApiError from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../constants/errorCodes.js';
import ProjectStructure, {
  STRUCTURE_STATUS,
} from '../../models/projectStructure.model.js';
import Submission from '../../models/submission.model.js';
import File, { UPLOAD_STATUS } from '../../models/file.model.js';
import { getSubmissionForViewer } from '../submissions/submission.service.js';
import { buildNestedTree, extractAndProcess } from '../submissions/extraction.service.js';
import { resolveSecure, isBlockedFile } from '../../utils/securePath.js';
import { isR2Configured, downloadFileFromR2 } from '../../services/r2.service.js';
import path from 'path';
import os from 'os';

// ── Language map ────────────────────────────────────────────────────

const LANGUAGE_MAP = Object.freeze({
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.jsx': 'jsx', '.ts': 'typescript', '.tsx': 'tsx',
  '.html': 'html', '.htm': 'html', '.css': 'css',
  '.scss': 'scss', '.sass': 'scss', '.less': 'less',
  '.vue': 'html', '.svelte': 'html',
  '.json': 'json', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml', '.ini': 'ini', '.env': 'plaintext',
  '.gitignore': 'plaintext', '.editorconfig': 'ini',
  '.eslintrc': 'json', '.prettierrc': 'json', '.babelrc': 'json', '.npmrc': 'ini',
  '.md': 'markdown', '.mdx': 'markdown', '.txt': 'plaintext',
  '.log': 'plaintext', '.csv': 'plaintext', '.svg': 'xml',
  '.py': 'python', '.rb': 'ruby', '.php': 'php', '.java': 'java',
  '.kt': 'kotlin', '.go': 'go', '.rs': 'rust',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp',
  '.cs': 'csharp', '.swift': 'swift', '.dart': 'dart',
  '.r': 'r', '.R': 'r', '.lua': 'lua', '.pl': 'perl',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash', '.fish': 'bash',
  '.ps1': 'powershell', '.bat': 'batch', '.cmd': 'batch',
  '.dockerfile': 'dockerfile',
  '.sql': 'sql', '.graphql': 'graphql', '.gql': 'graphql',
  '.prisma': 'prisma', '.proto': 'protobuf', '.tf': 'hcl', '.makefile': 'makefile',
});

const BASENAME_MAP = Object.freeze({
  Dockerfile: 'dockerfile', Makefile: 'makefile', Rakefile: 'ruby',
  Gemfile: 'ruby', Procfile: 'yaml', LICENSE: 'plaintext', README: 'markdown',
});

const TEXT_FILE_TYPES = new Set([
  'html', 'css', 'javascript', 'typescript', 'json', 'xml', 'svg',
  'markdown', 'text', 'config', 'python', 'ruby', 'php', 'java',
  'go', 'rust', 'c', 'cpp', 'header', 'csharp', 'sql', 'csv',
  'other',
]);

const MAX_READABLE_SIZE = 1 * 1024 * 1024; // 1 MB

// ── Helpers ─────────────────────────────────────────────────────────

function resolveLanguage(entry) {
  if (entry.extension && LANGUAGE_MAP[entry.extension]) return LANGUAGE_MAP[entry.extension];
  if (BASENAME_MAP[entry.name]) return BASENAME_MAP[entry.name];
  if (TEXT_FILE_TYPES.has(entry.fileType)) return 'plaintext';
  return null;
}

function isViewable(entry) {
  if (entry.size > MAX_READABLE_SIZE) return false;
  return TEXT_FILE_TYPES.has(entry.fileType);
}

async function loadStructure(submissionId) {
  let structure = await ProjectStructure.findOne({ submission: submissionId });

  if (!structure || structure.status !== STRUCTURE_STATUS.EXTRACTED) {
    try {
      const file = await File.findOne({
        submission: submissionId,
        status: { $in: [UPLOAD_STATUS.UPLOADED, UPLOAD_STATUS.EXTRACTED] },
      }).select('+storagePath +storageKey +storageType');

      if (file) {
        const submission = await Submission.findById(submissionId);
        if (submission) {
          const recovered = await extractAndProcess(file, submission);
          if (recovered && recovered.status === STRUCTURE_STATUS.EXTRACTED) {
            return recovered;
          }
        }
      }
    } catch (recoverErr) {
      logger.warn(`[files] On-demand extraction recovery failed: ${recoverErr.message}`);
    }
  }

  if (!structure) {
    throw ApiError.notFound('Project structure not found. Upload a ZIP first.', ERROR_CODES.PROJECT_NOT_EXTRACTED);
  }
  if (structure.status !== STRUCTURE_STATUS.EXTRACTED) {
    throw ApiError.badRequest('Project has not been extracted yet', ERROR_CODES.PROJECT_NOT_EXTRACTED);
  }
  return structure;
}

function countLines(content) {
  if (!content) return 0;
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') count++;
  }
  return count;
}

function assertNotBlocked(filePath, submissionId) {
  const { blocked, reason } = isBlockedFile(filePath);
  if (blocked) {
    logger.warn(`[security] Blocked file access: ${filePath} (submission: ${submissionId})`);
    throw new ApiError(403, ERROR_CODES.BLOCKED_FILE_ACCESS, reason || 'Access to this file is not allowed');
  }
}

// ── Public API ──────────────────────────────────────────────────────

/** Get project files — full overview with nested tree. */
export async function getProjectFiles(submissionId, user) {
  await getSubmissionForViewer(submissionId, user);
  const structure = await loadStructure(submissionId);
  // Embedded Mongoose documents must be converted before spreading them.
  // Otherwise private document internals are serialized and public fields such
  // as name/path end up nested under _doc in the API response.
  const flatTree = structure.tree.map((entry) => entry.toObject());
  const nestedTree = buildNestedTree(flatTree);

  // Enrich tree nodes + filter blocked files
  const enrichTree = (nodes) =>
    nodes
      .filter((node) => !isBlockedFile(node.path || node.name).blocked)
      .map((node) => {
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

/** Get folder contents — immediate children of a directory path. */
export async function getFolderContents(submissionId, folderPath, user) {
  await getSubmissionForViewer(submissionId, user);
  const structure = await loadStructure(submissionId);

  const normalizedPath = folderPath.replace(/\/+$/, '');
  const targetDepth = normalizedPath === '' ? 0 : normalizedPath.split('/').length;

  if (normalizedPath !== '') {
    assertNotBlocked(normalizedPath, submissionId);

    const folderExists = structure.tree.some(
      (e) => e.path === normalizedPath && e.type === 'directory',
    );
    if (!folderExists) {
      throw ApiError.notFound(`Folder "${normalizedPath}" not found in project`, ERROR_CODES.FOLDER_NOT_FOUND);
    }
  }

  const entries = structure.tree
    .filter((e) => {
      if (e.depth !== targetDepth) return false;
      if (normalizedPath === '') {
        if (e.depth !== 0) return false;
      } else {
        if (!e.path.startsWith(normalizedPath + '/')) return false;
      }
      return !isBlockedFile(e.path).blocked;
    })
    .map((e) => {
      const entry = { name: e.name, path: e.path, type: e.type };
      if (e.type === 'file') {
        entry.size = e.size;
        entry.extension = e.extension;
        entry.fileType = e.fileType;
        entry.language = resolveLanguage(e);
        entry.isViewable = isViewable(e);
      } else {
        entry.childCount = structure.tree.filter(
          (c) => c.depth === e.depth + 1 && c.path.startsWith(e.path + '/'),
        ).length;
      }
      return entry;
    });

  return { path: normalizedPath || '/', entries };
}

/** Get file information — detailed metadata for a single file. */
export async function getFileInfo(submissionId, filePath, user) {
  await getSubmissionForViewer(submissionId, user);
  const structure = await loadStructure(submissionId);

  assertNotBlocked(filePath, submissionId);

  const entry = structure.tree.find((e) => e.path === filePath && e.type === 'file');
  if (!entry) {
    throw ApiError.notFound('File not found in project structure', ERROR_CODES.FILE_NOT_FOUND_IN_PROJECT);
  }

  const language = resolveLanguage(entry);
  const viewable = isViewable(entry);

  const info = {
    path: entry.path, name: entry.name, size: entry.size,
    extension: entry.extension, fileType: entry.fileType,
    language, isViewable: viewable,
  };

  if (viewable) {
    try {
      const resolved = resolveSecure(structure.rootPath, filePath);
      const content = await fs.readFile(resolved, 'utf-8');
      info.lineCount = countLines(content);
      info.encoding = 'utf-8';
    } catch {
      // If we can't read, just omit lineCount
    }
  }

  if (!viewable) {
    info.notice = entry.size > MAX_READABLE_SIZE
      ? 'File too large to preview'
      : 'Binary file — preview not available';
    info.noticeCode = entry.size > MAX_READABLE_SIZE
      ? ERROR_CODES.FILE_TOO_LARGE_TO_PREVIEW
      : ERROR_CODES.BINARY_FILE;
  }

  return info;
}

/** Get file content — reads the source file for the code viewer. */
export async function getFileContent(submissionId, filePath, user) {
  await getSubmissionForViewer(submissionId, user);
  const structure = await loadStructure(submissionId);

  assertNotBlocked(filePath, submissionId);

  const entry = structure.tree.find((e) => e.path === filePath && e.type === 'file');
  if (!entry) {
    throw ApiError.notFound('File not found in project structure', ERROR_CODES.FILE_NOT_FOUND_IN_PROJECT);
  }

  const language = resolveLanguage(entry);
  const viewable = isViewable(entry);
  const metadata = {
    path: entry.path, name: entry.name, size: entry.size,
    extension: entry.extension, fileType: entry.fileType, language,
  };

  if (!viewable) {
    return {
      metadata, content: null,
      notice: entry.size > MAX_READABLE_SIZE
        ? 'File too large to preview'
        : 'Binary file — preview not available',
      noticeCode: entry.size > MAX_READABLE_SIZE
        ? ERROR_CODES.FILE_TOO_LARGE_TO_PREVIEW
        : ERROR_CODES.BINARY_FILE,
    };
  }

  // Resolve storage path – if file is stored in R2, download it locally first
  let resolved = resolveSecure(structure.rootPath, filePath);
  try {
    await fs.access(resolved);
  } catch {
    // Try to re-extract if the file is missing on disk
    try {
      const zipFile = await File.findOne({ submission: submissionId }).select('+storagePath +storageKey');
      if (!zipFile) {
        throw new Error('ZIP file metadata not found');
      }
      // Ensure zip is available locally
      let zipPath = zipFile.storagePath;
      if (!zipPath && isR2Configured() && zipFile.storageKey) {
        const os = require('os');
        const tmpDir = os.tmpdir();
        const tmpPath = path.join(tmpDir, `${submissionId}-${zipFile._id}.zip`);
        await downloadFileFromR2(zipFile.storageKey, tmpPath);
        zipPath = tmpPath;
      }
      if (zipPath) {
        await extractAndProcess(zipFile, await Submission.findById(submissionId));
        // Refresh structure after extraction
        const refreshed = await ProjectStructure.findOne({ submission: submissionId });
        if (refreshed) {
          resolved = resolveSecure(refreshed.rootPath, filePath);
        }
      }
    } catch (reErr) {
      logger.warn(`[files] Re-extraction failed for ${filePath}: ${reErr.message}`);
    }
    // After attempted re-extraction, check again
    try {
      await fs.access(resolved);
    } catch {
      // If still not found, attempt R2 download of the specific file (unlikely needed)
      if (isR2Configured()) {
        // No direct R2 support for individual files; fallback to error
      }
      throw ApiError.notFound('File not found on disk', ERROR_CODES.FILE_NOT_ON_DISK);
    }
  }

  const content = await fs.readFile(resolved, 'utf-8');
  metadata.lineCount = countLines(content);

  return { metadata, content };
}
