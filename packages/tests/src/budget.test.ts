import { describe, expect, it } from "vitest";
import { applyBudget } from "@roundtable/core";
import type { RoleName } from "@roundtable/core";

describe("budget enforcement", () => {
  it("limits /ask within 0.10", () => {
    const roles: RoleName[] = ["solver", "critic", "verifier", "impl"];
    const maxTokens = {
      solver: 100000,
      critic: 100000,
      verifier: 100000,
      impl: 100000,
      promptsmith: 0,
      grok: 0,
      visual: 0
    };
    const decision = applyBudget(roles, maxTokens, "ask", 0.1, 0.5);
    expect(decision.estimatedCostUsd).toBeLessThanOrEqual(0.1);
    expect(decision.selectedRoles.length).toBeGreaterThan(0);
  });

  it("allows higher budget for /deep", () => {
    const roles: RoleName[] = ["solver", "critic", "verifier", "impl", "promptsmith", "grok"];
    const maxTokens = {
      solver: 100000,
      critic: 100000,
      verifier: 100000,
      impl: 100000,
      promptsmith: 100000,
      grok: 100000,
      visual: 0
    };
    const decision = applyBudget(roles, maxTokens, "deep", 0.1, 0.5);
    expect(decision.estimatedCostUsd).toBeLessThanOrEqual(0.5);
    expect(decision.selectedRoles.length).toBeGreaterThan(0);
  });
});
