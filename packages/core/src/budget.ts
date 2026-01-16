import type { Mode, RoleName } from "@/types.js";

export interface BudgetDecision {
  selectedRoles: RoleName[];
  estimatedCostUsd: number;
}

const COST_PER_TOKEN_USD = 0.000002;

export const estimateCostUsd = (maxTokens: number): number => maxTokens * COST_PER_TOKEN_USD;

export const applyBudget = (
  roles: RoleName[],
  maxTokensByRole: Record<RoleName, number>,
  mode: Mode,
  normalMaxUsd: number,
  deepMaxUsd: number
): BudgetDecision => {
  const budget = mode === "deep" ? deepMaxUsd : normalMaxUsd;
  let selected = [...roles];
  let estimated = selected.reduce(
    (sum, role) => sum + estimateCostUsd(maxTokensByRole[role] ?? 0),
    0
  );

  if (estimated <= budget) {
    return { selectedRoles: selected, estimatedCostUsd: estimated };
  }

  const priority: RoleName[] = [
    "solver",
    "verifier",
    "critic",
    "impl",
    "promptsmith",
    "grok",
    "visual"
  ];
  selected = selected.sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
  while (selected.length > 1 && estimated > budget) {
    selected.pop();
    estimated = selected.reduce(
      (sum, role) => sum + estimateCostUsd(maxTokensByRole[role] ?? 0),
      0
    );
  }

  return { selectedRoles: selected, estimatedCostUsd: estimated };
};
