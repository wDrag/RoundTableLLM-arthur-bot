import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getMasterModel, getModelForRole, initConfig } from "@roundtable/core";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

beforeAll(async () => {
  process.chdir(repoRoot);
  process.env.CLAUDE_MODEL_SOLVER = "claude-test-solver";
  process.env.OPENAI_MODEL_PROMPTSMITH = "openai-test";
  process.env.XAI_MODEL_GROK = "xai-test";
  await initConfig();
});

describe("llm.config.json", () => {
  it("resolves model env vars for roles", () => {
    const model = getModelForRole("solver", "TECHNICAL_EXECUTION", "ask");
    expect(model.modelId).toBe("claude-test-solver");
    expect(model.provider).toBe("anthropic");
  });

  it("resolves master model", () => {
    const master = getMasterModel();
    expect(master.modelId).toBe("claude-opus-4-5");
    expect(master.provider).toBe("anthropic");
  });
});
