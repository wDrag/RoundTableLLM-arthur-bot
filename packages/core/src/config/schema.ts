import { z } from "zod";

const providerNameSchema = z.enum(["anthropic", "openai", "xai"]);
const roleNameSchema = z.enum([
  "solver",
  "critic",
  "verifier",
  "impl",
  "visual",
  "promptsmith",
  "grok"
]);

const modelRoleSchema = z.object({
  provider: providerNameSchema,
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive()
});

const roleOverridesShape = roleNameSchema.options.reduce(
  (acc: Record<string, z.ZodTypeAny>, role: (typeof roleNameSchema.options)[number]) => {
    acc[role] = z.object({ enabled: z.boolean() }).partial();
    return acc;
  },
  {} as Record<string, z.ZodTypeAny>
);

const taskTypeOverridesSchema = z.record(z.object(roleOverridesShape).partial());

export const llmConfigSchema = z.object({
  version: z.number().int().positive(),
  providers: z.object({
    anthropic: z.object({
      enabled: z.boolean(),
      baseUrl: z.string().url(),
      apiKeyEnv: z.string().min(1),
      anthropicVersionEnv: z.string().min(1)
    }),
    openai: z.object({
      enabled: z.boolean(),
      apiKeyEnv: z.string().min(1)
    }),
    xai: z.object({
      enabled: z.boolean(),
      apiKeyEnv: z.string().min(1)
    })
  }),
  models: z.object({
    master: modelRoleSchema,
    roles: z.record(roleNameSchema, modelRoleSchema),
    taskTypeOverrides: taskTypeOverridesSchema.default({})
  }),
  policy: z.object({
    normalMaxUsd: z.number().positive(),
    deepMaxUsd: z.number().positive(),
    askUserThreshold: z.number().min(0).max(1),
    verifierWakeThreshold: z.number().min(0).max(1),
    tauHard: z.number().min(0).max(1),
    tauSoft: z.number().min(0).max(1)
  })
});

export type LlmConfigSchema = z.infer<typeof llmConfigSchema>;
