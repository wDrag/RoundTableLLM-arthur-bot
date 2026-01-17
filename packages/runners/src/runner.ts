import { callLLM, countTokensForRole } from "@roundtable/providers";
import { agentOutputSchema, computeAxisScores, computeCredibilityFromAxes } from "@roundtable/core";
import type { AgentMessage, AgentOutput, Mode, RoleName, TaskType } from "@roundtable/core";

export interface AgentRunRequest {
  role: RoleName;
  taskType: TaskType;
  mode: Mode;
  messages: AgentMessage[];
  timeoutMs: number;
}

const withTimeout = async <T>(
  handler: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await handler(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const runSingleAgent = async (request: AgentRunRequest): Promise<AgentOutput> => {
  const start = Date.now();
  const response = await withTimeout<Awaited<ReturnType<typeof callLLM>>>(
    (signal) => callLLM(request.role, request.taskType, request.mode, request.messages, signal),
    request.timeoutMs
  );
  const durationMs = Date.now() - start;
  const rawJson = parseAgentJson(response.text, request.role);
  const axisScores = computeAxisScores(rawJson);
  const credibility = computeCredibilityFromAxes(axisScores, rawJson.selfConfidence);
  return {
    role: request.role,
    raw: rawJson,
    axisScores,
    credibility,
    durationMs
  };
};

const parseAgentJson = (text: string, role: RoleName) => {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  const jsonText =
    jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed;
  try {
    const parsed = JSON.parse(jsonText);
    const result = agentOutputSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  } catch {
    // fall through to fallback
  }
  const summary = trimmed.length > 0 ? trimmed.slice(0, 500) : "No response text available.";
  return {
    agent: role,
    answerSummary: [summary],
    assumptions: [],
    reasoning: summary,
    stepsOrDeliverables: [],
    failureModes: ["Agent response was not valid JSON."],
    units: [],
    selfConfidence: 0
  };
};

const runWithConcurrency = async <T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> => {
  const results: T[] = [];
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      results.push(await task());
    }
  });
  await Promise.all(workers);
  return results;
};

export const runAgents = async (
  requests: AgentRunRequest[],
  concurrency: number
): Promise<AgentOutput[]> => {
  const tasks = requests.map((request) => () => runSingleAgent(request));
  return runWithConcurrency(tasks, concurrency);
};

export const estimateTokensForAgents = async (
  roles: RoleName[],
  taskType: TaskType,
  mode: Mode,
  messagesByRole: Record<RoleName, AgentMessage[]>
): Promise<Record<RoleName, number>> => {
  const entries = await Promise.all(
    roles.map(async (role) => {
      const response = await countTokensForRole(role, taskType, mode, messagesByRole[role]);
      return [role, response.totalTokens] as const;
    })
  );
  return Object.fromEntries(entries) as Record<RoleName, number>;
};
