# requirements_v2.md

LLM Committee Bot v2.0
Discord-compatible API + LLM Master orchestration (internal use)

## 0) Status

This document supersedes requirements.md (v1.x). v2 explicitly:

- REMOVES deterministic Master constraint (ZCM)
- REMOVES DAA deterministic assembly requirement
- INSISTS Master is an LLM for routing + orchestration + synthesis

Date: 2026-01-16

---

## 1) Goals

- Discord chatbot UX via external bot repo:
  - /ask, /audit, /deep modes supported by the Master HTTP API
- Multi-agent quality: multiple independent agents, cost-aware
- Trust-minimized via verification gates and auditability (not strict determinism)
- Simple ops: Docker-first on Ubuntu VPS
- Model agility: switch providers/models via llm.config.json + env vars (no code edits)

---

## 2) Non-goals

- Perfect determinism across runs (LLM Master is non-deterministic by nature)
- Benchmark harness / paper reproduction (out of scope)

---

## 3) Hard constraints (v2)

### 3.1 Master must be an LLM

Master responsibilities:

- Determine task type and output shape
- Decide which agents to wake and how many rounds to run
- Synthesize the final reply
- Produce audit appendix for /audit and /deep

### 3.2 Interaction guardrail (hard)

- If c_final >= 0.70: ship response immediately
- If c_final < 0.70: ask exactly ONE blocking question with A/B/C options, then stop

### 3.3 Budget policy (hard)

- /ask and /audit: default capUsd = 0.10 (best-effort, enforced by call limiting)
- /deep: default capUsd = 0.50 (configurable by env)

### 3.4 Security hygiene (hard)

- No secrets committed
- Never log raw Authorization tokens
- Use .env.example, not .env in repo

---

## 4) Mandatory output contract (all modes)

Always include:

1) TL;DR (1-3 lines)
2) Main answer (Markdown)
3) Assumptions ledger (bullets)
4) Confidence score (0..1)
5) If a plan exists: Execution time estimate section (see 4.2)

### 4.1 Mode specifics

- /ask: concise; still include acceptance tests if task is buildable
- /audit: include FULL audit appendix
- /deep: expanded committee + FULL audit appendix; may run extra rounds

### 4.2 Mandatory execution time estimate on plans (hard)

Whenever the reply includes a PLAN (ordered steps, roadmap, runbook, implementation steps),
include:

### Execution time estimate

- Unit: minutes or hours (consistent)
- Per-step (3-point):
  - Step k: O=?, M=?, P=?, E=? where E = (O + 4M + P) / 6
- Total:
  - O_total=?, M_total=?, P_total=?, E_total=? (sum)
- Assumptions:
  - bullets
- Risks that push to P:
  - bullets
- Confidence in estimate: 0.00-1.00

---

## 5) API contract

POST /api/chat
Request:
{
  "source": "discord" | "cli" | "http",
  "mode": "ask" | "audit" | "deep",
  "user": { "id": string, "name": string },
  "context": { "channelId"?: string, "guildId"?: string, "messageId"?: string },
  "message": string,
  "attachments"?: [{ "filename": string, "url": string, "contentType"?: string }]
}

Response:
{
  "reply": string,
  "meta": {
    "taskType": "PROMPT_ENGINEERING"|"VERBAL_REASONING"|"TECHNICAL_EXECUTION"|"VISUAL_ANALYSIS"|"MIXED",
    "c_final": number,
    "budget": { "capUsd": number, "estimatedUsd": number, "modeCapExceeded": boolean },
    "usedAgents": string[],
    "invalidation": { "discarded": string[], "quarantined": string[], "valid": string[] }
  },
  "audit"?: { ... } // only for audit/deep
}

---

## 6) Configuration: llm.config.json (hard)

- Repo root must include llm.config.json
- All provider+model selection is config-driven
- Model strings in config are ENV VAR NAMES, resolved at runtime:
  - modelId = process.env[config.models.roles.solver.model]

Must support:

- providers: anthropic enabled now; openai/xai as disabled placeholders
- roles: master + agent roles (solver/critic/verifier/editor/impl/visual/etc.)
- policy: caps and thresholds (normalMaxUsd, deepMaxUsd, askUserThreshold, tauHard, tauSoft)

---

## 7) Orchestration (LLM Master)

