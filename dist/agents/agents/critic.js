import { getModelForMode, getProviderForMode } from "../../config.js";
import { callLLM } from "../../llm/ensemble.js";
export const criticAgent = async (context) => {
    const provider = getProviderForMode("critic");
    const model = provider ? getModelForMode("critic", provider) : undefined;
    const response = await callLLM({
        mode: "critic",
        provider,
        model,
        requestId: context.requestId,
        messages: [
            {
                role: "system",
                content: "Review the draft interaction for safety, clarity, and user intent alignment. Flag risks in one sentence.",
            },
            {
                role: "user",
                content: `Message: ${context.message}`,
            },
        ],
    });
    const isFallback = response.provider === "dummy";
    return {
        agent: "critic",
        confidence: isFallback ? 0.4 : 0.5,
        risk: isFallback ? 0.5 : 0.35,
        content: response.text,
    };
};
