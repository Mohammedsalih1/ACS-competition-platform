import apiClient from "./apiClient";
import {
  mockEvaluation,
  mockEvaluationCriteria,
} from "../data/mockEvaluation";

const USE_MOCK_API =
  import.meta.env.VITE_USE_MOCK_API === "true";

const MOCK_SUBMIT_ERROR =
  import.meta.env.VITE_MOCK_EVALUATION_SUBMIT_ERROR ===
  "true";

export async function getEvaluationCriteria() {
  if (USE_MOCK_API) {
    await mockDelay();

    const maximumScore =
      mockEvaluationCriteria.reduce(
        (total, criterion) =>
          total + Number(criterion.maxScore || 0),
        0
      );

    return {
      criteria: mockEvaluationCriteria,
      maximumScore,
    };
  }

  return apiClient("/api/evaluations/criteria");
}

export async function getProjectEvaluation(
  projectId
) {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  if (USE_MOCK_API) {
    await mockDelay();

    return {
      evaluation: mockEvaluation,
    };
  }

  return apiClient(
    `/api/projects/${projectId}/evaluation`
  );
}

export async function submitProjectEvaluation(
  projectId,
  evaluation
) {
  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  if (!evaluation) {
    throw new Error(
      "Evaluation data is required."
    );
  }

  if (USE_MOCK_API) {
    await mockDelay();

    if (MOCK_SUBMIT_ERROR) {
      const error = new Error(
        "Unable to save evaluation. Please try again."
      );

      error.status = 500;

      throw error;
    }

    const totalScore = Object.values(
      evaluation.scores || {}
    ).reduce(
      (total, score) =>
        total + Number(score || 0),
      0
    );

    return {
      evaluation: {
        id: "evaluation-001",
        projectId,
        scores: evaluation.scores,
        notes: evaluation.notes || "",
        totalScore,
        status: "submitted",
        submittedAt:
          new Date().toISOString(),
      },
    };
  }

  return apiClient(
    `/api/projects/${projectId}/evaluation`,
    {
      method: "POST",
      body: JSON.stringify(evaluation),
    }
  );
}

function mockDelay() {
  return new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
}