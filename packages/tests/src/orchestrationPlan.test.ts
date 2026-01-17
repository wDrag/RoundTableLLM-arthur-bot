import { describe, expect, it } from "vitest";
import { orchestrationPlanSchema } from "@roundtable/core";

describe("orchestration plan schema", () => {
  it("validates a minimal plan", () => {
    const plan = {
      taskType: "TECHNICAL_EXECUTION",
      needsClarification: false,
      agentsToRun: ["solver", "critic", "verifier"],
      rounds: 1,
      focus: ["correctness"],
      expectedOutputShape: "ask",
      confidenceTarget: 0.8
    };

    const result = orchestrationPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });
});
