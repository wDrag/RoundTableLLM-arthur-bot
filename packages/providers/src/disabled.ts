import { ProviderDisabledError } from "@roundtable/core";
import type { LLMProvider, LLMRequest, LLMResponse, TokenCountResponse } from "@/types.js";

export class DisabledProvider implements LLMProvider {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async call(_request: Omit<LLMRequest, "provider">): Promise<LLMResponse> {
    throw new ProviderDisabledError(this.name);
  }

  async countTokens(_request: Omit<LLMRequest, "provider">): Promise<TokenCountResponse> {
    throw new ProviderDisabledError(this.name);
  }
}
