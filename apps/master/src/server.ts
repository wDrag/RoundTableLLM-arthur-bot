import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { mkdir } from "node:fs/promises";
import { appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  applyBudget,
  classifyTask,
  getConfig,
  getMasterModel,
  getWeightsForTask,
  initConfig,
  isRoleEnabledForTask,
  logRequest,
  maskAuthorization,
  masterSynthesisSchema,
  orchestrationPlanSchema,
  scoreOutputs
} from "@roundtable/core";
import type {
  AgentMessage,
  MasterSynthesis,
  Mode,
  OrchestrationPlan,
  RoleName
} from "@roundtable/core";
import {
  buildAgentMessages,
  buildMasterPlanMessages,
  buildMasterSynthesisMessages
} from "@roundtable/prompts";
import { estimateTokensForAgents, runAgents } from "@roundtable/runners";
import { callModel } from "@roundtable/providers";

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
    context: {
      type: "object",
      properties: {
        channelId: { type: "string" },
        guildId: { type: "string" },
        messageId: { type: "string" }
      }
    },
    message: { type: "string" },
    attachments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          url: { type: "string" },
          contentType: { type: "string" }
        }
      }
    }
  }
};

const chatResponseSchema = {
  type: "object",
  required: ["reply", "meta"],
  properties: {
    reply: { type: "string" },
    meta: {
      type: "object",
      required: ["taskType", "c_final", "budget", "usedAgents", "invalidation"],
      properties: {
        taskType: { type: "string" },
        c_final: { type: "number" },
        budget: {
          type: "object",
          required: ["capUsd", "estimatedUsd", "modeCapExceeded"],
          properties: {
            capUsd: { type: "number" },
            estimatedUsd: { type: "number" },
            modeCapExceeded: { type: "boolean" }
          }
        },
        usedAgents: { type: "array", items: { type: "string" } },
        invalidation: {
          type: "object",
          required: ["discarded", "quarantined", "valid"],
          properties: {
            discarded: { type: "array", items: { type: "string" } },
            quarantined: { type: "array", items: { type: "string" } },
            valid: { type: "array", items: { type: "string" } }
          }
        }
      }
    },
    audit: { type: "object" }
  }
};

interface ChatRequestBody {
  source: string;
  mode: Mode;
  user: { id: string; name?: string };
  context?: { channelId?: string; guildId?: string; messageId?: string };
  message: string;
  attachments?: Array<{ filename: string; url: string; contentType?: string }>;
}

const buildHint = (message: string, attachments?: Array<{ contentType?: string }>): string => {
  const classification = classifyTask(message, attachments ?? []);
  return `deterministicHint=${classification.taskType}`;
};

const createDb = async () => {
  await mkdir("./data", { recursive: true });
  const db = await open({ filename: "./data/master.db", driver: sqlite3.Database });
  await db.exec(
    `CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      createdAt TEXT,
      requestJson TEXT,
      planJson TEXT,
      agentJson TEXT,
      scoreJson TEXT,
      replyJson TEXT,
      auditJson TEXT
    );`
  );
  return db;
};

const extractJsonText = (text: string): string => {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
};

const redactSecrets = (text: string): string => text.replace(/sk-[A-Za-z0-9_-]+/g, "sk-REDACTED");

const logPlanDebug = async (raw: string): Promise<void> => {
  const entry = [
    "---",
    `## Master Plan Debug (${new Date().toISOString()})`,
    redactSecrets(raw).slice(0, 4000)
  ].join("\n");
  await appendFile("./report.local", `\n${entry}\n`, "utf-8");
};

const logSynthesisDebug = async (raw: string): Promise<void> => {
  const entry = [
    "---",
    `## Master Synthesis Debug (${new Date().toISOString()})`,
    redactSecrets(raw).slice(0, 4000)
  ].join("\n");
  await appendFile("./report.local", `\n${entry}\n`, "utf-8");
};

