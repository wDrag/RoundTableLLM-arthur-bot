import type { MergeUnit } from "@/types.js";

export interface RenderReplyInput {
  mergedUnits: MergeUnit[];
  assumptions: string[];
  confidence: number;
  disagreements: MergeUnit[];
  unitsUsed?: string[];
  polished?: string;
  auditAppendix?: string;
}

export const renderReply = (input: RenderReplyInput): string => {
  const tldr = input.mergedUnits.slice(0, 3).map((unit) => `- ${unit.text}`);
  const main = input.polished
    ? [input.polished]
    : input.mergedUnits.map((unit) => `- ${unit.text}`);
  const assumptionsList =
    input.assumptions.length > 0 ? input.assumptions : ["No assumptions provided by agents."];
  const disagreementsList = input.disagreements.map((unit) => `- ${unit.text}`);

  return [
    "TL;DR",
    ...tldr,
    "",
    "Main answer",
    ...main,
    "",
    "Assumptions ledger",
    ...assumptionsList.map((item) => `- ${item}`),
    "",
    `Confidence score: ${input.confidence.toFixed(2)}`,
    input.unitsUsed && input.unitsUsed.length ? "" : "",
    input.unitsUsed && input.unitsUsed.length ? `Units used: ${input.unitsUsed.join(", ")}` : "",
    disagreementsList.length ? "" : "",
    disagreementsList.length ? "Disagreements" : "",
    ...disagreementsList,
    input.auditAppendix ? "" : "",
    input.auditAppendix ?? ""
  ]
    .filter((line) => line !== "")
    .join("\n");
};
