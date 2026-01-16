import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import {
  applyBudget,
  assembleOutputs,
  classifyTask,
  getConfig,
  initConfig,
  isRoleEnabledForTask,
  logRequest,
  maskAuthorization,
  renderReply,
  scoreOutputs,
  getWeightsForTask,
  DEFAULT_THRESHOLDS
} from "@roundtable/core";
import type { AgentMessage, Mode, RoleName, TaskType } from "@roundtable/core";
import { buildAgentMessages } from "@roundtable/prompts";
import { estimateTokensForAgents, runAgents } from "@roundtable/runners";
import { callLLM } from "@roundtable/providers";

const app = Fastify({ logger: true });

const chatRequestSchema = {
  type: "object",
  required: ["source", "mode", "user", "message"],
  properties: {
    source: { type: "string" },
    mode: { type: "string", enum: ["ask", "audit", "deep"] },
    user: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        name: { type: "string" }
      }
    },
    context: { type: "string" },
    message: { type: "string" },
    attachments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string" },
          url: { type: "string" }
        }
      }
    }
  }
};

const chatResponseSchema = {
  type: "object",
  required: ["reply"],
  properties: {
    reply: { type: "string" }
  }
};

interface ChatRequestBody {
  source: string;
  mode: Mode;
  user: { id: string; name?: string };
  context?: string;
  message: string;
  attachments?: Array<{ name?: string; type?: string; url?: string }>;
}

const selectRoles = (mode: Mode, taskType: TaskType, hasAttachments: boolean): RoleName[] => {
  const base: RoleName[] = ["solver", "critic", "verifier"];
  if (mode === "deep" || mode === "audit") {
    return ["solver", "critic", "verifier", "impl", "promptsmith", "grok", "visual"];
  }
  if (taskType === "TECHNICAL_EXECUTION") {
    base.push("impl");
  }
  if (taskType === "PROMPT_ENGINEERING") {
    base.push("promptsmith", "grok");
  }
  if (taskType === "VISUAL_ANALYSIS" || hasAttachments) {
    base.push("visual");
  }
  return Array.from(new Set(base));
};

const computeFinalConfidence = (weightedScores: number[]): number =>
  Number(weightedScores.reduce((sum, value) => sum + value, 0).toFixed(3));

const extractSection = (content: string, heading: string): string[] => {
  const regex = new RegExp(`${heading}([\s\S]*?)(\n\n|$)`, "i");
  const match = content.match(regex);
  const section = match?.[1];
  if (!section) return [];
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(-|\*|\d+\.)\s+/, ""));
};

const buildAuditAppendix = (payload: {
  taskType: TaskType;
  weights: Record<string, number>;
  scored: Array<{
    role: string;
    credibility: number;
    status: string;
    weightedScore: number;
    axisScores: Record<string, number>;
  }>;
  mergeUnits: Array<{ id: string; text: string }>;
  quarantined: Array<{ id: string; text: string; reason?: string }>;
  disagreements: Array<{ id: string; text: string }>;
  budgetUsd: number;
  unitsUsed?: string[];
}): string => {
  const weights = Object.entries(payload.weights)
    .map(([role, weight]) => `- ${role}: ${weight.toFixed(3)}`)
    .join("\n");

  const perAgent = payload.scored
    .map((item) => {
      const axes = Object.entries(item.axisScores)
        .map(([axis, score]) => `${axis}:${score.toFixed(1)}`)
        .join(" ");
      return `- ${item.role}: credibility=${item.credibility.toFixed(2)} status=${item.status} weighted=${item.weightedScore.toFixed(3)} axes=[${axes}]`;
    })
    .join("\n");

  const mergeTrace = payload.mergeUnits.map((unit) => `- ${unit.id}: ${unit.text}`).join("\n");
  const quarantine = payload.quarantined
    .map((unit) => `- ${unit.id}: ${unit.text} (${unit.reason ?? "policy"})`)
    .join("\n");
  const disagreements = payload.disagreements
    .map((unit) => `- ${unit.id}: ${unit.text}`)
    .join("\n");

  return [
    "Audit appendix",
    `Task type: ${payload.taskType}`,
    "Weights (post-discard reallocation)",
    weights,
    "",
    "Per-agent scores",
    perAgent,
    "",
    `Budget estimate (USD): ${payload.budgetUsd.toFixed(4)}`,
    payload.unitsUsed?.length ? "" : "",
    payload.unitsUsed?.length ? `Units used: ${payload.unitsUsed.join(", ")}` : "",
    "",
    "Merge trace",
    mergeTrace || "- None",
    "",
    "Quarantine",
    quarantine || "- None",
    "",
    "Disagreements",
    disagreements || "- None"
  ].join("\n");
};

