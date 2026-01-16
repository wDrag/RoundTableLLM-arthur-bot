import type { AgentOutput, RoleName, ScoredOutput } from "@/types.js";

export interface ScoreThresholds {
  hard: number;
  soft: number;
}

export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  hard: 0.45,
  soft: 0.6
};

export const computeCredibility = (confidence: number, risk: number): number =>
  confidence - 0.75 * risk;

export const scoreOutputs = (
  outputs: AgentOutput[],
  weights: Record<RoleName, number>,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
): ScoredOutput[] => {
  const scored = outputs.map((output) => {
    const credibility = computeCredibility(output.confidence, output.risk);
    const riskInvalid = output.risk >= 0.6 && output.confidence <= 0.45;
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
