import type { LLMProvider, LLMRequest, LLMResponse, TokenCountResponse } from "@/types.js";

const stableHash = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

export class DummyProvider implements LLMProvider {
  name = "dummy" as const;
  async call(request: Omit<LLMRequest, "provider">): Promise<LLMResponse> {
    const fingerprint = stableHash(JSON.stringify(request.messages));
    const text = [
      "TL;DR: No external model configured.",
      "",
      "Main answer:",
      "- No provider is enabled or configured; cannot produce a model-based response.",
      "",
      "Assumptions ledger:",
      "- Caller accepts deterministic dummy responses when providers are unavailable.",
      "",
      `Confidence score: 0.10 (dummy:${fingerprint})`
    ].join("\n");
    return { text };
  }

  async countTokens(): Promise<TokenCountResponse> {
    return { totalTokens: 0 };
  }
}
