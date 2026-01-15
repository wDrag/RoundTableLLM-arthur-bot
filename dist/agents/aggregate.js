import { RISK_HARD_THRESHOLD, CONFIDENCE_SOFT_THRESHOLD, } from "../agents/types.js";
export function aggregateOutputs(outputs) {
    const valid = outputs.filter((item) => item.content && item.content.trim().length > 0);
    const filtered = valid.filter((item) => !(item.risk >= RISK_HARD_THRESHOLD &&
        item.confidence <= CONFIDENCE_SOFT_THRESHOLD));
    const scored = (filtered.length > 0 ? filtered : valid).map((item) => ({
        ...item,
        score: item.confidence - 0.75 * item.risk,
    }));
    const best = scored.reduce((acc, cur) => {
        if (!acc || cur.score > acc.score) {
            return cur;
        }
        return acc;
    }, undefined);
    const reply = best?.content?.trim() ||
        valid[0]?.content?.trim() ||
        "I am here to help, but I need a little more detail.";
    return {
        reply,
        best,
        scored,
    };
}
