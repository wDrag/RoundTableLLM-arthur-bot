import { z } from "zod";
import type { AgentJsonOutput, MasterSynthesis, OrchestrationPlan } from "@/types.js";

export const orchestrationPlanSchema: z.ZodType<OrchestrationPlan> = z
  .object({
    taskType: z.enum([
      "PROMPT_ENGINEERING",
      "VERBAL_REASONING",
      "TECHNICAL_EXECUTION",
      "VISUAL_ANALYSIS",
      "MIXED"
    ]),
    needsClarification: z.boolean(),
    clarificationQuestion: z
      .object({
        question: z.string().min(1),
        options: z.array(z.string().min(2)).min(3)
      })
      .optional(),
    agentsToRun: z.array(
      z.enum(["solver", "critic", "verifier", "impl", "visual", "promptsmith", "grok"])
    ),
    rounds: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    focus: z.array(z.string().min(1)),
    expectedOutputShape: z.enum(["ask", "audit", "deep"]),
    confidenceTarget: z.number().min(0).max(1)
  })
  .passthrough();

export const agentOutputSchema: z.ZodType<AgentJsonOutput> = z.object({
  agent: z.string().min(1),
  answerSummary: z.array(z.string()),
  assumptions: z.array(z.string()),
  reasoning: z.string(),
  stepsOrDeliverables: z.array(z.string()),
  failureModes: z.array(z.string()),
  units: z.array(
    z.object({
      id: z.string().min(1),
      topic: z.string().min(1),
      text: z.string().min(1),
      tags: z.array(z.string())
    })
  ),
  selfConfidence: z.number().min(0).max(1),
  imageEvidence: z.array(z.string()).optional(),
  imageCues: z.array(z.string()).optional()
});

export const masterSynthesisSchema: z.ZodType<MasterSynthesis> = z.object({
  replyMarkdown: z.string().min(1),
  meta: z.object({
    taskType: z.enum([
      "PROMPT_ENGINEERING",
      "VERBAL_REASONING",
      "TECHNICAL_EXECUTION",
      "VISUAL_ANALYSIS",
      "MIXED"
    ]),
    conflicts: z.number().min(0),
    coverage: z.number().min(0)
  }),
  audit: z
    .object({
      plan: z.string().min(1),
      decisions: z.array(z.object({ key: z.string(), value: z.string() })),
      disagreements: z.array(z.string()),
      timeEstimate: z.unknown().optional(),
      costing: z.unknown().optional(),
      usingQuarantined: z.string().optional(),
      unitsUsed: z.array(z.string()).optional()
    })
    .optional()
});
