export type ProviderName = "anthropic" | "openai" | "xai" | "dummy";

export type RoleName =
  | "solver"
  | "critic"
  | "verifier"
  | "impl"
  | "visual"
  | "promptsmith"
  | "grok";

export type TaskType =
  | "PROMPT_ENGINEERING"
  | "VERBAL_REASONING"
  | "TECHNICAL_EXECUTION"
  | "VISUAL_ANALYSIS"
  | "MIXED";

export type Mode = "ask" | "audit" | "deep";

export interface ModelRoleConfig {
  provider: ProviderName;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface RoleOverrideConfig {
  enabled: boolean;
}

export interface TaskTypeOverrides {
  [taskType: string]: {
    [role in RoleName]?: RoleOverrideConfig;
  };
}

export interface LlmConfig {
  version: number;
  providers: {
    anthropic: {
      enabled: boolean;
      baseUrl: string;
      apiKeyEnv: string;
      anthropicVersionEnv: string;
    };
    openai: {
      enabled: boolean;
      apiKeyEnv: string;
    };
    xai: {
      enabled: boolean;
      apiKeyEnv: string;
    };
  };
  models: {
    roles: Record<RoleName, ModelRoleConfig>;
    taskTypeOverrides: TaskTypeOverrides;
  };
  cost: {
    normalMaxUsd: number;
    deepMaxUsd: number;
  };
}

export interface ResolvedModelConfig {
  role: RoleName;
  provider: ProviderName;
  modelId: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentOutput {
  role: RoleName;
  content: string;
  confidence: number;
  risk: number;
  durationMs: number;
}

export interface ScoredOutput extends AgentOutput {
  credibility: number;
  status: "DISCARD" | "QUARANTINE" | "VALID";
  weightedScore: number;
}

export interface MergeUnit {
  id: string;
  sourceRole: RoleName;
  text: string;
  reason?: string;
}

export interface MergeResult {
  merged: MergeUnit[];
  disagreements: MergeUnit[];
  quarantined: MergeUnit[];
}
