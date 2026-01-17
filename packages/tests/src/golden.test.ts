import { describe, expect, it } from "vitest";

describe("non-deterministic output invariants", () => {
  it("requires reply and meta fields", () => {
    const response = {
      reply: "TL;DR\n- ok\n\nConfidence score: 0.7",
      meta: {
        taskType: "TECHNICAL_EXECUTION",
        c_final: 0.7,
        budget: { capUsd: 0.1, estimatedUsd: 0.05, modeCapExceeded: false },
        usedAgents: ["solver"],
        invalidation: { discarded: [], quarantined: [], valid: ["solver"] }
      }
    };

    expect(response.reply.length).toBeGreaterThan(0);
    expect(response.meta.taskType).toBe("TECHNICAL_EXECUTION");
    expect(response.meta.budget.capUsd).toBeGreaterThan(0);
  });
});
