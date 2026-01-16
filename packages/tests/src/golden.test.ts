import { describe, expect, it } from "vitest";
import { assembleOutputs, renderReply, scoreOutputs } from "@roundtable/core";
import type { AgentOutput, RoleName } from "@roundtable/core";

const solverOutput = `Answer Summary
- Primary unit

Assumptions
- Assumption A

Reasoning
- Reasoning line

Steps/Deliverable
- Step line

Failure Modes/Caveats
- Failure line

Confidence score: 0.8
Risk score: 0.1`;

describe("golden /ask output", () => {
  it("produces deterministic reply", () => {
    const outputs: AgentOutput[] = [
      { role: "solver", content: solverOutput, confidence: 0.8, risk: 0.1, durationMs: 10 },
      {
        role: "critic",
        content: "Confidence score: 0.4\nRisk score: 0.4",
        confidence: 0.4,
        risk: 0.4,
        durationMs: 10
      },
      {
        role: "verifier",
        content: "Confidence score: 0.4\nRisk score: 0.5",
        confidence: 0.4,
        risk: 0.5,
        durationMs: 10
      }
    ];

    const weights: Record<RoleName, number> = {
      solver: 0.33,
      critic: 0.2,
      verifier: 0.08,
      impl: 0.1,
      promptsmith: 0.24,
      grok: 0.05,
      visual: 0
    };

    const scored = scoreOutputs(outputs, weights);
    const merged = assembleOutputs(scored);
    const confidence = scored.reduce(
      (sum: number, item: (typeof scored)[number]) => sum + item.weightedScore,
      0
    );

    const reply = renderReply({
      mergedUnits: merged.merged,
      assumptions: ["Assumption A"],
      confidence,
      disagreements: merged.disagreements
    });

    const expected = [
      "TL;DR",
      "- Primary unit [SOLVER]",
      "- Assumption A [SOLVER]",
      "- Reasoning line [SOLVER]",
      "",
      "Main answer",
      "- Primary unit [SOLVER]",
      "- Assumption A [SOLVER]",
      "- Reasoning line [SOLVER]",
      "- Step line [SOLVER]",
      "- Failure line [SOLVER]",
      "",
      "Assumptions ledger",
      "- Assumption A",
      "",
      "Confidence score: 0.73"
    ].join("\n");

    expect(reply).toBe(expected);
  });
});
