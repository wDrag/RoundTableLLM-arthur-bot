import { env } from "@/config.js";
import { callAnthropic } from "@/llm/providers/anthropic.js";
import { callDummy } from "@/llm/providers/dummy.js";
import { callGrok } from "@/llm/providers/grok.js";
import { callOpenAI } from "@/llm/providers/openai.js";
import type { LLMRequest, LLMResponse, ProviderName } from "@/llm/types.js";

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
    const provider = selectProvider(req.provider);

    try {
        if (provider === "openai" && env.openaiApiKey) {
            return await callOpenAI(req, env.openaiApiKey);
        }
        if (provider === "anthropic" && env.anthropicApiKey) {
            return await callAnthropic(req, env.anthropicApiKey);
        }
        if (provider === "grok" && env.grokApiKey) {
            return await callGrok(req, env.grokApiKey);
        }
    } catch (error) {
        return callDummy(req);
    }

    return callDummy(req);
}

function selectProvider(requested?: ProviderName): ProviderName {
    if (requested) {
        return requested;
    }
    if (env.openaiApiKey) {
        return "openai";
    }
    if (env.anthropicApiKey) {
        return "anthropic";
    }
    if (env.grokApiKey) {
        return "grok";
    }
    return "dummy";
}
