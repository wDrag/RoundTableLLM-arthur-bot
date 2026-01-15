import { agentRegistry } from "@/agents/registry.js";
import type { AgentContext, AgentName, AgentOutput } from "@/agents/types.js";
import { type FastifyBaseLogger } from "fastify";

interface RunnerOptions {
    concurrency?: number;
    timeoutMs?: number;
}

interface RunnerResult {
    outputs: AgentOutput[];
    timings: Record<AgentName, number>;
}

export async function runAgents(
    plan: AgentName[],
    context: AgentContext,
    logger: FastifyBaseLogger,
    options: RunnerOptions = {}
): Promise<RunnerResult> {
    const concurrency = options.concurrency ?? 2;
    const timeoutMs = options.timeoutMs ?? 4500;
    const outputs: AgentOutput[] = [];
    const timings: Partial<Record<AgentName, number>> = {};
    const names = Array.from(new Set(plan));

    let index = 0;
    const workers = Array.from(
        { length: Math.min(concurrency, names.length) },
        () => worker()
    );

    async function worker(): Promise<void> {
        while (index < names.length) {
            const nextIndex = index;
            index += 1;
            const name = names[nextIndex];
            const agent = agentRegistry[name];
            if (!agent) {
                logger.warn({ agent: name }, "Agent missing from registry");
                continue;
            }

            const start = Date.now();
            try {
                const result = await runWithTimeout(
                    agent(context),
                    timeoutMs,
                    name
                );
                outputs.push(result);
                timings[name] = Date.now() - start;
            } catch (error) {
                logger.warn(
                    { err: error, agent: name },
                    "Agent execution failed"
                );
                outputs.push({
                    agent: name,
                    confidence: 0.2,
                    risk: 0.7,
                    content: "Agent failed to respond in time.",
                });
                timings[name] = Date.now() - start;
            }
        }
    }

    await Promise.all(workers);
    return { outputs, timings: timings as Record<AgentName, number> };
}

async function runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    agent: AgentName
): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`Agent ${agent} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}