const computeAxisScores = (content: string): Record<string, number> => {
  const lengthScore = Math.min(content.length / 800, 1);
  const sections = ["Answer Summary", "Assumptions", "Reasoning", "Steps", "Failure"];
  const sectionHits = sections.filter((section) => content.includes(section)).length;
  const sectionScore = sectionHits / sections.length;
  return {
    coherence: 25 * sectionScore,
    alignment: 25 * lengthScore,
    verifiability: 25 * (content.includes("Assumptions") ? 1 : 0.5),
    signalDensity: 25 * sectionScore,
    compliance: 25 * (content.includes("Failure") ? 1 : 0.5)
  };
};

const maybePolish = async (
  mode: Mode,
  taskType: TaskType,
  mergedUnits: Array<{ text: string; id: string }>
): Promise<string | null> => {
  if (mode !== "deep" || process.env.ENABLE_POLISH !== "1") {
    return null;
  }
  const unitText = mergedUnits.map((unit) => `- ${unit.id}: ${unit.text}`).join("\n");
  const messages: AgentMessage[] = [
    {
      role: "system",
      content:
        "You are an editor. Rewrite the answer using only the provided units; do not add claims. Output plain Markdown without new facts."
    },
    {
      role: "user",
      content: `Units:\n${unitText}`
    }
  ];
  const response = await callLLM("impl", taskType, "deep", messages);
  return response.text.trim();
};