const normalizeTaskType = (
  value: unknown,
  fallback: OrchestrationPlan["taskType"]
): OrchestrationPlan["taskType"] => {
  if (typeof value !== "string") return fallback;
  const normalized = value.toUpperCase().replace(/[^A-Z]+/g, "_");
  const allowed: OrchestrationPlan["taskType"][] = [
    "PROMPT_ENGINEERING",
    "VERBAL_REASONING",
    "TECHNICAL_EXECUTION",
    "VISUAL_ANALYSIS",
    "MIXED"
  ];
  return allowed.includes(normalized as OrchestrationPlan["taskType"])
    ? (normalized as OrchestrationPlan["taskType"])
    : fallback;
};

const normalizeMode = (value: unknown, fallback: Mode): Mode => {
  return value === "ask" || value === "audit" || value === "deep" ? value : fallback;
};

const normalizeRoles = (value: unknown, fallback: RoleName[]): RoleName[] => {
  const allowed: RoleName[] = [
    "solver",
    "critic",
    "verifier",
    "impl",
    "visual",
    "promptsmith",
    "grok"
  ];
  if (!Array.isArray(value)) return fallback;
  const roles = value.filter((role): role is RoleName => allowed.includes(role as RoleName));
  return roles.length > 0 ? roles : fallback;
};

const coerceSynthesisMeta = (
  meta: unknown,
  fallbackTaskType: OrchestrationPlan["taskType"]
): MasterSynthesis["meta"] => {
  if (!meta || typeof meta !== "object") {
    return { taskType: fallbackTaskType, conflicts: 0, coverage: 0 };
  }
  const metaRecord = meta as Record<string, unknown>;
  const conflictsValue = metaRecord.conflicts;
  const coverageValue = metaRecord.coverage;
  const conflicts = Array.isArray(conflictsValue)
    ? conflictsValue.length
    : typeof conflictsValue === "number"
      ? conflictsValue
      : 0;
  const coverage = Array.isArray(coverageValue)
    ? coverageValue.length
    : typeof coverageValue === "number"
      ? coverageValue
      : typeof coverageValue === "string" && coverageValue.length > 0
        ? 1
        : 0;
  return {
    taskType: normalizeTaskType(metaRecord.taskType, fallbackTaskType),
    conflicts,
    coverage
  };
};

const normalizeAudit = (value: unknown): MasterSynthesis["audit"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.plan !== "string") return undefined;
  if (!Array.isArray(record.decisions)) return undefined;
  if (
    !record.decisions.every((item) => {
      if (!item || typeof item !== "object") return false;
      const decision = item as Record<string, unknown>;
      return typeof decision.key === "string" && typeof decision.value === "string";
    })
  ) {
    return undefined;
  }
  if (!Array.isArray(record.disagreements)) return undefined;
  if (!record.disagreements.every((item) => typeof item === "string")) return undefined;
  return record as MasterSynthesis["audit"];
};

const buildFallbackSynthesis = (input: {
  plan: OrchestrationPlan;
  agentJson: unknown;
  enforceTimeEstimate?: boolean;
}): MasterSynthesis => {
  const summaries: string[] = [];
  if (Array.isArray(input.agentJson)) {
    input.agentJson.forEach((item) => {
      const raw = (item as { raw?: { answerSummary?: string[]; reasoning?: string } })?.raw;
      if (Array.isArray(raw?.answerSummary)) {
        raw?.answerSummary.forEach((summary) => summaries.push(summary));
      } else if (raw?.reasoning) {
        summaries.push(raw.reasoning);
      }
    });
  }

  const summaryBlock = summaries.length
    ? `\n\nSummary from agents:\n${summaries
        .slice(0, 6)
        .map((summary) => `- ${summary}`)
        .join("\n")}`
    : "\n\nNo agent summary available.";
  const timeEstimateBlock = input.enforceTimeEstimate
    ? "\n\nExecution time estimate: Not available."
    : "";

  return {
    replyMarkdown: `Master synthesis fallback (JSON parse failed).${summaryBlock}${timeEstimateBlock}`,
    meta: {
      taskType: input.plan.taskType,
      conflicts: 0,
      coverage: summaries.length ? 1 : 0
    }
  };
};

