import { getConfig, ProviderConfigError, ProviderDisabledError } from "@roundtable/core";
import type { AgentMessage } from "@roundtable/core";
import type { LLMProvider, LLMRequest, LLMResponse, TokenCountResponse } from "@/types.js";

const toAnthropicPayload = (
  request: Omit<LLMRequest, "provider">
): { system?: string; messages: AgentMessage[] } => {
  const systemMessages = request.messages.filter((msg) => msg.role === "system");
  const system = systemMessages
    .map((msg) => msg.content)
    .join("\n")
    .trim();
  const messages = request.messages.filter((msg) => msg.role !== "system");
  return system ? { system, messages } : { messages };
};

export class AnthropicProvider implements LLMProvider {
  name = "anthropic" as const;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly anthropicVersion: string;

  constructor() {
    const config = getConfig().providers.anthropic;
    if (!config.enabled) {
      throw new ProviderDisabledError("anthropic");
    }
    const apiKey = process.env[config.apiKeyEnv];
    const version = process.env[config.anthropicVersionEnv];
    if (!apiKey) {
      throw new ProviderConfigError(`Missing ${config.apiKeyEnv} for Anthropic provider.`);
    }
    if (!version) {
      throw new ProviderConfigError(
        `Missing ${config.anthropicVersionEnv} for Anthropic provider.`
      );
    }
    this.baseUrl = config.baseUrl;
    this.apiKey = apiKey;
    this.anthropicVersion = version;
  }

  async call(request: Omit<LLMRequest, "provider">, signal?: AbortSignal): Promise<LLMResponse> {
    const payload = {
      model: request.modelId,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      ...toAnthropicPayload(request),
      ...(request.jsonMode ? { response_format: { type: "json" } } : {})
    };

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.anthropicVersion
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ProviderConfigError(
        `Anthropic error ${response.status}: ${text || response.statusText}`
      );
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.map((block) => block.text ?? "").join("") ?? "";
    return { text };
  }

  async countTokens(
    request: Omit<LLMRequest, "provider">,
    signal?: AbortSignal
  ): Promise<TokenCountResponse> {
    const payload = {
      model: request.modelId,
      max_tokens: request.maxTokens,
      ...toAnthropicPayload(request)
    };

    const response = await fetch(`${this.baseUrl}/v1/messages/count_tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.anthropicVersion
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ProviderConfigError(
        `Anthropic token count error ${response.status}: ${text || response.statusText}`
      );
    }

    const data = (await response.json()) as { input_tokens?: number };
    return { totalTokens: data.input_tokens ?? 0 };
  }
}
