import Editor from "@monaco-editor/react";
import {
  Code2,
  FileCode2,
  Maximize2,
  Minimize2,
} from "lucide-react";

function CodeViewer({
  file,
  content,
  loading,
  isFullscreen,
  onToggleFullscreen,
}) {
  if (file && !file.isSupported) {
    return (
      <UnsupportedFileState
        fileName={file.name}
        filePath={file.path}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    );
  }
  if (!file) {
    return (
      <section className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-acs-border bg-acs-surface shadow-sm">
        <CodeViewerHeader
          file={null}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />

        <EmptyCodeState />
      </section>
    );
  }

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-acs-border bg-acs-surface shadow-sm ${
        isFullscreen
          ? "fixed inset-4 z-50"
          : ""
      }`}
    >
      <CodeViewerHeader
        file={file}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      <div className="relative min-h-0 flex-1 bg-[#1e1e1e]">
        {loading ? (
          <CodeLoading />
        ) : (
          <Editor
            height="100%"
            language={file.language}
            value={content || ""}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: {
                enabled: true,
              },
              fontSize: 14,
              lineNumbers: "on",
              folding: true,
              automaticLayout: true,
              wordWrap: "off",
              scrollBeyondLastLine: false,
              renderWhitespace: "selection",
              padding: {
                top: 16,
                bottom: 16,
              },
              cursorStyle: "line",
              contextmenu: true,
              smoothScrolling: true,
            }}
            loading={<CodeLoading />}
          />
        )}
      </div>
    </section>
  );
}

function CodeViewerHeader({
  file,
  isFullscreen,
  onToggleFullscreen,
}) {
  return (
    <div className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-acs-border bg-white px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-acs-purple/10 text-acs-purple">
          {file ? (
            <FileCode2 size={16} />
          ) : (
            <Code2 size={17} />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-acs-purple">
            {file ? file.name : "Source Code"}
          </p>

          {file && (
            <p
              className="truncate text-[11px] text-acs-text-muted"
              title={file.path}
            >
              {file.path}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleFullscreen}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-acs-text-muted transition hover:bg-acs-purple/5 hover:text-acs-purple"
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        aria-label={
          isFullscreen
            ? "Exit fullscreen"
            : "Open code viewer fullscreen"
        }
      >
        {isFullscreen ? (
          <Minimize2 size={16} />
        ) : (
          <Maximize2 size={16} />
        )}
      </button>
    </div>
  );
}

function EmptyCodeState() {
  return (
    <div className="flex min-h-[500px] flex-1 items-center justify-center bg-acs-background px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-acs-purple/10 text-acs-purple">
          <Code2 size={24} />
        </div>

        <h3 className="mt-5 text-base font-bold text-acs-purple">
          Select a File
        </h3>

        <p className="mt-2 text-sm leading-6 text-acs-text-muted">
          Select a file from the project explorer to view its
          source code.
        </p>
      </div>
    </div>
  );
}

function CodeLoading() {
  return (
    <div className="h-full min-h-[500px] animate-pulse bg-[#1e1e1e] p-6">
      <div className="space-y-3">
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="h-4 w-1/2 rounded bg-white/10" />
        <div className="h-4 w-5/6 rounded bg-white/10" />
        <div className="h-4 w-2/3 rounded bg-white/10" />
        <div className="h-4 w-1/3 rounded bg-white/10" />
        <div className="h-4 w-4/5 rounded bg-white/10" />
      </div>
    </div>
  );
}

function UnsupportedFileState({
  fileName,
  filePath,
  isFullscreen,
  onToggleFullscreen,
}) {
  return (
<section
  className={`flex min-h-[500px] min-w-0 flex-col overflow-hidden rounded-2xl border border-acs-border bg-acs-surface shadow-sm ${
    isFullscreen
      ? "fixed inset-2 z-50 sm:inset-4"
      : ""
  }`}
>
      <CodeViewerHeader
        file={{
          name: fileName,
          path: filePath,
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      <div className="flex flex-1 items-center justify-center bg-acs-background px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-acs-orange/10 text-acs-orange">
            <FileCode2 size={24} />
          </div>

          <h3 className="mt-5 text-base font-bold text-acs-purple">
            File Preview Not Supported
          </h3>

          <p className="mt-2 text-sm leading-6 text-acs-text-muted">
            This file type cannot be displayed in
            the source code viewer.
          </p>

          <p className="mt-4 break-all rounded-lg bg-acs-purple/5 px-3 py-2 font-mono text-xs text-acs-purple">
            {fileName}
          </p>
        </div>
      </div>
    </section>
  );
}

export default CodeViewer;