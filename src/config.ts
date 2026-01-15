import fs from "node:fs";
import path from "node:path";
import type { LLMMode, ProviderName } from "@/llm/types.js";

const PROVIDERS: ProviderName[] = ["openai", "anthropic", "grok", "dummy"];

export const env = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    grokApiKey: process.env.XAI_API_KEY,
};

type ProviderConfig = {
    defaultModel?: string;
};

type AgentConfig = {
    provider?: ProviderName;
    model?: string;
};

type LLMConfig = {
    providers?: Record<ProviderName, ProviderConfig>;
    agents?: Record<LLMMode, AgentConfig>;
    weights?: Record<string, Record<string, number>>;
    invalidation?: { hard?: number; soft?: number };
};

const configPath = path.resolve(process.cwd(), "llm.config.json");
const config = loadConfig(configPath);

export function getProviderForMode(mode: LLMMode): ProviderName | undefined {
    return config.agents?.[mode]?.provider;
}

export function getModelForMode(
    mode: LLMMode,
    provider: ProviderName
): string | undefined {
    const agentModel = config.agents?.[mode]?.model;
    if (agentModel) {
        return agentModel;
    }
    return config.providers?.[provider]?.defaultModel;
}

export function getWeights() {
    return config.weights;
}

function loadConfig(filePath: string): LLMConfig {
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw) as LLMConfig;
        return sanitizeConfig(parsed);
    } catch (error) {
        return {
            providers: {
                openai: { defaultModel: "gpt-4o-mini" },
                anthropic: { defaultModel: "claude-3-5-sonnet-latest" },
                grok: { defaultModel: "grok-2-latest" },
                dummy: {},
            },
            agents: {
                analyst: { provider: "dummy" },
                builder: { provider: "dummy" },
                critic: { provider: "dummy" },
            },
        };
    }
}

function sanitizeConfig(config: LLMConfig): LLMConfig {
    const providers: Record<ProviderName, ProviderConfig> = {
        openai: config.providers?.openai ?? {},
        anthropic: config.providers?.anthropic ?? {},
        grok: config.providers?.grok ?? {},
        dummy: config.providers?.dummy ?? {},
    };

    const agents: Record<LLMMode, AgentConfig> = {
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

function pickAgent(agent?: AgentConfig): AgentConfig {
    if (!agent) {
        return {};
    }
    const provider =
        agent.provider && PROVIDERS.includes(agent.provider)
            ? agent.provider
            : undefined;
    return {
        provider,
        model: agent.model,
    };
}
