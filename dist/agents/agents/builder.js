import { getModelForMode, getProviderForMode } from "../../config.js";
import { callLLM } from "../../llm/ensemble.js";
export const builderAgent = async (context) => {
    const provider = getProviderForMode("builder");
    const model = provider ? getModelForMode("builder", provider) : undefined;
    const response = await callLLM({
        mode: "builder",
        provider,
        model,
        requestId: context.requestId,
        messages: [
            {
                role: "system",
                content: "Create a concise, safe reply for the user. Keep it friendly and under 3 sentences.",
            },
            {
                role: "system",
                content: context.normalizedContext,
            },
            {
                role: "user",
                content: context.message,
            },
        ],
    });
    const isFallback = response.provider === "dummy";
    return {
        agent: "builder",
        confidence: isFallback ? 0.5 : 0.65,
        risk: isFallback ? 0.35 : 0.25,
        content: response.text,
    };
};