### 7.1 Two-phase Master calls (recommended)

Phase A: OrchestrationPlan JSON (strict)

- Input: user request + deterministic hints (attachments, code fences)
- Output (JSON):
  {
    "taskType": "...",
    "agentsToRun": [...],
    "rounds": 1|2|3,
    "needsClarification": boolean,
    "clarificationQuestion"?: { "question": string, "options": ["A ...","B ...","C ..."] },
    "outputShape": "ask"|"audit"|"deep"
  }

Phase B: FinalSynthesis JSON (strict)

- Input: user request + agent outputs + scores + statuses
- Output (JSON):
  {
    "replyMarkdown": string,
    "meta": { ... },
    "audit": { ... }
  }

### 7.2 Deterministic pre-hints (non-authoritative)

Implement a cheap deterministic hint generator:

- attachments/images => hint VISUAL_ANALYSIS
- prompt/rubric/template keywords => hint PROMPT_ENGINEERING
- code/architecture/debug/deploy => hint TECHNICAL_EXECUTION
Master may override.

---

## 8) Agents

Always-on core (default):

- solver
- critic
- verifier

Optional:

- editor (more likely in audit/deep)
- implementer (technical tasks)
- visual (if images)
- future: promptsmith (OpenAI), grok (xAI) behind feature flags

Each agent MUST output strict JSON:
{
  "agent": "...",
  "answerSummary": string[],
  "assumptions": string[],
  "reasoning": string,
  "stepsOrDeliverables": string[],
  "failureModes": string[],
  "units": [{ "id": string, "topic": string, "text": string, "tags": string[] }],
  "selfConfidence": number
}

---

## 9) Scoring + invalidation (governance signals)

Keep numeric scoring with 5 axes (0..25):

- Coherence, Alignment, Verifiability, SignalDensity, Compliance
Cred_i = sum / 125

Thresholds (status labels):

- Cred_i < tauHard => DISCARD
- tauHard <= Cred_i < tauSoft => QUARANTINE
- Cred_i >= tauSoft => VALID

IMPORTANT (v2):

- These statuses DO NOT drive deterministic assembly.
- Master synthesis MUST:
  - Prefer VALID outputs
  - Ignore DISCARD outputs
  - Use QUARANTINE only if explicitly justified in audit ("why using quarantined material")

---

## 10) Final confidence (c_final)

Compute c_final as:

- BaseScore = weighted mean of VALID Cred_i (weights from config)
- conflictPenalty and coverageBonus may be estimated by Master but MUST be logged in audit

Ask-user rule uses c_final as defined in section 3.2.

---

## 11) Audit appendix (required for /audit and /deep)

Audit must include:

- OrchestrationPlan JSON (the master’s plan)
- Agent list used + per-agent latency
- Per-agent axis scores, Cred_i, status (DISCARD/QUARANTINE/VALID)
- Disagreements summary if agents conflict on key items
- Budget estimate inputs/outputs
- If a plan exists: the Execution time estimate object
- If quarantined content used: explicit justification

---

## 12) Storage / logging

- sqlite DB recommended:
  - request payload
  - orchestration plan
  - agent outputs
  - scores/statuses
  - final reply + audit appendix
- Store DB under ./data mounted volume in Docker
- Add requestId to logs; never log secrets

---

## 13) Deployment

- Docker-first on Ubuntu VPS
- Provide:
  - docker-compose.master.yml running ONLY the master service
  - /health endpoint
  - .env.example

---

## 14) Testing (v2, non-deterministic)

Replace byte-identical golden tests with invariants:

- Schema validation tests:
  - OrchestrationPlan JSON valid
  - Agent JSON valid
  - FinalSynthesis JSON valid
- Content invariants:
  - TL;DR present
  - Assumptions present
  - Confidence present
  - If plan exists => Execution time estimate present
  - DISCARD outputs are never referenced
  - QUARANTINE usage requires explicit audit justification
- Ask-user behavior:
  - If c_final < 0.70 => exactly one A/B/C question and stop
  - else no questions

---

## 15) Migration notes (v1 -> v2)

- Delete or deprecate DAA merge module
- Keep scoring engine but reinterpret as governance signals
- Introduce MasterSynthesizer LLM call (phase B)
- Update tests from determinism to invariants
- Update docs and .env.example accordingly

End of requirements_v2.md
