const DEFAULT_MODEL = "gpt-5.2-codex";
export async function callOpenAI(req, apiKey) {
    const controller = new AbortController();
    const timeoutMs = req.timeoutMs ?? 4500;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            throw new Error(`OpenAI request failed with status ${response.status}`);
        }
        const data = (await response.json());
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) {
            throw new Error("OpenAI response missing content");
        }
        return {
            text,
            provider: "openai",
            model: data.model ?? req.model ?? DEFAULT_MODEL,
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
