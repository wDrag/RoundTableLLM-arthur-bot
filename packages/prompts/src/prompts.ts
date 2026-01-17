import type { AgentMessage, Mode, RoleName, TaskType } from "@roundtable/core";

export interface PromptContext {
  taskType: TaskType;
  mode: Mode;
  userMessage: string;
  userContext?: string;
  attachments?: Array<{ name?: string; type?: string; filename?: string; contentType?: string }>;
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
Return STRICT JSON ONLY (no markdown, no code fences, no extra keys).
Do NOT wrap the JSON in triple backticks or any prose. Output must start with "{" and end with "}".
If you cannot fully answer, still return a MINIMAL valid JSON object with empty arrays and a brief reasoning string.
Schema:
{
  "agent": "SOLVER|CRITIC|VERIFIER|IMPL|VISUAL|PROMPTSMITH|GROK",
  "answerSummary": ["..."],
  "assumptions": ["..."],
  "reasoning": "...",
  "stepsOrDeliverables": ["..."],
  "failureModes": ["..."],
  "units": [{ "id": "U1", "topic": "...", "text": "...", "tags": ["..."] }],
  "selfConfidence": 0.0
}
If VISUAL, also include:
"imageEvidence": ["..."],
"imageCues": ["..."]
`;

export const buildAgentMessages = (role: RoleName, context: PromptContext): AgentMessage[] => {
  const system = [
    "You are a specialist agent. Follow instructions exactly.",
    roleInstructions[role],
    outputSchema,
    "Return ONLY the JSON. No preface, no suffix."
  ].join("\n");

  const attachments = context.attachments
    ?.map(
      (item) =>
        `- ${item.name ?? item.filename ?? "attachment"} (${item.type ?? item.contentType ?? "unknown"})`
    )
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

export const buildMasterPlanMessages = (input: {
  hint: string;
  message: string;
  mode: Mode;
}): AgentMessage[] => {
  const system = [
    "You are the Master Orchestrator.",
    "Output STRICT JSON ONLY matching the OrchestrationPlan schema.",
    "Required keys: taskType, needsClarification, clarificationQuestion (if needed), agentsToRun, rounds, focus, expectedOutputShape, confidenceTarget.",
    "clarificationQuestion.options must be exactly 3 items: A/B/C.",
    "agentsToRun must include solver, critic, verifier unless strong reason otherwise."
  ].join("\n");

  const user = [`Mode: ${input.mode}`, `Hint: ${input.hint}`, `Message: ${input.message}`].join(
    "\n\n"
  );

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
};

export const buildMasterSynthesisMessages = (input: {
  message: string;
  mode: Mode;
  planJson: string;
  agentJson: string;
  scoringJson: string;
  policyJson: string;
  enforceTimeEstimate?: boolean;
}): AgentMessage[] => {
  const system = [
    "You are the Master Synthesizer.",
    "Output STRICT JSON ONLY matching the FinalSynthesis schema:",
    "{ replyMarkdown, meta: { taskType, conflicts, coverage }, audit? }",
    "meta.conflicts and meta.coverage MUST be numbers.",
    "If audit is present, it must include: plan (string), decisions (array of {key,value}), disagreements (array of strings).",
    "replyMarkdown must be a plain Markdown string with no JSON blocks.",
    "NEVER reference DISCARD outputs. Use QUARANTINE only with explicit justification in audit.",
    input.enforceTimeEstimate
      ? "If a plan exists, ALWAYS include a '### Execution time estimate' section in replyMarkdown. This section is REQUIRED."
      : ""
  ].join("\n");

  const user = [
    `Mode: ${input.mode}`,
    `Message: ${input.message}`,
    `Plan: ${input.planJson}`,
    `AgentOutputs: ${input.agentJson}`,
    `Scoring: ${input.scoringJson}`,
    `Policy: ${input.policyJson}`
  ].join("\n\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
};
