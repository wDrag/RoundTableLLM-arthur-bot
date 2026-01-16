import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { resolve } from "node:path";
import { llmConfigSchema } from "@/config/schema.js";
import { ConfigError } from "@/errors.js";
import type { LlmConfig } from "@/types.js";

let currentConfig: LlmConfig | null = null;
let watcher: ReturnType<typeof watch> | null = null;

const formatZodError = (error: unknown): string => {
  if (error && typeof error === "object" && "errors" in error) {
    const issues = (error as { errors: Array<{ path: (string | number)[]; message: string }> })
      .errors;
    return issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
  }
  return "Invalid llm.config.json";
};

const resolveConfigPath = (): string => {
  const override = process.env.LLM_CONFIG_PATH;
  return resolve(process.cwd(), override ?? "llm.config.json");
};

export const loadConfig = async (): Promise<LlmConfig> => {
  const configPath = resolveConfigPath();
  const raw = await readFile(configPath, "utf-8");
  const parsed = JSON.parse(raw);
  const result = llmConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(formatZodError(result.error));
  }
  currentConfig = result.data as LlmConfig;
  return currentConfig;
};

export const initConfig = async (): Promise<LlmConfig> => {
  const config = await loadConfig();
  if (process.env.CONFIG_WATCH === "1") {
    const configPath = resolveConfigPath();
    watcher?.close();
    watcher = watch(configPath, { persistent: false }, async () => {
      try {
        await loadConfig();
      } catch (error) {
        // Keep previous config; log to stderr for visibility.
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Config reload failed: ${message}\n`);
      }
    });
  }
  return config;
};

export const getConfig = (): LlmConfig => {
  if (!currentConfig) {
    throw new ConfigError("llm.config.json not loaded. Call initConfig() at startup.");
  }
  return currentConfig;
};
