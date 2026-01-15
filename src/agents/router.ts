import type { AgentName } from "@/agents/types.js";

export function routeAgents(message: string): AgentName[] {
    const lower = message.toLowerCase();
    const plan: AgentName[] = ["analyst"];

    if (
        lower.includes("build") ||
        lower.includes("code") ||
        lower.includes("make")
    ) {
        plan.push("builder");
    } else {
        plan.push("builder");
    }

    plan.push("critic");
    return Array.from(new Set(plan));
}
