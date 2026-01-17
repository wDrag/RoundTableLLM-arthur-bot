import { describe, expect, it } from "vitest";
import { hasPlan, hasTimeEstimate } from "@roundtable/core";
import type { AgentJsonOutput } from "@roundtable/core";

describe("content invariants", () => {
  it("detects when a plan requires time estimate", () => {
    const outputs: AgentJsonOutput[] = [
      {
        agent: "SOLVER",
        answerSummary: ["Summary"],
        assumptions: ["Assumption"],
        reasoning: "Reasoning",
        stepsOrDeliverables: ["Step"],
        failureModes: ["Failure"],
        units: [{ id: "U1", topic: "Topic", text: "Text", tags: ["tag"] }],
        selfConfidence: 0.7
      }
    ];

    expect(hasPlan(outputs)).toBe(true);
    expect(hasTimeEstimate("### Execution time estimate\n- Step 1")).toBe(true);
  });
});
