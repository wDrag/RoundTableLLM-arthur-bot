import { ProviderDisabledError } from "@roundtable/core";
import type { LLMProvider, LLMRequest, LLMResponse, TokenCountResponse } from "@/types.js";

export class XaiProvider implements LLMProvider {
  name = "xai" as const;
  async call(_request: Omit<LLMRequest, "provider">): Promise<LLMResponse> {
    throw new ProviderDisabledError("xai");
  }

  async countTokens(_request: Omit<LLMRequest, "provider">): Promise<TokenCountResponse> {
    throw new ProviderDisabledError("xai");
  }
}
