import { useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Globe2,
} from "lucide-react";

function LivePreview({ url, projectName }) {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleLoad = () => {
    setLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setLoading(false);
    setHasError(true);
  };

  const handleRefresh = () => {
    setLoading(true);
    setHasError(false);
    setReloadKey((current) => current + 1);
  };

  if (!url) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center rounded-xl border border-acs-border bg-acs-background">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-acs-purple/10 text-acs-purple">
            <Globe2 size={24} />
          </div>

          <h3 className="mt-4 text-base font-bold text-acs-purple">
            No Live Preview Available
          </h3>

          <p className="mt-2 max-w-sm text-sm leading-6 text-acs-text-muted">
            This project does not have a live URL available for preview.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-acs-border bg-acs-surface shadow-sm">
      {/* Preview Toolbar */}
      <div className="flex min-h-16 flex-col gap-3 border-b border-acs-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-acs-purple/10 text-acs-purple">
            <Globe2 size={18} />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-acs-purple">
              Live Preview
            </p>

            <p
              className="truncate text-xs text-acs-text-muted"
              title={url}
            >
              {url}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-acs-border text-acs-text-muted transition hover:border-acs-purple/20 hover:bg-acs-purple/5 hover:text-acs-purple"
            aria-label="Refresh preview"
            title="Refresh preview"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
          </button>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-acs-orange px-3 text-xs font-semibold text-white transition hover:bg-acs-orange-dark"
          >
            <span className="hidden sm:inline">
              Open Live Project
            </span>

            <ExternalLink size={15} />
          </a>
        </div>
      </div>

      {/* Preview Area */}
      <div className="relative bg-white">
        {loading && (
          <PreviewLoading />
        )}

        {hasError ? (
          <PreviewError
            url={url}
            onRetry={handleRefresh}
          />
        ) : (
          <iframe
            key={reloadKey}
            src={url}
            title={`${projectName} live preview`}
            className={`block h-[650px] w-full border-0 transition-opacity duration-300 ${
              loading ? "opacity-0" : "opacity-100"
            }`}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </div>
    </section>
  );
}

function PreviewLoading() {
  return (
    <div className="absolute inset-0 z-10 flex h-[650px] flex-col items-center justify-center bg-acs-background">
      <div className="w-full max-w-3xl animate-pulse px-6">
        <div className="mx-auto h-5 w-32 rounded bg-acs-border" />

        <div className="mt-6 space-y-3">
          <div className="h-4 w-full rounded bg-acs-border" />
          <div className="h-4 w-5/6 rounded bg-acs-border" />
          <div className="h-4 w-4/6 rounded bg-acs-border" />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="h-32 rounded-xl bg-acs-border" />
          <div className="h-32 rounded-xl bg-acs-border" />
          <div className="h-32 rounded-xl bg-acs-border" />
        </div>
      </div>
    </div>
  );
}

function PreviewError({ url, onRetry }) {
  return (
    <div className="flex h-[650px] items-center justify-center bg-acs-background px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-acs-orange/10 text-acs-orange">
          <AlertTriangle size={24} />
        </div>

        <h3 className="mt-5 text-lg font-bold text-acs-purple">
          Preview Unavailable
        </h3>

        <p className="mt-2 text-sm leading-6 text-acs-text-muted">
          The project could not be loaded inside the preview.
          The website may block iframe access or the URL may be
          unavailable.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-acs-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-acs-purple-light"
          >
            <RefreshCw size={15} />
            Try Again
          </button>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-acs-border bg-white px-4 py-2.5 text-sm font-semibold text-acs-purple transition hover:border-acs-purple/20 hover:bg-acs-purple/5"
          >
            <ExternalLink size={15} />
            Open in New Tab
          </a>
        </div>
      </div>
    </div>
  );
}

export default LivePreview;