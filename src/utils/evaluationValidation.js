export function validateEvaluation(
    criteria,
    scores,
    notes
  ) {
    const errors = {};
    const normalizedScores = {};
  
    if (!Array.isArray(criteria) || criteria.length === 0) {
      return {
        valid: false,
        errors: {
          form: "No evaluation criteria are available.",
        },
        scores: {},
      };
    }
  
    for (const criterion of criteria) {
      const rawValue = scores?.[criterion.id];
  
      // Empty score
      if (
        rawValue === undefined ||
        rawValue === null ||
        String(rawValue).trim() === ""
      ) {
        errors[criterion.id] =
          "Score is required.";
        continue;
      }
  
      const value = Number(rawValue);
  
      // Invalid number
      if (!Number.isFinite(value)) {
        errors[criterion.id] =
          "Score must be a valid number.";
        continue;
      }
  
      // Negative score
      if (value < 0) {
        errors[criterion.id] =
          "Score cannot be negative.";
        continue;
      }
  
      // Exceeds maximum
      if (value > Number(criterion.maxScore)) {
        errors[criterion.id] =
          `Score cannot exceed ${criterion.maxScore}.`;
        continue;
      }
  
      normalizedScores[criterion.id] =
        value;
    }
  
    return {
      valid: Object.keys(errors).length === 0,
      errors,
      scores: normalizedScores,
    };
  }