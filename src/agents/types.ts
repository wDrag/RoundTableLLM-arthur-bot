export type AgentName = "analyst" | "builder" | "critic";

export interface AgentContext {
    source: "discord";
    message: string;
    user: { id: string; name: string };
    discordContext?: { channelId?: string; guildId?: string };
    normalizedContext: string;
    requestId: string;
}

export interface AgentOutput {
    agent: AgentName;
    confidence: number;
    risk: number;
    content: string;
    bullets?: string[];
}

export type Agent = (context: AgentContext) => Promise<AgentOutput>;

export const CONFIDENCE_SOFT_THRESHOLD = 0.45;
export const RISK_HARD_THRESHOLD = 0.6;

export interface AggregatedResult {
    reply: string;
    best?: AgentOutput & { score: number };
    scored: Array<AgentOutput & { score: number }>;
}
