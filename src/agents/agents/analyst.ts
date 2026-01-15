import type { Agent } from "@/agents/types.js";
import { getModelForMode, getProviderForMode } from "@/config.js";
import { callLLM } from "@/llm/ensemble.js";

export const analystAgent: Agent = async (context) => {
    const provider = getProviderForMode("analyst");
    const model = provider ? getModelForMode("analyst", provider) : undefined;

    const response = await callLLM({
        mode: "analyst",
        provider,
        model,
        requestId: context.requestId,
        messages: [
            {
                role: "system",
                content:
                    "You summarize user intent and risks in two concise sentences.",
            },
            {
                role: "system",
                content: context.normalizedContext,
            },
            {
                role: "user",
                content: `User ${context.user.name} (${context.user.id}) said: ${context.message}`,
            },
        ],
    });

    const isFallback = response.provider === "dummy";
    return {
        agent: "analyst",
        confidence: isFallback ? 0.4 : 0.58,
        risk: isFallback ? 0.5 : 0.2,
        content: response.text,
    };
};
