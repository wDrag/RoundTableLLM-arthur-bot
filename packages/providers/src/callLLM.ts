import { getConfig, getModelForRole } from "@roundtable/core";
import type { AgentMessage, Mode, RoleName, TaskType } from "@roundtable/core";
import { AnthropicProvider } from "@/anthropic.js";
import { DisabledProvider } from "@/disabled.js";
import { DummyProvider } from "@/dummy.js";
import { OpenAIProvider } from "@/openai.js";
import { XaiProvider } from "@/xai.js";
import type { LLMProvider, LLMResponse, TokenCountResponse } from "@/types.js";

const providerCache: Record<string, LLMProvider> = {};

const getProvider = (name: string): LLMProvider => {
  if (providerCache[name]) {
    return providerCache[name];
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
    default:
      providerCache[name] = new DummyProvider();
      break;
  }
  return providerCache[name];
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
    const providerInstance = getProvider(provider);
    try {
      return await providerInstance.call({ modelId, messages, temperature, maxTokens }, signal);
    } catch (_error) {
      const fallback = getProvider("dummy");
      return fallback.call({ modelId: "dummy", messages, temperature, maxTokens }, signal);
    }
  } catch (_error) {
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
