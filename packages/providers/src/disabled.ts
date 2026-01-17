import { ProviderDisabledError } from "@roundtable/core";
import type { LLMProvider, LLMRequest, LLMResponse, TokenCountResponse } from "@/types.js";
import type { ProviderName } from "@roundtable/core";

export class DisabledProvider implements LLMProvider {
  name: ProviderName;

  constructor(name: ProviderName) {
    this.name = name;
  }

  async call(_request: Omit<LLMRequest, "provider">): Promise<LLMResponse> {
    throw new ProviderDisabledError(this.name);
  }

  async countTokens(_request: Omit<LLMRequest, "provider">): Promise<TokenCountResponse> {
    throw new ProviderDisabledError(this.name);
  }
}
