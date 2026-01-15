const DEFAULT_MODEL = "claude-3-5-sonnet-latest";
export async function callAnthropic(req, apiKey) {
    const controller = new AbortController();
    const timeoutMs = req.timeoutMs ?? 4500;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const { system, messages } = splitMessages(req.messages);
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: req.model ?? DEFAULT_MODEL,
                system,
                messages,
                max_tokens: req.maxTokens ?? 512,
                temperature: req.temperature ?? 0.2,
            }),
        });
        if (!response.ok) {
            throw new Error(`Anthropic request failed with status ${response.status}`);
        }
        const data = (await response.json());
        const text = data.content
            ?.filter((item) => item.type === "text")
            .map((item) => item.text ?? "")
            .join("")
            .trim();
        if (!text) {
            throw new Error("Anthropic response missing content");
        }
        return {
            text,
            provider: "anthropic",
            model: data.model ?? req.model ?? DEFAULT_MODEL,
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
function splitMessages(messages) {
    const systemParts = [];
    const filtered = [];
    for (const message of messages) {
        if (message.role === "system") {
            if (message.content.trim()) {
                systemParts.push(message.content.trim());
            }
        }
        else if (message.role === "user" || message.role === "assistant") {
            filtered.push({ role: message.role, content: message.content });
        }
    }
    return {
        system: systemParts.length ? systemParts.join("\n\n") : undefined,
        messages: filtered.length ? filtered : [{ role: "user", content: "" }],
    };
}
