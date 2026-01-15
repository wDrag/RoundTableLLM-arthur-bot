import { env } from "../config.js";
import { callAnthropic } from "../llm/providers/anthropic.js";
import { callDummy } from "../llm/providers/dummy.js";
import { callOpenAI } from "../llm/providers/openai.js";
export async function callLLM(req) {
    const provider = selectProvider(req.provider);
    try {
        if (provider === "openai" && env.openaiApiKey) {
            return await callOpenAI(req, env.openaiApiKey);
        }
        if (provider === "anthropic" && env.anthropicApiKey) {
            return await callAnthropic(req, env.anthropicApiKey);
        }
    }
    catch (error) {
        return callDummy(req);
    }
    return callDummy(req);
}
function selectProvider(requested) {
    if (requested) {
        return requested;
    }
    if (env.openaiApiKey) {
        return "openai";
    }
    if (env.anthropicApiKey) {
        return "anthropic";
    }
    return "dummy";
}
