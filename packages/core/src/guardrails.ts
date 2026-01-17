import type { AgentJsonOutput } from "@/types.js";

export const hasPlan = (outputs: AgentJsonOutput[]): boolean =>
  outputs.some((output) => output.stepsOrDeliverables.length > 0);

export const hasTimeEstimate = (replyMarkdown: string): boolean =>
  replyMarkdown.includes("Execution time estimate");
