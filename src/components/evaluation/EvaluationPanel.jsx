import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  FileCheck2,
  LoaderCircle,
} from "lucide-react";

import {
    getEvaluationCriteria,
    getProjectEvaluation,
    submitProjectEvaluation,
  } from "../../api/evaluationApi";
  
  import { validateEvaluation } from "../../utils/evaluationValidation";

import EvaluationCriterion from "./EvaluationCriterion";
import EvaluationSummary from "./EvaluationSummary";
import EvaluationStatus from "./EvaluationStatus";

function EvaluationPanel({
  projectId,
}) {
    const [criteria, setCriteria] = useState([]);
    const [maximumScore, setMaximumScore] =
      useState(0);
    
    const [scores, setScores] = useState({});
    const [notes, setNotes] = useState("");
    
    const [evaluation, setEvaluation] =
      useState(null);
    
    const [loading, setLoading] =
      useState(true);
    
    const [error, setError] =
      useState("");
    
    const [validationErrors, setValidationErrors] =
      useState({});
    
    const [submitLoading, setSubmitLoading] =
      useState(false);
    
    const [submitError, setSubmitError] =
      useState("");
    
    const [submitSuccess, setSubmitSuccess] =
      useState(false);
    
    async function loadEvaluation() {
      setLoading(true);
      setError("");
    
      try {
        const [
          criteriaData,
          evaluationData,
        ] = await Promise.all([
          getEvaluationCriteria(),
          getProjectEvaluation(projectId),
        ]);
    
        const receivedCriteria =
          Array.isArray(
            criteriaData?.criteria
          )
            ? criteriaData.criteria
            : [];
    
        setCriteria(
          receivedCriteria.map(
            (criterion, index) => ({
              ...criterion,
              order: index + 1,
            })
          )
        );
    
        setMaximumScore(
          Number(
            criteriaData?.maximumScore || 0
          )
        );
    
        const existingEvaluation =
          evaluationData?.evaluation || null;
    
        setEvaluation(
          existingEvaluation
        );
    
        if (existingEvaluation) {
          setScores(
            existingEvaluation.scores || {}
          );
    
          setNotes(
            existingEvaluation.notes || ""
          );
        } else {
          setScores({});
          setNotes("");
        }
      } catch (err) {
        let message =
          err?.message ||
          "Failed to submit evaluation.";
      
        if (err?.status === 409) {
          message =
            "This evaluation has already been submitted.";
        }
      
        if (err?.status === 403) {
          message =
            "You are not authorized to evaluate this project.";
        }
      
        if (err?.status === 404) {
          message =
            "The project could not be found.";
        }
      
        setSubmitError(message);
      } finally {
        setLoading(false);
      }
    }
    
    useEffect(() => {
      loadEvaluation();
    }, [projectId]);

  const totalScore = useMemo(() => {
    return criteria.reduce(
      (total, criterion) => {
        return (
          total +
          Number(
            scores[criterion.id] || 0
          )
        );
      },
      0
    );
  }, [criteria, scores]);

  const isSubmitted =
  evaluation?.status === "submitted";

  function handleScoreChange(
    criterionId,
    value
  ) {
    setScores((current) => ({
      ...current,
      [criterionId]: value,
    }));
  }
  async function handleSubmit() {
    setSubmitError("");
    setSubmitSuccess(false);
  
    const validation =
      validateEvaluation(
        criteria,
        scores,
        notes
      );
  
    setValidationErrors(
      validation.errors
    );
  
    if (!validation.valid) {
      return;
    }
  
    setSubmitLoading(true);
  
    try {
      const response =
        await submitProjectEvaluation(
          projectId,
          {
            scores: validation.scores,
            notes: notes.trim(),
          }
        );
  
      const submittedEvaluation =
        response?.evaluation;
  
      if (!submittedEvaluation) {
        throw new Error(
          "Evaluation was not returned by the server."
        );
      }
  
      setEvaluation(
        submittedEvaluation
      );
  
      setScores(
        submittedEvaluation.scores || {}
      );
  
      setNotes(
        submittedEvaluation.notes || ""
      );
  
      setSubmitSuccess(true);
      setValidationErrors({});
    } catch (err) {
      setSubmitError(
        err?.message ||
          "Failed to submit evaluation."
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-acs-border bg-acs-surface p-6 shadow-sm">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-acs-text-muted">
            <LoaderCircle
              size={28}
              className="animate-spin text-acs-purple"
            />

            <p className="text-sm">
              Loading evaluation...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-status-danger/20 bg-status-danger/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0 text-status-danger"
          />
  
          <div className="min-w-0">
            <h2 className="font-semibold text-status-danger">
              Unable to load evaluation
            </h2>
  
            <p className="mt-1 text-sm text-acs-text-muted">
              {error}
            </p>
  
            <button
              type="button"
              onClick={loadEvaluation}
              className="mt-4 rounded-xl bg-acs-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-acs-purple-light"
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (criteria.length === 0) {
    return (
      <section className="rounded-2xl border border-acs-border bg-acs-surface p-6 shadow-sm">
        <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <FileCheck2
            size={36}
            className="text-acs-text-muted"
          />

          <h2 className="mt-4 text-lg font-semibold text-acs-text">
            No Evaluation Criteria
          </h2>

          <p className="mt-1 max-w-md text-sm text-acs-text-muted">
            Evaluation criteria are not
            available yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-acs-orange/10 text-acs-orange">
            <FileCheck2 size={21} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-acs-text">
              Project Evaluation
            </h2>

            <p className="mt-0.5 text-sm text-acs-text-muted">
              Evaluate the project based on
              the provided criteria.
            </p>
          </div>
        </div>
      </div>

      <EvaluationStatus
        status={
          evaluation?.status ||
          "pending"
        }
        submittedAt={
          evaluation?.submittedAt
        }
      />

      <EvaluationSummary
        totalScore={totalScore}
        maximumScore={maximumScore}
      />

      {criteriaError && (
        <div className="rounded-xl border border-status-danger/20 bg-status-danger/5 p-4 text-sm text-status-danger">
          {criteriaError}
        </div>
      )}

      <div className="space-y-4">
        {criteria.map((criterion) => (
          <EvaluationCriterion
            key={criterion.id}
            criterion={criterion}
            value={
                scores[criterion.id] ??
                ""
            }
            error={
                validationErrors[
                criterion.id
                ]
            }
            onChange={
                handleScoreChange
            }
            disabled={isSubmitted}
            />
        ))}
      </div>

      <div className="rounded-2xl border border-acs-border bg-acs-surface p-5 shadow-sm">
        <label
          htmlFor="judge-notes"
          className="block text-sm font-semibold text-acs-text"
        >
          Judge Notes
        </label>

        <p className="mt-1 text-xs text-acs-text-muted">
          Add any relevant feedback or
          observations about the project.
        </p>

        <textarea
            id="judge-notes"
            value={notes}
            onChange={(event) =>
            setNotes(event.target.value)
            }
            rows={5}
            disabled={isSubmitted}
          placeholder="Write your evaluation notes..."
          className="mt-4 w-full resize-y rounded-xl border border-acs-border bg-acs-background px-4 py-3 text-sm text-acs-text outline-none transition placeholder:text-acs-text-muted focus:border-acs-purple focus:ring-2 focus:ring-acs-purple/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
      {submitSuccess && (
        <div className="rounded-2xl border border-status-success/20 bg-status-success/5 p-4">
            <div className="flex items-start gap-3">
            <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-status-success" />

            <div>
                <p className="text-sm font-semibold text-status-success">
                Evaluation submitted successfully.
                </p>

                <p className="mt-1 text-xs text-acs-text-muted">
                The evaluation has been saved successfully.
                </p>
            </div>
            </div>
        </div>
        )}
    {submitError && (
        <div className="rounded-2xl border border-status-danger/20 bg-status-danger/5 p-4">
            <div className="flex items-start gap-3">
            <AlertCircle
                size={19}
                className="mt-0.5 shrink-0 text-status-danger"
            />

            <div>
                <p className="text-sm font-semibold text-status-danger">
                Evaluation submission failed
                </p>

                <p className="mt-1 text-xs text-acs-text-muted">
                {submitError}
                </p>
            </div>
            </div>
        </div>
    )}
      <div className="flex justify-end">
      <button
        type="button"
        onClick={handleSubmit}
        disabled={
            submitLoading ||
            isSubmitted
        }
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-acs-purple px-5 py-3 text-sm font-semibold text-white transition hover:bg-acs-purple-light disabled:cursor-not-allowed disabled:opacity-50"
        >
        {submitLoading ? (
            <>
            <LoaderCircle
                size={17}
                className="animate-spin"
            />

            Submitting...
            </>
        ) : isSubmitted ? (
            <>
            <FileCheck2 size={17} />

            Evaluation Submitted
            </>
        ) : (
            <>
            <FileCheck2 size={17} />

            Submit Evaluation
            </>
        )}
        </button>
      </div>
    </section>
  );
}

export default EvaluationPanel;