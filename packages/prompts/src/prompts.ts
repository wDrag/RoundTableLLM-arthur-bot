import type { AgentMessage, Mode, RoleName, TaskType } from "@roundtable/core";

export interface PromptContext {
  taskType: TaskType;
  mode: Mode;
  userMessage: string;
  userContext?: string;
  attachments?: Array<{ name?: string; type?: string }>;
}

const roleInstructions: Record<RoleName, string> = {
  solver: "Provide the primary answer. Be complete and structured.",
  critic: "Identify gaps, contradictions, and high-risk assumptions. Provide fixes.",
  verifier: "Check correctness and compliance; flag unsupported claims.",
  impl: "Focus on implementation details, tests, and acceptance criteria.",
  visual: "Focus on any visual attachments; cite evidence from images.",
  promptsmith: "Optimize prompts, rubrics, and system instructions.",
  grok: "Summarize constraints, unknowns, and alternatives succinctly."
};

const outputSchema = `
Required output sections:
1) Answer Summary (3-7 bullets)
2) Assumptions (decision-relevant)
3) Reasoning (short)
4) Steps/Deliverable
5) Failure Modes/Caveats
6) Confidence score: <0-1>
7) Risk score: <0-1>
`;

export const buildAgentMessages = (role: RoleName, context: PromptContext): AgentMessage[] => {
  const system = [
    "You are a specialist agent. Follow instructions exactly.",
    roleInstructions[role],
    outputSchema
  ].join("\n");

  const attachments = context.attachments
    ?.map((item) => `- ${item.name ?? "attachment"} (${item.type ?? "unknown"})`)
    .join("\n");

  const user = [
    `Task type: ${context.taskType}`,
    `Mode: ${context.mode}`,
    context.userContext ? `Context: ${context.userContext}` : "",
    attachments ? `Attachments:\n${attachments}` : "",
    `Message: ${context.userMessage}`
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
};
