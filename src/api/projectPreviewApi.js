import apiClient from "./apiClient";
import mockProject from "../data/mockProject";

const USE_MOCK_API =
  import.meta.env.VITE_USE_MOCK_API === "true";

/**
 * Get project information
 *
 * GET /api/projects/:projectId
 */
export async function getProject(projectId) {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  if (USE_MOCK_API) {
    await mockDelay();

    if (projectId !== mockProject.id) {
      const error = new Error("Project not found.");
      error.status = 404;
      throw error;
    }

    return mockProject;
  }

  return apiClient(`/api/projects/${projectId}`);
}

/**
 * Get project file structure
 *
 * GET /api/projects/:projectId/files
 */
export async function getProjectFiles(projectId) {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  if (USE_MOCK_API) {
    await mockDelay();

    if (projectId !== mockProject.id) {
      const error = new Error("Project not found.");
      error.status = 404;
      throw error;
    }

    return {
      files: mockProject.files || [],
    };
  }

  return apiClient(`/api/projects/${projectId}/files`);
}

/**
 * Get file content
 *
 * GET /api/projects/:projectId/files/content?path=...
 */
export async function getFileContent(
  projectId,
  filePath
) {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  if (!filePath) {
    throw new Error("File path is required.");
  }

  if (USE_MOCK_API) {
    await mockDelay();

    const file = findFile(
      mockProject.files || [],
      filePath
    );

    if (!file) {
      const error = new Error(
        "File content not found."
      );

      error.status = 404;

      throw error;
    }

    return {
      path: file.path,
      content: file.content || "",
    };
  }

  const encodedPath =
    encodeURIComponent(filePath);

  return apiClient(
    `/api/projects/${projectId}/files/content?path=${encodedPath}`
  );
}

/**
 * Simulate network latency during development.
 */
function mockDelay() {
  return new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
}

/**
 * Find a file recursively.
 */
function findFile(items, filePath) {
  for (const item of items) {
    if (
      item.type === "file" &&
      item.path === filePath
    ) {
      return item;
    }

    if (
      item.type === "folder" &&
      item.children?.length
    ) {
      const result = findFile(
        item.children,
        filePath
      );

      if (result) {
        return result;
      }
    }
  }

  return null;
}