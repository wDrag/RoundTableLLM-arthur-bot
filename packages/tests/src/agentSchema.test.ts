import { describe, expect, it } from "vitest";
import { agentOutputSchema } from "@roundtable/core";

describe("agent output schema", () => {
  it("validates a strict agent JSON output", () => {
    const output = {
      agent: "SOLVER",
      answerSummary: ["Summary"],
      assumptions: ["Assumption"],
      reasoning: "Reasoning",
      stepsOrDeliverables: ["Step"],
      failureModes: ["Failure"],
      units: [{ id: "U1", topic: "Topic", text: "Text", tags: ["tag"] }],
      selfConfidence: 0.7
    };

    const result = agentOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});
