import { ProviderDisabledError } from "@roundtable/core";
import type { LLMProvider, LLMRequest, LLMResponse, TokenCountResponse } from "@/types.js";

export class OpenAIProvider implements LLMProvider {
  name = "openai" as const;
  async call(_request: Omit<LLMRequest, "provider">): Promise<LLMResponse> {
    throw new ProviderDisabledError("openai");
  }

  async countTokens(_request: Omit<LLMRequest, "provider">): Promise<TokenCountResponse> {
    throw new ProviderDisabledError("openai");
  }
}