const runMaster = async (): Promise<void> => {
  await initConfig();
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true }));

  app.post(
    "/api/chat",
    { schema: { body: chatRequestSchema, response: { 200: chatResponseSchema } } },
    async (request: FastifyRequest<{ Body: ChatRequestBody }>, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      const apiKey = process.env.MASTER_API_KEY;
      if (apiKey && authHeader !== `Bearer ${apiKey}`) {
        return reply.status(401).send({ reply: "Unauthorized" });
      }

      const body = request.body;

      logRequest(app.log, {
        requestId: request.id,
        source: body.source,
        mode: body.mode,
        userId: body.user.id,
        authorization: maskAuthorization(authHeader)
      });

      const classification = classifyTask(body.message, body.attachments ?? []);
      const hasAttachments = (body.attachments ?? []).length > 0;
      const selectedRoles = selectRoles(body.mode, classification.taskType, hasAttachments).filter(
        (role) => isRoleEnabledForTask(role, classification.taskType)
      );

      app.log.info({
        requestId: request.id,
        routingPlan: {
          taskType: classification.taskType,
          roles: selectedRoles
        }
      });

      const messagesByRole = Object.fromEntries(
        selectedRoles.map((role) => [
          role,
          buildAgentMessages(role, {
            taskType: classification.taskType,
            mode: body.mode,
            userMessage: body.message,
            userContext: body.context,
            attachments: body.attachments
          })
        ])
      ) as Record<RoleName, AgentMessage[]>;

      const config = getConfig();
      let tokenEstimates: Record<RoleName, number>;
      try {
        tokenEstimates = await estimateTokensForAgents(
          selectedRoles,
          classification.taskType,
          body.mode,
          messagesByRole
        );
      } catch {
        tokenEstimates = Object.fromEntries(
          selectedRoles.map((role) => [role, config.models.roles[role].maxTokens])
        ) as Record<RoleName, number>;
      }

      const budgetDecision = applyBudget(
        selectedRoles,
        tokenEstimates,
        body.mode,
        config.cost.normalMaxUsd,
        config.cost.deepMaxUsd
      );

      const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 15000);
      const concurrency = Number(process.env.RUNNER_CONCURRENCY ?? 2);

      const agentRequests = budgetDecision.selectedRoles.map((role: RoleName) => ({
        role,
        taskType: classification.taskType,
        mode: body.mode,
        messages: messagesByRole[role],
        timeoutMs
      }));

      const outputs = await runAgents(agentRequests, concurrency);

      outputs.forEach((output: (typeof outputs)[number]) => {
        app.log.info({
          requestId: request.id,
          role: output.role,
          durationMs: output.durationMs
        });
      });

      const weights = getWeightsForTask(classification);
      const scored = scoreOutputs(outputs, weights, DEFAULT_THRESHOLDS);
      const totalWeight = scored
        .filter((item) => item.status !== "DISCARD")
        .reduce((sum, item) => sum + (weights[item.role] ?? 0), 0);
      const statusByRole = new Map(scored.map((item) => [item.role, item.status]));
      const normalizedWeights = Object.fromEntries(
        Object.entries(weights).map(([role, weight]) => {
          const status = statusByRole.get(role as RoleName);
          if (status === "DISCARD") {
            return [role, 0];
          }
          return [role, totalWeight ? weight / totalWeight : 0];
        })
      );
      const merged = assembleOutputs(scored);
      const base =
        scored.find((item: (typeof scored)[number]) => item.status === "VALID") ?? scored[0];
      const assumptions = base ? extractSection(base.content, "Assumptions") : [];
      const weightedScores = scored.map((item: (typeof scored)[number]) => item.weightedScore);
      const cFinal = computeFinalConfidence(weightedScores);
      const unitsUsed = merged.merged.map((unit: (typeof merged.merged)[number]) => unit.id);

      const polished = await maybePolish(body.mode, classification.taskType, merged.merged);

      const askUser = cFinal < 0.7;
      const question = askUser
        ? "\n\nQuestion (choose A/B/C):\nA) Clarify the primary goal\nB) Provide constraints or budget\nC) Proceed with best-effort assumptions"
        : "";

      const auditAppendix =
        body.mode === "audit" || body.mode === "deep"
          ? buildAuditAppendix({
              taskType: classification.taskType,
              weights: normalizedWeights,
              scored: scored.map((item: (typeof scored)[number]) => ({
                role: item.role,
                credibility: item.credibility,
                status: item.status,
                weightedScore: item.weightedScore,
                axisScores: computeAxisScores(item.content)
              })),
              mergeUnits: merged.merged.map((unit: (typeof merged.merged)[number]) => ({
                id: unit.id,
                text: unit.text
              })),
              quarantined: merged.quarantined.map((unit: (typeof merged.quarantined)[number]) => ({
                id: unit.id,
                text: unit.text,
                reason: unit.reason
              })),
              disagreements: merged.disagreements.map(
                (unit: (typeof merged.disagreements)[number]) => ({
                  id: unit.id,
                  text: unit.text
                })
              ),
              budgetUsd: budgetDecision.estimatedCostUsd,
              unitsUsed
            })
          : undefined;

      const replyText = renderReply({
        mergedUnits: merged.merged,
        assumptions,
        confidence: cFinal,
        disagreements: merged.disagreements,
        auditAppendix,
        unitsUsed: body.mode === "deep" ? unitsUsed : undefined,
        polished: polished ?? undefined
      });

      return reply.send({ reply: replyText + question });
    }
  );

  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ port, host: "0.0.0.0" });
};

runMaster().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
