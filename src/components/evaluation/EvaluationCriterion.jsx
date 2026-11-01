import { AlertCircle, CheckCircle2 } from "lucide-react";

function EvaluationCriterion({
  criterion,
  value,
  error,
  onChange,
  disabled = false,
}) {
  const hasValue =
    value !== undefined &&
    value !== null &&
    value !== "";

  const numericValue = Number(value);

  const isValidValue =
    hasValue &&
    Number.isFinite(numericValue) &&
    numericValue >= 0 &&
    numericValue <= criterion.maxScore;

  return (
    <div className="rounded-2xl border border-acs-border bg-acs-surface p-5 transition-colors">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-acs-purple/10 text-acs-purple">
              <span className="text-sm font-bold">
                {criterion.order || "•"}
              </span>
            </div>

            <div className="min-w-0">
              <h3 className="text-base font-semibold text-acs-text">
                {criterion.name}
              </h3>

              {criterion.description && (
                <p className="mt-1 text-sm leading-6 text-acs-text-muted">
                  {criterion.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 sm:w-32">
          <label
            htmlFor={`score-${criterion.id}`}
            className="mb-2 block text-xs font-medium text-acs-text-muted"
          >
            Score
          </label>

          <div
            className={`flex items-center overflow-hidden rounded-xl border bg-acs-background transition ${
              error
                ? "border-status-danger ring-2 ring-status-danger/10"
                : "border-acs-border focus-within:border-acs-purple focus-within:ring-2 focus-within:ring-acs-purple/10"
            }`}
          >
            <input
              id={`score-${criterion.id}`}
              type="number"
              min="0"
              max={criterion.maxScore}
              step="1"
              value={value ?? ""}
              onChange={(event) =>
                onChange(
                  criterion.id,
                  event.target.value
                )
              }
              disabled={disabled}
              placeholder="0"
              aria-invalid={Boolean(error)}
              aria-describedby={
                error
                  ? `error-${criterion.id}`
                  : undefined
              }
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-center text-sm font-semibold text-acs-text outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />

            <div className="border-l border-acs-border px-3 py-2.5 text-sm font-medium text-acs-text-muted">
              / {criterion.maxScore}
            </div>
          </div>

          {!error && isValidValue && (
            <div className="mt-1.5 flex items-center justify-end gap-1 text-xs text-status-success">
              <CheckCircle2 size={13} />
              <span>Valid</span>
            </div>
          )}

          {error && (
            <div
              id={`error-${criterion.id}`}
              className="mt-1.5 flex items-start justify-end gap-1 text-xs text-status-danger"
            >
              <AlertCircle
                size={13}
                className="mt-0.5 shrink-0"
              />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EvaluationCriterion;