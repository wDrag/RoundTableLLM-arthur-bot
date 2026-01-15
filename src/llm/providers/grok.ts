import type { LLMRequest, LLMResponse } from "@/llm/types.js";

const DEFAULT_MODEL = "grok-2-latest";

export async function callGrok(
    req: LLMRequest,
    apiKey: string
): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeoutMs = req.timeoutMs ?? 4500;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: req.model ?? DEFAULT_MODEL,
                messages: req.messages,
                temperature: req.temperature ?? 0.2,
                max_tokens: req.maxTokens,
            }),
        });

        if (!response.ok) {
            throw new Error(
                `Grok request failed with status ${response.status}`
            );
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            model?: string;
        };

        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) {
            throw new Error("Grok response missing content");
        }

        return {
            text,
            provider: "grok",
            model: data.model ?? req.model ?? DEFAULT_MODEL,
        };
    } finally {
        clearTimeout(timeout);
    }
}
