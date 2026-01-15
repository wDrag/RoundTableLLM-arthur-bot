import { analystAgent } from "../agents/agents/analyst.js";
import { builderAgent } from "../agents/agents/builder.js";
import { criticAgent } from "../agents/agents/critic.js";
export const agentRegistry = {
    analyst: analystAgent,
    builder: builderAgent,
    critic: criticAgent,
};
