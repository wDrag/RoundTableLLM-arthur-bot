import fs from "node:fs";
import path from "node:path";
const PROVIDERS = ["openai", "anthropic", "grok", "dummy"];
export const env = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    grokApiKey: process.env.XAI_API_KEY,
};
const configPath = path.resolve(process.cwd(), "llm.config.json");
const config = loadConfig(configPath);
export function getProviderForMode(mode) {
    return config.agents?.[mode]?.provider;
}
export function getModelForMode(mode, provider) {
    const agentModel = config.agents?.[mode]?.model;
    if (agentModel) {
        return agentModel;
    }
    return config.providers?.[provider]?.defaultModel;
}
export function getWeights() {
    return config.weights;
}
function loadConfig(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return sanitizeConfig(parsed);
    }
    catch (error) {
        return {
            providers: {
                openai: { defaultModel: "gpt-5.2-codex" },
                anthropic: { defaultModel: "claude-4-5-sonnet-latest" },
                grok: { defaultModel: "grok-2-latest" },
                dummy: {},
            },
            agents: {
                master: {
                    provider: "anthropic",
                    model: "claude-4-5-sonnet-latest",
                },
                analyst: { provider: "dummy" },
                builder: { provider: "dummy" },
                critic: { provider: "dummy" },
            },
        };
    }
}
function sanitizeConfig(config) {
    const providers = {
        openai: config.providers?.openai ?? {},
        anthropic: config.providers?.anthropic ?? {},
        grok: config.providers?.grok ?? {},
        dummy: config.providers?.dummy ?? {},
    };
    const agents = {
        master: pickAgent(config.agents?.master),
        analyst: pickAgent(config.agents?.analyst),
        builder: pickAgent(config.agents?.builder),
        critic: pickAgent(config.agents?.critic),
    };
    return {
        providers,
        agents,
        weights: config.weights,
        invalidation: config.invalidation,
    };
}
function pickAgent(agent) {
    if (!agent) {
        return {};
    }
    const provider = agent.provider && PROVIDERS.includes(agent.provider)
        ? agent.provider
        : undefined;
    return {
        provider,
        model: agent.model,
    };
}
