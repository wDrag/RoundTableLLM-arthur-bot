import type { LLMMode, ProviderName } from "@/llm/types.js";

const PROVIDERS: ProviderName[] = ["openai", "anthropic", "dummy"];

function parseProvider(value?: string): ProviderName | undefined {
    if (!value) {
        return undefined;
    }
    const normalized = value.toLowerCase();
    return PROVIDERS.includes(normalized as ProviderName)
        ? (normalized as ProviderName)
        : undefined;
}

export const env = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    analystProvider: parseProvider(process.env.ANALYST_PROVIDER),
    builderProvider: parseProvider(process.env.BUILDER_PROVIDER),
    criticProvider: parseProvider(process.env.CRITIC_PROVIDER),
    openaiModelAnalyst: process.env.OPENAI_MODEL_ANALYST,
    openaiModelBuilder: process.env.OPENAI_MODEL_BUILDER,
    openaiModelCritic: process.env.OPENAI_MODEL_CRITIC,
    anthropicModelAnalyst: process.env.ANTHROPIC_MODEL_ANALYST,
    anthropicModelBuilder: process.env.ANTHROPIC_MODEL_BUILDER,
    anthropicModelCritic: process.env.ANTHROPIC_MODEL_CRITIC,
};

export function getProviderForMode(mode: LLMMode): ProviderName | undefined {
    switch (mode) {
        case "analyst":
            return env.analystProvider;
        case "builder":
            return env.builderProvider;
        case "critic":
            return env.criticProvider;
        default:
            return undefined;
    }
}

export function getModelForMode(
    mode: LLMMode,
    provider: ProviderName
): string | undefined {
    if (provider === "openai") {
        switch (mode) {
            case "analyst":
                return env.openaiModelAnalyst;
            case "builder":
                return env.openaiModelBuilder;
            case "critic":
                return env.openaiModelCritic;
            default:
                return undefined;
        }
    }

    if (provider === "anthropic") {
        switch (mode) {
            case "analyst":
                return env.anthropicModelAnalyst;
            case "builder":
                return env.anthropicModelBuilder;
            case "critic":
                return env.anthropicModelCritic;
            default:
                return undefined;
        }
    }

    return undefined;
}
