import type { AgentJsonOutput, AgentOutput, AxisScores, RoleName, ScoredOutput } from "@/types.js";

export interface ScoreThresholds {
  hard: number;
  soft: number;
}

export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  hard: 0.45,
  soft: 0.6
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const textQualityScore = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const uniqueCount = new Set(words.map((word) => word.toLowerCase())).size;
  const uniqueness = wordCount > 0 ? uniqueCount / wordCount : 0;
  const lengthScore = clamp01(wordCount / 120);
  const uniquenessScore = clamp01((uniqueness - 0.3) / 0.5);
  const jsonPenalty = /```|\{\s*"agent"/i.test(trimmed) ? 0.5 : 1;
  return clamp01((0.6 * lengthScore + 0.4 * uniquenessScore) * jsonPenalty);
};

export const computeCredibilityFromAxes = (axes: AxisScores, selfConfidence = 0): number => {
  const axisScore =
    (axes.coherence + axes.alignment + axes.verifiability + axes.signalDensity + axes.compliance) /
    125;
  const calibrated = 0.8 * axisScore + 0.2 * clamp01(selfConfidence);
  return clamp01(calibrated);
};

export const computeAxisScores = (output: AgentJsonOutput): AxisScores => {
  const summaryScore = Math.min(output.answerSummary.length / 3, 1);
  const assumptionsScore = Math.min(output.assumptions.length / 2, 1);
  const stepsScore = Math.min(output.stepsOrDeliverables.length / 3, 1);
  const failureScore = Math.min(output.failureModes.length / 2, 1);
  const unitsScore = Math.min(output.units.length / 3, 1);

  const reasoningQuality = textQualityScore(output.reasoning);
  const summaryQuality = textQualityScore(output.answerSummary.join(" "));

  return {
    coherence: 25 * clamp01(0.6 * summaryScore + 0.4 * summaryQuality),
    alignment: 25 * clamp01(0.6 * unitsScore + 0.4 * reasoningQuality),
    verifiability: 25 * clamp01(0.6 * assumptionsScore + 0.4 * failureScore),
    signalDensity: 25 * clamp01(0.5 * stepsScore + 0.5 * summaryScore),
    compliance: 25 * clamp01(0.6 * failureScore + 0.4 * clamp01(output.selfConfidence))
  };
};

export const scoreOutputs = (
  outputs: AgentOutput[],
  weights: Record<RoleName, number>,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
): ScoredOutput[] => {
  const scored = outputs.map((output) => {
    const credibility = output.credibility;
    const riskInvalid = false;
    let status: ScoredOutput["status"] = "VALID";
    if (riskInvalid || credibility < thresholds.hard) {
      status = "DISCARD";
    } else if (credibility < thresholds.soft) {
      status = "QUARANTINE";
    }
    return {
      ...output,
      credibility,
      status,
      weightedScore: 0
    };
  });

  const totalWeight = scored
    .filter((item) => item.status !== "DISCARD")
    .reduce((sum, item) => sum + (weights[item.role] ?? 0), 0);

  return scored.map((item) => {
    if (item.status === "DISCARD" || totalWeight === 0) {
      return { ...item, weightedScore: 0 };
    }
    const normalizedWeight = (weights[item.role] ?? 0) / totalWeight;
    return { ...item, weightedScore: item.credibility * normalizedWeight };
  });
};
