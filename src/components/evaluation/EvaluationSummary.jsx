import { Award, Target } from "lucide-react";

function EvaluationSummary({
  totalScore,
  maximumScore,
}) {
  const percentage =
    maximumScore > 0
      ? Math.round(
          (totalScore / maximumScore) * 100
        )
      : 0;

  return (
    <div className="rounded-2xl border border-acs-border bg-acs-purple p-5 text-white shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Target size={17} />
            <span>Evaluation Summary</span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {totalScore}
            </span>

            <span className="text-base text-white/60">
              / {maximumScore}
            </span>
          </div>

          <p className="mt-1 text-sm text-white/70">
            Current evaluation score
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-acs-orange/30">
            <span className="text-lg font-bold text-acs-orange-light">
              {percentage}%
            </span>
          </div>

          <div className="hidden sm:block">
            <Award
              size={30}
              className="text-acs-orange"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default EvaluationSummary;