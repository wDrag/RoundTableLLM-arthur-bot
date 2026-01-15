Final System Report (Updated per your verdict)
ZCM Committee Bot v1.1
Discord + Deterministic Master Orchestrator (no master reasoning contribution)
Specialists: Claude Code subagents + GPT-5.2 promptsmith + Grok wildcard

Change log vs v1

- Grok weight: 3% in PROMPT_ENGINEERING, 5% in other (VERBAL/TECHNICAL), 0% in VISUAL
- Invalidity thresholds updated:
  - soft invalidation = 0.60
  - hard invalidation = 0.45
  Meaning:
  - < 0.45: hard invalid -> discard (cannot be merged, excluded from scoring pool)
  - [0.45, 0.60): soft invalid -> quarantine (kept for audit/disagreement blocks, never merged)
  - >= 0.60: valid -> eligible for merge

1) Goals and Constraints
1.1 Goals

- Discord chatbot UX: interact with “Master” like a single LLM.
- Multi-agent quality: specialists produce independent answers.
- Deterministic orchestration: no master content generation or reasoning.
- Numeric scoring: credibility + refusal/quarantine.
- Task-aware weighting by task type.
- Auditability: traceability tags, optional audit output.

1.2 Hard constraints (ZCM)

- Master is code, not an LLM.
- Master cannot add claims, steps, facts, or reasoning.
- Final output is a deterministic function of:
  - agent outputs
  - computed scores
  - weight tables
  - deterministic merge rules (DAA)

1) High-Level Architecture (Option 1)
Discord Bot
  -> Master Orchestrator API (deterministic)
       -> Specialist runners (Claude Code CLI + OpenAI + xAI)
       -> Scoring engine (numeric rubric + optional low-weight PCS)
       -> Hard discard + soft quarantine + weight reallocation
       -> Deterministic assembler (DAA + quarantine filter + disagreement block)
  -> Discord Bot posts response (+ optional audit)

2) Agent Roster (Final)
3.1 Claude Code subagents

- solver-opus (opus): best single-pass structured answer
- implementer-sonnet (sonnet): executable plan + architecture + checks
- adversary-sonnet (sonnet): adversarial critique + failure modes
- verifier-haiku (haiku): requirement coverage + testability + missing info
- visual-sonnet (sonnet): screenshot/UI/diagram analysis (plugin/MCP supported)

3.2 External specialists

- GPT-5.2 promptsmith: prompt engineering + system/agent scaffolding + rubrics
- Grok wildcard fast (text-only): long-context compression + constraints extraction + alternative framings

1) Task Classification (Routing)
TASK_TYPE ∈ {PROMPT_ENGINEERING, VERBAL_REASONING, TECHNICAL_EXECUTION, VISUAL_ANALYSIS, MIXED}

Deterministic routing rules (summary)

- VISUAL_ANALYSIS if images/screenshots referenced or attached
- PROMPT_ENGINEERING if system prompts/agent prompts/rubrics/templates requested
- TECHNICAL_EXECUTION if code/architecture/debugging/repo execution requested
- VERBAL_REASONING otherwise
- MIXED if multiple are material, weights computed by weighted average + normalization

1) Weight Tables (Specialists only, Master weight = 0)
All weights sum to 1.00.

5.1 PROMPT_ENGINEERING (Grok = 0.03)

- GPT-5.2 promptsmith: 0.52
- solver-opus:         0.20
- adversary-sonnet:    0.15
- verifier-haiku:      0.10
- grok-wildcard:       0.03
- implementer-sonnet:  0.00 (only run if prompt explicitly requires executable setup)

5.2 VERBAL_REASONING (Grok = 0.05)

- solver-opus:         0.33
- GPT-5.2 promptsmith: 0.24
- adversary-sonnet:    0.20
- implementer-sonnet:  0.10
- verifier-haiku:      0.08
- grok-wildcard:       0.05

5.3 TECHNICAL_EXECUTION (Grok = 0.05)

- implementer-sonnet:  0.38
- solver-opus:         0.23
- adversary-sonnet:    0.20
- verifier-haiku:      0.11
- GPT-5.2 promptsmith: 0.03
- grok-wildcard:       0.05

5.4 VISUAL_ANALYSIS (Grok = 0.00)

