export function routeAgents(message) {
    const lower = message.toLowerCase();
    const plan = ["analyst"];
    if (lower.includes("build") ||
        lower.includes("code") ||
        lower.includes("make")) {
        plan.push("builder");
    }
    else {
        plan.push("builder");
    }
    plan.push("critic");
    return Array.from(new Set(plan));
}