const coercePlan = (
  input: Partial<OrchestrationPlan>,
  mode: Mode,
  hint: string
): OrchestrationPlan => {
  const hintMatch = hint.match(/deterministicHint=([A-Z_]+)/);
  const taskType = normalizeTaskType(hintMatch?.[1], "VERBAL_REASONING");
  return {
    taskType: normalizeTaskType(input.taskType, taskType),
    needsClarification: input.needsClarification ?? false,
    clarificationQuestion: input.clarificationQuestion,
    agentsToRun: normalizeRoles(input.agentsToRun, ["solver", "critic", "verifier"]),
    rounds: input.rounds && [1, 2, 3].includes(input.rounds) ? input.rounds : 1,
    focus: Array.isArray(input.focus) ? input.focus : [],
    expectedOutputShape: normalizeMode(input.expectedOutputShape, mode),
    confidenceTarget:
      typeof input.confidenceTarget === "number" &&
      input.confidenceTarget >= 0 &&
      input.confidenceTarget <= 1
        ? input.confidenceTarget
        : 0.7
  };
};

const callMasterPlan = async (
  mode: Mode,
  message: string,
  hint: string
): Promise<OrchestrationPlan> => {
  const master = getMasterModel();
  const messages = buildMasterPlanMessages({ hint, message, mode });
  const response = await callModel({
    provider: master.provider,
    modelId: master.modelId,
    temperature: master.temperature,
    maxTokens: master.maxTokens,
    messages,
    jsonMode: { schema: {} }
  });
  const rawText = response.text;
  try {
    const jsonText = extractJsonText(rawText);
    const parsed = JSON.parse(jsonText);
    const result = orchestrationPlanSchema.safeParse(parsed);
    if (!result.success) {
      await logPlanDebug(rawText);
      return coercePlan(parsed as Partial<OrchestrationPlan>, mode, hint);
    }
    return result.data;
  } catch {
    await logPlanDebug(rawText);
    return coercePlan({}, mode, hint);
  }
};

const callMasterSynthesis = async (input: {
  mode: Mode;
  message: string;
  plan: OrchestrationPlan;
  agentJson: unknown;
  scoringJson: unknown;
  policyJson: unknown;
  enforceTimeEstimate?: boolean;
}): Promise<MasterSynthesis> => {
  const master = getMasterModel();
  const messages = buildMasterSynthesisMessages({
    mode: input.mode,
    message: input.message,
    planJson: JSON.stringify(input.plan),
    agentJson: JSON.stringify(input.agentJson),
    scoringJson: JSON.stringify(input.scoringJson),
    policyJson: JSON.stringify(input.policyJson),
    enforceTimeEstimate: input.enforceTimeEstimate
  });
  const response = await callModel({
    provider: master.provider,
    modelId: master.modelId,
    temperature: master.temperature,
    maxTokens: master.maxTokens,
    messages,
    jsonMode: { schema: {} }
  });
  try {
    const parsed = JSON.parse(extractJsonText(response.text));
    if (parsed && typeof parsed === "object" && "meta" in parsed) {
      (parsed as { meta?: unknown }).meta = coerceSynthesisMeta(
        (parsed as { meta?: unknown }).meta,
        input.plan.taskType
      );
    }
    if (parsed && typeof parsed === "object" && "audit" in parsed) {
      (parsed as { audit?: unknown }).audit = normalizeAudit((parsed as { audit?: unknown }).audit);
    }
    const result = masterSynthesisSchema.safeParse(parsed);
    if (!result.success) {
      await logSynthesisDebug(response.text);
      return buildFallbackSynthesis({
        plan: input.plan,
        agentJson: input.agentJson,
        enforceTimeEstimate: input.enforceTimeEstimate
      });
    }
    return result.data;
  } catch {
    await logSynthesisDebug(response.text);
    return buildFallbackSynthesis({
      plan: input.plan,
      agentJson: input.agentJson,
      enforceTimeEstimate: input.enforceTimeEstimate
    });
  }
};

