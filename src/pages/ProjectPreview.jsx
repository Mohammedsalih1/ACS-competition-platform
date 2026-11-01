import EvaluationPanel from "../components/evaluation/EvaluationPanel";
import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import acsLogo from "../assets/acs-logo.png"

import {
  getProject,
  getProjectFiles,
  getFileContent,
} from "../api/projectPreviewApi";

import LivePreview from "../components/project-preview/LivePreview";
import FileExplorer from "../components/project-preview/FileExplorer";
import CodeViewer from "../components/project-preview/CodeViewer";

import { getFileLanguage, isSupportedCodeFile } from "../utils/getFileLanguage";

function ProjectPreview() {
  const { projectId } = useParams();

  // -----------------------------
  // Project state
  // -----------------------------
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(null);

  // -----------------------------
  // Files state
  // -----------------------------
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);

  // -----------------------------
  // File content state
  // -----------------------------
  const [fileContent, setFileContent] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");

  // -----------------------------
  // Code viewer state
  // -----------------------------
  const [isCodeFullscreen, setIsCodeFullscreen] =
    useState(false);

  // =========================================================
  // Load Project
  // =========================================================

  useEffect(() => {
    let isMounted = true;

    async function loadProject() {
      try {
        setLoading(true);
        setError("");
        setErrorStatus(null);

        const data = await getProject(projectId);

        if (isMounted) {
          setProject(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.message || "Unable to load project."
          );
          setErrorStatus(err.status || null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // =========================================================
  // Load Project Files
  // =========================================================

  useEffect(() => {
    let isMounted = true;

    async function loadFiles() {
      try {
        setFilesLoading(true);
        setFilesError("");

        const data = await getProjectFiles(projectId);

        if (isMounted) {
          // API response:
          // { files: [...] }
          const projectFiles = Array.isArray(data?.files)
            ? data.files
            : [];

          setFiles(projectFiles);

          const firstFile =
            findFirstFile(projectFiles);

          setSelectedFile(firstFile);
        }
      } catch (err) {
        if (isMounted) {
          setFilesError(
            err.message ||
              "Unable to load project files."
          );
        }
      } finally {
        if (isMounted) {
          setFilesLoading(false);
        }
      }
    }

    loadFiles();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // =========================================================
  // Load Selected File Content
  // =========================================================

  useEffect(() => {
    if (!selectedFile) {
      setFileContent("");
      setContentError("");
      setContentLoading(false);
      return;
    }

    let isMounted = true;

    async function loadFileContent() {
      try {
        setContentLoading(true);
        setContentError("");
        setFileContent("");

        const data = await getFileContent(
          projectId,
          selectedFile
        );

        if (isMounted) {
          setFileContent(data.content || "");
        }
      } catch (err) {
        if (isMounted) {
          setContentError(
            err.message ||
              "Unable to load file content."
          );
        }
      } finally {
        if (isMounted) {
          setContentLoading(false);
        }
      }
    }

    loadFileContent();

    return () => {
      isMounted = false;
    };
  }, [projectId, selectedFile]);

  // =========================================================
  // Loading / Error states
  // =========================================================

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        status={errorStatus}
      />
    );
  }
  
  if (!project) {
    return (
      <ErrorState
        message="Project not found."
        status={404}
      />
    );
  }

  // =========================================================
  // Selected File
  // =========================================================

  const selectedFileData = findFile(
    files,
    selectedFile
  );

  const selectedFileForViewer =
  selectedFileData
    ? {
        ...selectedFileData,
        language: getFileLanguage(
          selectedFileData.name
        ),
        isSupported: isSupportedCodeFile(
          selectedFileData.name
        ),
      }
    : null;

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-acs-background text-acs-text">
      {/* Header */}
      <header className="border-b border-acs-border bg-acs-purple">
        <div className="mx-auto flex min-h-20 max-w-[1800px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
          <div className="min-w-0 flex items-center gap-2 justify-between">

            <img
            src={acsLogo}
            alt="ACS National Competition"
            className="h-auto w-full py-2 max-w-[170px] object-contain"
          />

          </div> 

          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-xl cursor-pointer bg-acs-orange px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-acs-orange-dark sm:px-4 sm:text-sm"
            >
              Open Live Project
            </a>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-8">
        {/* Project Information */}
        <section className="rounded-2xl border border-acs-border bg-acs-surface p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-acs-orange">
              Review Workspace
            </p>

            <h2 className="text-2xl font-bold text-acs-purple">
              {project.name}
            </h2>

            <p className="max-w-3xl text-sm leading-6 text-acs-text-muted">
              {project.description}
            </p>

            <div className="mt-2 text-sm text-acs-text-muted">
              Submitted by{" "}
              <span className="font-semibold text-acs-text">
                {project.contestant?.name ||
                  "Unknown Contestant"}
              </span>
            </div>
          </div>
        </section>

        {/* Live Preview */}
        <section className="mt-6">
          <LivePreview
            url={project.liveUrl}
            projectName={project.name}
          />
        </section>

        {/* Source Code Workspace */}
        <section className="mt-6">
          <div className="grid min-h-[650px] gap-4 sm:gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
            {/* File Explorer */}
            {filesLoading ? (
              <FileExplorerSkeleton />
            ) : filesError ? (
              <FileExplorerError
                message={filesError}
              />
            ) : files.length === 0 ? (
              <EmptyFilesState />
            ) : (
              <FileExplorer
                files={files}
                selectedFile={selectedFile}
                onFileSelect={(file) =>
                  setSelectedFile(file.path)
                }
              />
            )}

            {/* Code Viewer */}
            {contentError ? (
              <CodeContentError
                message={contentError}
              />
            ) : (
              <CodeViewer
                file={selectedFileForViewer}
                content={fileContent}
                loading={contentLoading}
                isFullscreen={isCodeFullscreen}
                onToggleFullscreen={() =>
                  setIsCodeFullscreen(
                    (current) => !current
                  )
                }
              />
            )}
          </div>
        </section>
        <section className="mt-6">
          <EvaluationPanel
            projectId={projectId}
          />
        </section>
      </main>
    </div>
  );
}

// =========================================================
// Loading State
// =========================================================

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-acs-background p-6">
      <div className="flex items-center gap-3 rounded-2xl border border-acs-border bg-acs-surface px-6 py-4 shadow-sm">
        <LoaderCircle
          size={20}
          className="animate-spin text-acs-orange"
        />

        <span className="text-sm font-medium text-acs-text">
          Loading project...
        </span>
      </div>
    </div>
  );
}

// =========================================================
// Project Error State
// =========================================================

function ErrorState({ message, status }) {
  const isNotFound = status === 404;

  return (
    <div className="flex min-h-screen items-center justify-center bg-acs-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-acs-border bg-acs-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-acs-purple/10 text-2xl font-bold text-acs-purple">
          {isNotFound ? "404" : "!"}
        </div>

        <h2 className="mt-5 text-xl font-bold text-acs-purple">
          {isNotFound
            ? "Project Not Found"
            : "Unable to Load Project"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-acs-text-muted">
          {isNotFound
            ? "The project you are trying to review does not exist or is no longer available."
            : message ||
              "Something went wrong while loading the project."}
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl cursor-pointer bg-acs-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-acs-purple-light"
          >
            Try Again
          </button>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-xl cursor-pointer border border-acs-border bg-white px-4 py-2.5 text-sm font-semibold text-acs-purple transition hover:border-acs-purple/20 hover:bg-acs-purple/5"
          >
            Go Back
          </button>
        </div>

        {status && (
          <p className="mt-5 text-[11px] font-medium uppercase tracking-wider text-acs-text-muted">
            Error {status}
          </p>
        )}
      </div>
    </div>
  );
}
// =========================================================
// File Explorer Error
// =========================================================

function FileExplorerError({ message }) {
  return (
    <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-acs-border bg-acs-surface p-6 shadow-sm">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-acs-orange/10 text-acs-orange">
          <AlertCircle size={22} />
        </div>

        <h3 className="mt-4 text-sm font-bold text-acs-purple">
          Unable to Load Files
        </h3>

        <p className="mt-2 text-xs leading-5 text-acs-text-muted">
          {message}
        </p>
      </div>
    </div>
  );
}

// =========================================================
// Empty Files State
// =========================================================

function EmptyFilesState() {
  return (
    <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-acs-border bg-acs-surface p-6">
      <div className="text-center">
        <h3 className="text-sm font-bold text-acs-purple">
          No Project Files
        </h3>

        <p className="mt-2 text-xs leading-5 text-acs-text-muted">
          This project does not contain any files to
          review.
        </p>
      </div>
    </div>
  );
}

// =========================================================
// File Explorer Skeleton
// =========================================================

function FileExplorerSkeleton() {
  return (
    <div className="min-h-[500px] animate-pulse overflow-hidden rounded-2xl border border-acs-border bg-acs-surface shadow-sm">
      <div className="border-b border-acs-border p-4">
        <div className="h-9 w-32 rounded-lg bg-acs-border" />

        <div className="mt-4 h-9 w-full rounded-lg bg-acs-border" />
      </div>

      <div className="space-y-3 p-4">
        <div className="h-7 w-32 rounded bg-acs-border" />
        <div className="ml-4 h-7 w-40 rounded bg-acs-border" />
        <div className="ml-4 h-7 w-28 rounded bg-acs-border" />
        <div className="ml-8 h-7 w-36 rounded bg-acs-border" />
        <div className="h-7 w-28 rounded bg-acs-border" />
        <div className="h-7 w-36 rounded bg-acs-border" />
      </div>
    </div>
  );
}

// =========================================================
// Code Content Error
// =========================================================

function CodeContentError({ message }) {
  return (
    <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-acs-border bg-acs-surface p-6 shadow-sm">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-acs-orange/10 text-lg font-bold text-acs-orange">
          !
        </div>

        <h3 className="mt-4 text-sm font-bold text-acs-purple">
          Unable to Load Source Code
        </h3>

        <p className="mt-2 text-xs leading-5 text-acs-text-muted">
          {message}
        </p>
      </div>
    </div>
  );
}

// =========================================================
// Find First File
// =========================================================

function findFirstFile(items) {
  if (!Array.isArray(items)) {
    return null;
  }

  for (const item of items) {
    if (item.type === "file") {
      return item.path;
    }

    if (
      item.type === "folder" &&
      Array.isArray(item.children)
    ) {
      const result = findFirstFile(
        item.children
      );

      if (result) {
        return result;
      }
    }
  }

  return null;
}

// =========================================================
// Find File
// =========================================================

function findFile(items, filePath) {
  if (!Array.isArray(items) || !filePath) {
    return null;
  }

  for (const item of items) {
    if (
      item.type === "file" &&
      item.path === filePath
    ) {
      return item;
    }

    if (
      item.type === "folder" &&
      Array.isArray(item.children)
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



export default ProjectPreview;