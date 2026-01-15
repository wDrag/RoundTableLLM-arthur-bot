import type { Agent, AgentOutput } from "@/agents/types.js";
import { getModelForMode, getProviderForMode } from "@/config.js";
import { callLLM } from "@/llm/ensemble.js";

export interface MasterContext {
    userMessage: string;
    specialistOutputs: AgentOutput[];
    requestId: string;
}

export type UseCase =
    | "PROMPT_ENGINEERING"
    | "VERBAL_REASONING"
    | "TECHNICAL_EXECUTION"
    | "VISUAL_ANALYSIS"
    | "GENERAL";

const CATEGORIZE_SYSTEM_PROMPT = `You are a master orchestrator that categorizes user requests and synthesizes specialist responses.

Your responsibilities:
1. Categorize the user's request into one of these use cases:
   - PROMPT_ENGINEERING: Creating prompts, prompt optimization, AI instruction crafting
   - VERBAL_REASONING: Logic problems, analysis, argumentation, explanations
   - TECHNICAL_EXECUTION: Coding, debugging, technical implementation, system design
   - VISUAL_ANALYSIS: Image analysis, design feedback, visual content interpretation
   - GENERAL: Anything that doesn't fit the above categories

2. Review specialist responses and synthesize the best final answer considering:
   - Confidence and risk scores from each specialist
   - Coherence and completeness of responses
   - Appropriateness for the identified use case

Output your response in this exact JSON format:
{
  "useCase": "<USE_CASE>",
  "reasoning": "<brief explanation of categorization>",
  "finalResponse": "<synthesized response for the user>"
}`;

export async function categorizeAndDecide(
    context: MasterContext
): Promise<{ useCase: UseCase; reasoning: string; finalResponse: string }> {
    const provider = getProviderForMode("master");
    const model = provider ? getModelForMode("master", provider) : undefined;

    const specialistSummary = context.specialistOutputs
        .map(
            (o) =>
                `[${o.agent}] (confidence: ${o.confidence.toFixed(
                    2
                )}, risk: ${o.risk.toFixed(2)})\n${o.content}`
        )
        .join("\n\n---\n\n");

    const response = await callLLM({
        mode: "master",
        provider,
        model,
        requestId: context.requestId,
        messages: [
            { role: "system", content: CATEGORIZE_SYSTEM_PROMPT },
            {
                role: "user",
                content: `User request: "${context.userMessage}"

Specialist responses:
${specialistSummary}

Categorize this request and provide the final synthesized response.`,
            },
        ],
        temperature: 0.3,
    });

    try {
        const parsed = JSON.parse(response.text);
        return {
            useCase: parsed.useCase || "GENERAL",
            reasoning: parsed.reasoning || "",
            finalResponse: parsed.finalResponse || response.text,
        };
    } catch {
        return {
            useCase: "GENERAL",
            reasoning: "Could not parse structured response",
            finalResponse: response.text,
        };
    }
}

export const masterAgent: Agent = async (context) => {
    const provider = getProviderForMode("master");
    const model = provider ? getModelForMode("master", provider) : undefined;

    const response = await callLLM({
        mode: "master",
        provider,
        model,
        requestId: context.requestId,
        messages: [
            {
                role: "system",
                content:
                    "You are the master orchestrator. Provide a helpful, coherent response.",
            },
            {
                role: "system",
                content: context.normalizedContext,
            },
            {
                role: "user",
                content: `User ${context.user.name} said: ${context.message}`,
            },
        ],
    });

    const isFallback = response.provider === "dummy";
    return {
        agent: "master",
        confidence: isFallback ? 0.4 : 0.7,
        risk: isFallback ? 0.5 : 0.15,
        content: response.text,
    };
};
