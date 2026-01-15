export type LLMRole = "system" | "user" | "assistant";

export type LLMMessage = {
    role: LLMRole;
    content: string;
};

export type LLMMode = "analyst" | "builder" | "critic";

export type ProviderName = "openai" | "anthropic" | "dummy";

export type LLMRequest = {
    provider?: ProviderName;
    model?: string;
    mode: LLMMode;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    requestId?: string;
};

export type LLMResponse = {
    text: string;
    provider: ProviderName;
    model?: string;
};
