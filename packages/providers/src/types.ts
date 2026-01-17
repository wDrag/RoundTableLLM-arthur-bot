import type { AgentMessage, ProviderName } from "@roundtable/core";

export interface LLMRequest {
  provider: ProviderName;
  modelId: string;
  messages: AgentMessage[];
  temperature: number;
  maxTokens: number;
  jsonMode?: { schema: object };
}

export interface LLMResponse {
  text: string;
}

export interface TokenCountResponse {
  totalTokens: number;
}

export interface LLMProvider {
  name: ProviderName;
  call(request: Omit<LLMRequest, "provider">, signal?: AbortSignal): Promise<LLMResponse>;
  countTokens(
    request: Omit<LLMRequest, "provider">,
    signal?: AbortSignal
  ): Promise<TokenCountResponse>;
}