- visual-sonnet:       0.42
- solver-opus:         0.20
- adversary-sonnet:    0.15
- verifier-haiku:      0.18
- GPT-5.2 promptsmith: 0.05
- grok-wildcard:       0.00

5.5 MIXED (deterministic)

- Define subtask shares s_k summing to 1.0
- w_i_raw = Σ_k (s_k * w_i_base(k))
- Normalize: w_i = w_i_raw / Σ_i w_i_raw

1) Specialist Output Schema (Required)
Each agent output must include:
1) Answer Summary (3-7 bullets)
1) Assumptions (decision-relevant)
1) Reasoning (short)
1) Steps/Deliverable
1) Failure Modes/Caveats

Visual agent adds:

- IMAGE_EVIDENCE: [filenames used]
- 1-2 concrete cues confirming image was actually used

1) Scoring System (Numeric)
7.1 Rubric axes (0..25 each)

- Coherence
- Alignment
- Verifiability
- Signal Density
- Compliance (mechanical axis to prevent disallowed operational content from merging)

CredibilityScore = (sum of 5 axes) / 125

7.2 Peer Cross-Scoring (PCS) - low weight
Optional and conditional (used only on close calls/high conflict).
Aggregation:
Cred_i = (1 - λ) *MasterScore_i + λ* PeerMean_i
λ = 0.08 (peers significantly lower than master)

1) Validity / Invalidation Thresholds (your final values)
Two-tier gating applied per agent response:

- Hard invalid threshold τ_hard = 0.45
  If Cred_i < 0.45:
  - DISCARD the response
  - exclude from assembly
  - exclude from disagreement block unless audit mode explicitly requests seeing it

- Soft invalid threshold τ_soft = 0.60
  If 0.45 <= Cred_i < 0.60:
  - QUARANTINE the response
  - never merge its units into the final answer
  - may appear in DISAGREEMENTS or QUARANTINED appendix (audit)

- Valid if Cred_i >= 0.60:
  - eligible for merge (subject to conflict rules + quarantine filter)

Weight reallocation:

- After discards, reallocate weights proportionally across remaining agents (including quarantined agents for scoring, excluding them for merge).
- Merge pool = only VALID agents (>= 0.60).

1) Deterministic Assembly (DAA)
Inputs:

- valid agent outputs (Cred >= 0.60), ranked by WeightedScore_i = Cred_i * w_i'
- requirement checklist Req extracted mechanically from user prompt

Algorithm:

1) Base = top-ranked VALID agent output
2) Extract candidate units from other VALID outputs
3) Merge only units that:
   - do not contradict Base on the same concept
   - increase Req coverage or add specificity without changing meaning
4) Conflicts -> DISAGREEMENTS block (no resolution by master)
5) Every merged unit must include traceability tag:
   [OPUS], [IMPL], [ADV], [HAIKU], [GPT5.2], [GROK]
6) Quarantine filter (mechanical) applied to all candidate units:
   - if unit hits high-risk procedural patterns -> not merged, goes to QUARANTINED

7) Grok Wildcard Rules (as implemented)

- Runs:
  - always permitted in PROMPT_ENGINEERING at 3% weight
  - included in VERBAL/TECHNICAL at 5% weight
  - never in VISUAL
- Role limited to:
  - compression, constraints, unknowns, options (high-level), risk flags
- Even if Grok scores >= 0.60, its units still pass:
  - conflict filter + quarantine filter + deterministic merge rules

1) Master Output Contract (what the Discord bot can request)
Master can return either:
A) Normal response

- Final answer (assembled)
- Disagreements (if any)

B) Audit response (/audit)

- TASK_TYPE + requirements checklist
- Weight table used + post-discard reallocation
- Per-agent axis scores + Cred_i + status (DISCARD / QUARANTINE / VALID)
- WeightedScore ranking
- Quarantined unit snippets and reasons
- Final assembled answer with tags
- Disagreements with tags and scores

1) Operational Controls

- Fast path: solver + verifier only (unless /deep or task requires)
- Deep path: full committee
- PCS triggers only when:
  - top-2 WeightedScores within a small delta OR conflicts detected
- Output caps per section to control token cost and latency
- Optional caching and summarization for long conversations

End of updated report.
