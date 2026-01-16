import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getModelForRole, initConfig } from "@roundtable/core";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

beforeAll(async () => {
  process.chdir(repoRoot);
  process.env.CLAUDE_MODEL_SOLVER = "claude-test-solver";
  process.env.CLAUDE_MODEL_CRITIC = "claude-test-critic";
  process.env.CLAUDE_MODEL_VERIFIER = "claude-test-verifier";
  process.env.CLAUDE_MODEL_IMPL = "claude-test-impl";
  process.env.CLAUDE_MODEL_VISUAL = "claude-test-visual";
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
});
