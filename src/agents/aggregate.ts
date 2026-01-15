import {
    type AggregatedResult,
    type AgentOutput,
    RISK_HARD_THRESHOLD,
    CONFIDENCE_SOFT_THRESHOLD,
} from "@/agents/types.js";
import {
    categorizeAndDecide,
    type MasterContext,
    type UseCase,
} from "@/agents/agents/master.js";

export interface MasterAggregatedResult extends AggregatedResult {
    useCase: UseCase;
    reasoning: string;
}

export async function aggregateWithMaster(
    outputs: AgentOutput[],
    userMessage: string,
    requestId: string
): Promise<MasterAggregatedResult> {
    const specialistOutputs = outputs.filter((o) => o.agent !== "master");

    if (specialistOutputs.length === 0) {
        return {
            reply: "I am here to help, but I need a little more detail.",
            useCase: "GENERAL",
            reasoning: "No specialist responses available",
            scored: [],
        };
    }

    const masterContext: MasterContext = {
        userMessage,
        specialistOutputs,
        requestId,
    };

    const decision = await categorizeAndDecide(masterContext);

    const scored = specialistOutputs.map((item) => ({
        ...item,
        score: item.confidence - 0.75 * item.risk,
    }));

    return {
        reply: decision.finalResponse,
        useCase: decision.useCase,
        reasoning: decision.reasoning,
        best: scored.reduce<(AgentOutput & { score: number }) | undefined>(
            (acc, cur) => (!acc || cur.score > acc.score ? cur : acc),
            undefined
        ),
        scored,
    };
}

export function aggregateOutputs(outputs: AgentOutput[]): AggregatedResult {
    const valid = outputs.filter(
        (item) => item.content && item.content.trim().length > 0
    );

    const filtered = valid.filter(
        (item) =>
            !(
                item.risk >= RISK_HARD_THRESHOLD &&
                item.confidence <= CONFIDENCE_SOFT_THRESHOLD
            )
    );

    const scored = (filtered.length > 0 ? filtered : valid).map((item) => ({
        ...item,
        score: item.confidence - 0.75 * item.risk,
    }));

    const best = scored.reduce<(AgentOutput & { score: number }) | undefined>(
        (acc, cur) => {
            if (!acc || cur.score > acc.score) {
                return cur;
            }
            return acc;
        },
        undefined
    );

    const reply =
        best?.content?.trim() ||
        valid[0]?.content?.trim() ||
        "I am here to help, but I need a little more detail.";

    return {
        reply,
        best,
        scored,
    };
}
