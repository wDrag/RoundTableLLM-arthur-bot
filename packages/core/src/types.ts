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

export interface MasterModelConfig extends ModelRoleConfig {}

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
    master: MasterModelConfig;
    roles: Record<RoleName, ModelRoleConfig>;
    taskTypeOverrides: TaskTypeOverrides;
  };
  policy: {
    normalMaxUsd: number;
    deepMaxUsd: number;
    askUserThreshold: number;
    verifierWakeThreshold: number;
    tauHard: number;
    tauSoft: number;
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
  raw: AgentJsonOutput;
  axisScores: AxisScores;
  credibility: number;
  durationMs: number;
}

export interface ScoredOutput extends AgentOutput {
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

export interface AxisScores {
  coherence: number;
  alignment: number;
  verifiability: number;
  signalDensity: number;
  compliance: number;
}

export interface AgentJsonOutput {
  agent: string;
  answerSummary: string[];
  assumptions: string[];
  reasoning: string;
  stepsOrDeliverables: string[];
  failureModes: string[];
  units: Array<{ id: string; topic: string; text: string; tags: string[] }>;
  selfConfidence: number;
  imageEvidence?: string[];
  imageCues?: string[];
}

export interface OrchestrationPlan {
  taskType: TaskType;
  needsClarification: boolean;
  clarificationQuestion?: { question: string; options: string[] };
  agentsToRun: RoleName[];
  rounds: 1 | 2 | 3;
  focus: string[];
  expectedOutputShape: Mode;
  confidenceTarget: number;
}

export interface MasterSynthesis {
  replyMarkdown: string;
  meta: {
    taskType: TaskType;
    conflicts: number;
    coverage: number;
  };
  audit?: {
    plan: string;
    decisions: Array<{ key: string; value: string }>;
    disagreements: string[];
    timeEstimate?: unknown;
    costing?: unknown;
    usingQuarantined?: string;
    unitsUsed?: string[];
  };
}
