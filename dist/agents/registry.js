import { masterAgent } from "../agents/agents/master.js";
import { analystAgent } from "../agents/agents/analyst.js";
import { builderAgent } from "../agents/agents/builder.js";
import { criticAgent } from "../agents/agents/critic.js";
export const agentRegistry = {
    master: masterAgent,
    analyst: analystAgent,
    builder: builderAgent,
    critic: criticAgent,
};
