import { ConfigError } from "@/errors.js";
import { getConfig } from "@/config/loadConfig.js";
import type { MasterModelConfig, Mode, ResolvedModelConfig, RoleName, TaskType } from "@/types.js";

export const isRoleEnabledForTask = (role: RoleName, taskType: TaskType): boolean => {
  const config = getConfig();
  const override = config.models.taskTypeOverrides?.[taskType]?.[role];
  if (override && typeof override.enabled === "boolean") {
    return override.enabled;
  }
  return true;
};

export const getModelForRole = (
  role: RoleName,
  taskType: TaskType,
  _mode: Mode
): ResolvedModelConfig => {
  const config = getConfig();
  if (!isRoleEnabledForTask(role, taskType)) {
    throw new ConfigError(`Role ${role} is disabled for task type ${taskType}.`);
  }
  const roleConfig = config.models.roles[role];
  if (!roleConfig) {
    throw new ConfigError(`Missing model config for role ${role}.`);
  }
  const modelEnvName = roleConfig.model;
  const modelId = process.env[modelEnvName] ?? modelEnvName;
  return {
    role,
    provider: roleConfig.provider,
    modelId,
    temperature: roleConfig.temperature,
    maxTokens: roleConfig.maxTokens
  };
};

export const getMasterModel = (): MasterModelConfig & { modelId: string } => {
  const config = getConfig();
  const master = config.models.master;
  const modelEnvName = master.model;
  const modelId = process.env[modelEnvName] ?? modelEnvName;
  return { ...master, modelId };
};