const runMaster = async (): Promise<void> => {
  await initConfig();
  const db = await createDb();
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

      const hint = buildHint(body.message, body.attachments);
      let plan = await callMasterPlan(body.mode, body.message, hint);

      if (plan.needsClarification && !plan.clarificationQuestion) {
        plan = {
          ...plan,
          clarificationQuestion: {
            question: "Choose the next step.",
            options: ["A) Provide goal", "B) Provide constraints", "C) Proceed with assumptions"]
          }
        };
      }

      const selectedRoles = plan.agentsToRun.filter((role) =>
        isRoleEnabledForTask(role, plan.taskType)
      );

      app.log.info({
        requestId: request.id,
        routingPlan: plan
      });

      const messagesByRole = Object.fromEntries(
        selectedRoles.map((role) => [
          role,
          buildAgentMessages(role, {
            taskType: plan.taskType,
            mode: body.mode,
            userMessage: body.message,
            userContext: body.context ? JSON.stringify(body.context) : undefined,
            attachments: body.attachments
          })
        ])
      ) as Record<RoleName, AgentMessage[]>;

      const config = getConfig();
      let tokenEstimates: Record<RoleName, number>;
      try {
        tokenEstimates = await estimateTokensForAgents(
          selectedRoles,
          plan.taskType,
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
        config.policy.normalMaxUsd,
        config.policy.deepMaxUsd
      );
      const capUsd = body.mode === "deep" ? config.policy.deepMaxUsd : config.policy.normalMaxUsd;

      const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 15000);
      const concurrency = Number(process.env.RUNNER_CONCURRENCY ?? 2);

      const agentRequests = budgetDecision.selectedRoles.map((role: RoleName) => ({
        role,
        taskType: plan.taskType,
        mode: body.mode,
        messages: messagesByRole[role],
        timeoutMs
      }));

      const maxAttempts = 3;
      const weights = getWeightsForTask({ taskType: plan.taskType });
      const thresholds = { hard: config.policy.tauHard, soft: config.policy.tauSoft };
      const policyPayload = config.policy;
      let outputs: Awaited<ReturnType<typeof runAgents>> = [];
      let scored: ReturnType<typeof scoreOutputs> = [];
      let agentPayload: Array<{
        role: RoleName;
        status: "DISCARD" | "QUARANTINE" | "VALID";
        credibility: number;
        axisScores: (typeof scored)[number]["axisScores"];
        raw: (typeof scored)[number]["raw"];
      }> = [];
      let scoringPayload: {
        thresholds: typeof thresholds;
        weights: typeof weights;
        statusByRole: Record<string, string>;
      } = { thresholds, weights, statusByRole: {} };
      let synthesis: MasterSynthesis | null = null;
      let cFinal = 0;
      let planExists = false;
      let invalidation = {
        discarded: [] as string[],
        quarantined: [] as string[],
        valid: [] as string[]
      };

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        outputs = await runAgents(agentRequests, concurrency);

        outputs.forEach((output: (typeof outputs)[number]) => {
          app.log.info({
            requestId: request.id,
            role: output.role,
            durationMs: output.durationMs
          });
        });

        scored = scoreOutputs(outputs, weights, thresholds);
        const totalWeight = scored
          .filter((item) => item.status !== "DISCARD")
          .reduce((sum, item) => sum + (weights[item.role] ?? 0), 0);
        const statusByRole = new Map(scored.map((item) => [item.role, item.status]));
        const valid = scored.filter((item) => item.status === "VALID");
        const baseScore =
          valid.reduce((sum, item) => sum + item.credibility * (weights[item.role] ?? 0), 0) /
          (totalWeight || 1);

        agentPayload = scored.map((item) => ({
          role: item.role,
          status: item.status,
          credibility: item.credibility,
          axisScores: item.axisScores,
          raw: item.raw
        }));

        scoringPayload = {
          thresholds,
          weights,
          statusByRole: Object.fromEntries(statusByRole)
        };

        planExists = outputs.some((output) => output.raw.stepsOrDeliverables.length > 0);

        synthesis = await callMasterSynthesis({
          mode: body.mode,
          message: body.message,
          plan,
          agentJson: agentPayload,
          scoringJson: scoringPayload,
          policyJson: policyPayload,
          enforceTimeEstimate: planExists
        });

        if (planExists && !synthesis.replyMarkdown.includes("Execution time estimate")) {
          synthesis = await callMasterSynthesis({
            mode: body.mode,
            message: body.message,
            plan,
            agentJson: agentPayload,
            scoringJson: scoringPayload,
            policyJson: policyPayload,
            enforceTimeEstimate: true
          });
          if (!synthesis.replyMarkdown.includes("Execution time estimate")) {
            synthesis = {
              ...synthesis,
              replyMarkdown: `${synthesis.replyMarkdown}\n\n### Execution time estimate\nNot provided by the model; defaulting to: 2-4 hours for analysis tasks or 2-4 weeks for full adoption planning.`
            };
          }
        }

        if (process.env.DISABLE_QUARANTINE_USE === "1" && synthesis.audit?.usingQuarantined) {
          throw new Error(
            "Quarantine usage disabled but master attempted to use quarantined outputs."
          );
        }

        const conflictPenalty = Math.min(0.2, synthesis.meta.conflicts * 0.05);
        const coverageBonus = Math.min(0.1, synthesis.meta.coverage * 0.1);
        cFinal = Math.min(
          1,
          Math.max(0, Number((baseScore - conflictPenalty + coverageBonus).toFixed(3)))
        );

        invalidation = {
          discarded: scored.filter((i) => i.status === "DISCARD").map((i) => i.role),
          quarantined: scored.filter((i) => i.status === "QUARANTINE").map((i) => i.role),
          valid: scored.filter((i) => i.status === "VALID").map((i) => i.role)
        };

        const hasInvalidation =
          invalidation.discarded.length > 0 || invalidation.quarantined.length > 0;
        const lowConfidence = cFinal < config.policy.askUserThreshold;
        if (attempt < maxAttempts && (hasInvalidation || lowConfidence)) {
          continue;
        }
        break;
      }

      const askUser = cFinal < config.policy.askUserThreshold;
      if (askUser) {
        const question = plan.clarificationQuestion ?? {
          question: "Choose the next step.",
          options: ["A) Clarify the goal", "B) Provide constraints", "C) Proceed with assumptions"]
        };
        return reply.send({
          reply: `${question.question}\n${question.options.join("\n")}`,
          meta: {
            taskType: plan.taskType,
            c_final: cFinal,
            budget: {
              capUsd,
              estimatedUsd: budgetDecision.estimatedCostUsd,
              modeCapExceeded: budgetDecision.selectedRoles.length < selectedRoles.length
            },
            usedAgents: selectedRoles,
            invalidation
          }
        });
      }

      const responsePayload = {
        reply: synthesis?.replyMarkdown ?? "",
        meta: {
          taskType: synthesis?.meta.taskType ?? plan.taskType,
          c_final: cFinal,
          budget: {
            capUsd,
            estimatedUsd: budgetDecision.estimatedCostUsd,
            modeCapExceeded: budgetDecision.selectedRoles.length < selectedRoles.length
          },
          usedAgents: selectedRoles,
          invalidation
        },
        audit: body.mode === "audit" || body.mode === "deep" ? synthesis?.audit : undefined
      };

      const runId = randomUUID();
      await db.run(
        `INSERT INTO runs (id, createdAt, requestJson, planJson, agentJson, scoreJson, replyJson, auditJson)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          runId,
          new Date().toISOString(),
          JSON.stringify(body),
          JSON.stringify(plan),
          JSON.stringify(agentPayload),
          JSON.stringify({ scoringPayload, cFinal }),
          JSON.stringify(responsePayload),
          JSON.stringify(synthesis?.audit ?? {})
        ]
      );

      return reply.send(responsePayload);
    }
  );

  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ port, host: "0.0.0.0" });
};

runMaster().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
