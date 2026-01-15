import type { LLMMessage, LLMRequest, LLMResponse } from "@/llm/types.js";

export function callDummy(req: LLMRequest): LLMResponse {
    const lastUser = findLastUser(req.messages);
    const preview = lastUser ? lastUser.content.slice(0, 160) : "";
    const text = `[${req.mode}] ${
        preview || "No user prompt provided."
    }`.trim();
    return {
        text,
        provider: "dummy",
    };
}

function findLastUser(messages: LLMMessage[]): LLMMessage | undefined {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === "user") {
            return messages[i];
        }
    }
    return undefined;
}
