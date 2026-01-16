import { callLLM, countTokensForRole } from "@roundtable/providers";
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
  const { confidence, risk } = extractConfidenceRisk(response.text);
  return {
    role: request.role,
    content: response.text,
    confidence,
    risk,
    durationMs
  };
};

const extractConfidenceRisk = (text: string): { confidence: number; risk: number } => {
  const confidenceMatch = text.match(/Confidence\s*score:\s*([0-1](?:\.\d+)?)/i);
  const riskMatch = text.match(/Risk\s*score:\s*([0-1](?:\.\d+)?)/i);
  return {
    confidence: confidenceMatch ? Number(confidenceMatch[1]) : 0.5,
    risk: riskMatch ? Number(riskMatch[1]) : 0.3
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
