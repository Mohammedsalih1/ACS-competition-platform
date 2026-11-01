import {
    CheckCircle2,
    Clock3,
  } from "lucide-react";
  
  function EvaluationStatus({
    status,
    submittedAt,
  }) {
    if (status === "submitted") {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-status-success/20 bg-status-success/5 p-4">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0 text-status-success"
          />
  
          <div>
            <p className="text-sm font-semibold text-status-success">
              Evaluation Submitted
            </p>
  
            {submittedAt && (
              <p className="mt-1 text-xs text-acs-text-muted">
                Submitted{" "}
                {new Date(
                  submittedAt
                ).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      );
    }
  
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-status-warning/20 bg-status-warning/5 p-4">
        <Clock3
          size={20}
          className="mt-0.5 shrink-0 text-status-warning"
        />
  
        <div>
          <p className="text-sm font-semibold text-status-warning">
            Evaluation Pending
          </p>
  
          <p className="mt-1 text-xs text-acs-text-muted">
            Complete the evaluation and submit
            your scores.
          </p>
        </div>
      </div>
    );
  }
  
  export default EvaluationStatus;