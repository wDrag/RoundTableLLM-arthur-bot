import type { RoleName, TaskType } from "@/types.js";

export interface TaskClassification {
  taskType: TaskType;
  shares?: Record<Exclude<TaskType, "MIXED">, number>;
}

export const classifyTask = (
  message: string,
  attachments: Array<{ type?: string }> = []
): TaskClassification => {
  const text = message.toLowerCase();
  const hasImage = attachments.some(
    (att) => att.type?.startsWith("image/") || att.type === "image"
  );
  const isPrompt = /prompt|system prompt|rubric|template/.test(text);
  const isTech = /code|api|bug|error|stack trace|docker|deploy|typescript|node|fastify/.test(text);

  if (hasImage) {
    return { taskType: "VISUAL_ANALYSIS" };
  }
  if (isPrompt && isTech) {
    return {
      taskType: "MIXED",
      shares: {
        PROMPT_ENGINEERING: 0.5,
        TECHNICAL_EXECUTION: 0.5,
        VERBAL_REASONING: 0,
        VISUAL_ANALYSIS: 0
      }
    };
  }
  if (isPrompt) {
    return { taskType: "PROMPT_ENGINEERING" };
  }
  if (isTech) {
    return { taskType: "TECHNICAL_EXECUTION" };
  }
  return { taskType: "VERBAL_REASONING" };
};

const weightTables: Record<TaskType, Record<RoleName, number>> = {
  PROMPT_ENGINEERING: {
    promptsmith: 0.52,
    solver: 0.2,
    critic: 0.15,
    verifier: 0.1,
    grok: 0.03,
    impl: 0,
    visual: 0
  },
  VERBAL_REASONING: {
    solver: 0.33,
    promptsmith: 0.24,
    critic: 0.2,
    impl: 0.1,
    verifier: 0.08,
    grok: 0.05,
    visual: 0
  },
  TECHNICAL_EXECUTION: {
    impl: 0.38,
    solver: 0.23,
    critic: 0.2,
    verifier: 0.11,
    promptsmith: 0.03,
    grok: 0.05,
    visual: 0
  },
  VISUAL_ANALYSIS: {
    visual: 0.42,
    solver: 0.2,
    critic: 0.15,
    verifier: 0.18,
    promptsmith: 0.05,
    grok: 0,
    impl: 0
  },
  MIXED: {
    solver: 0,
    critic: 0,
    verifier: 0,
    impl: 0,
    visual: 0,
    promptsmith: 0,
    grok: 0
  }
};

export const getWeightsForTask = (classification: TaskClassification): Record<RoleName, number> => {
  if (classification.taskType !== "MIXED") {
    return weightTables[classification.taskType];
  }
  const shares = classification.shares ?? {
    PROMPT_ENGINEERING: 0.5,
    TECHNICAL_EXECUTION: 0.5,
    VERBAL_REASONING: 0,
    VISUAL_ANALYSIS: 0
  };
  const mixedWeights: Record<RoleName, number> = {
    solver: 0,
    critic: 0,
    verifier: 0,
    impl: 0,
    visual: 0,
    promptsmith: 0,
    grok: 0
  };

  (Object.keys(shares) as Array<Exclude<TaskType, "MIXED">>).forEach((taskType) => {
    const share = shares[taskType] ?? 0;
    const base = weightTables[taskType];
    (Object.keys(base) as RoleName[]).forEach((role) => {
      mixedWeights[role] += base[role] * share;
    });
  });

  const total = Object.values(mixedWeights).reduce((sum, value) => sum + value, 0) || 1;
  (Object.keys(mixedWeights) as RoleName[]).forEach((role) => {
    mixedWeights[role] = mixedWeights[role] / total;
  });

  return mixedWeights;
};
