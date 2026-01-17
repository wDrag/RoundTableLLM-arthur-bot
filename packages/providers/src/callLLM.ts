import { appendFile } from "node:fs/promises";
import { getConfig, getModelForRole } from "@roundtable/core";
import type { AgentMessage, Mode, ProviderName, RoleName, TaskType } from "@roundtable/core";
import { AnthropicProvider } from "@/anthropic.js";
import { DisabledProvider } from "@/disabled.js";
import { DummyProvider } from "@/dummy.js";
import { OpenAIProvider } from "@/openai.js";
import { XaiProvider } from "@/xai.js";
import type { LLMProvider, LLMResponse, TokenCountResponse } from "@/types.js";

const providerCache: Partial<Record<ProviderName, LLMProvider>> = {};

const getProvider = (name: ProviderName): LLMProvider => {
  const cached = providerCache[name];
  if (cached) {
    return cached;
  }
  const config = getConfig().providers;
  switch (name) {
    case "anthropic":
      providerCache[name] = new AnthropicProvider();
      break;
    case "openai":
      providerCache[name] = config.openai.enabled
        ? new OpenAIProvider()
        : new DisabledProvider("openai");
      break;
    case "xai":
      providerCache[name] = config.xai.enabled ? new XaiProvider() : new DisabledProvider("xai");
      break;
    case "dummy":
      providerCache[name] = new DummyProvider();
      break;
  }
  return providerCache[name] ?? new DummyProvider();
};

const logProviderError = async (context: {
  role: RoleName;
  provider: ProviderName;
  modelId: string;
  error: unknown;
}): Promise<void> => {
  const message = context.error instanceof Error ? context.error.message : String(context.error);
  const entry = [
    "---",
    `## Provider Error (${new Date().toISOString()})`,
    `role=${context.role} provider=${context.provider} modelId=${context.modelId}`,
    message.slice(0, 4000)
  ].join("\n");
  await appendFile("./report.local", `\n${entry}\n`, "utf-8");
};

export const callModel = async (input: {
  provider: ProviderName;
  modelId: string;
  messages: AgentMessage[];
  temperature: number;
  maxTokens: number;
  jsonMode?: { schema: object };
  signal?: AbortSignal;
}): Promise<LLMResponse> => {
  const providerInstance = getProvider(input.provider);
  return providerInstance.call(
    {
      modelId: input.modelId,
      messages: input.messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      jsonMode: input.jsonMode
    },
    input.signal
  );
};

export const callLLM = async (
  role: RoleName,
  taskType: TaskType,
  mode: Mode,
  messages: AgentMessage[],
  signal?: AbortSignal
): Promise<LLMResponse> => {
  try {
    const { provider, modelId, temperature, maxTokens } = getModelForRole(role, taskType, mode);
    try {
      return await callModel({
        provider,
        modelId,
        messages,
        temperature,
        maxTokens,
        jsonMode: { schema: {} },
        signal
      });
    } catch (error) {
      await logProviderError({ role, provider, modelId, error });
      const fallback = getProvider("dummy");
      return fallback.call({ modelId: "dummy", messages, temperature, maxTokens }, signal);
    }
  } catch (error) {
    await logProviderError({ role, provider: "dummy", modelId: "dummy", error });
    const fallback = getProvider("dummy");
    return fallback.call({ modelId: "dummy", messages, temperature: 0, maxTokens: 0 }, signal);
  }
};

export const countTokensForRole = async (
  role: RoleName,
  taskType: TaskType,
  mode: Mode,
  messages: AgentMessage[],
  signal?: AbortSignal
): Promise<TokenCountResponse> => {
  try {
    const { provider, modelId, temperature, maxTokens } = getModelForRole(role, taskType, mode);
    const providerInstance = getProvider(provider);
    try {
      return await providerInstance.countTokens(
        { modelId, messages, temperature, maxTokens },
        signal
      );
    } catch (_error) {
      return { totalTokens: 0 };
    }
  } catch (_error) {
    return { totalTokens: 0 };
  }
};
