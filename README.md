# RoundTable LLM Orchestrator

Production-ready LLM Master orchestrator for Discord-compatible payloads.

## Quickstart (Docker)

```bash
docker compose -f docker-compose.master.yml up -d
```

Health check:

```bash
curl http://localhost:8787/health
```

## Change models via llm.config.json

1) Edit llm.config.json to select provider and model IDs per role.
2) If you prefer env indirection, set an env var with the same name and it will be used instead.
3) Restart services (or set CONFIG_WATCH=1 for live reload).

Note: Provider keys and versions are configured via env var names in llm.config.json and resolved from .env.

## API (Master)

Master endpoint: POST /api/chat

### Request body (ChatRequest)

```json
{
  "source": "discord|api|...",
  "mode": "ask|audit|deep",
  "user": { "id": "string", "name": "string" },
  "context": { "channelId": "string", "guildId": "string", "messageId": "string" },
  "message": "string",
  "attachments": [
    { "filename": "string", "url": "string", "contentType": "string" }
  ]
}
```

### Datatype requirements (ChatRequest)

Required fields:

- source: string (non-empty recommended)
- mode: string enum, one of: ask | audit | deep
- user: object
  - id: string (required, non-empty)
  - name: string (optional)
- message: string (required, non-empty)

Optional fields:

- context: object
  - channelId: string (optional)
  - guildId: string (optional)
  - messageId: string (optional)
- attachments: array of objects
  - filename: string (required)
  - url: string (required)
  - contentType: string (optional; MIME type)

Headers:

- Content-Type: application/json
- Authorization: Bearer <MASTER_API_KEY> (required only when MASTER_API_KEY is set)

### Response body (ChatResponse)

```json
{
  "reply": "string",
  "meta": {
    "taskType": "PROMPT_ENGINEERING|VERBAL_REASONING|TECHNICAL_EXECUTION|VISUAL_ANALYSIS|MIXED",
    "c_final": 0.82,
    "budget": { "capUsd": 0.1, "estimatedUsd": 0.06, "modeCapExceeded": false },
    "usedAgents": ["solver", "critic", "verifier"],
    "invalidation": {
      "discarded": [],
      "quarantined": ["critic"],
      "valid": ["solver", "verifier"]
    }
  },
  "audit": { }
}
```

### Datatype requirements (ChatResponse)

- reply: string (always present; structured Markdown)
- meta: object (always present)
- audit: object (present for audit/deep)

### Reply content by mode

The `reply` field is a single Markdown string that always includes:

- TL;DR (1–3 lines)
- Main answer
- Assumptions ledger
- Confidence score
- If a plan exists: Execution time estimate section

Mode-specific additions:

- ask: concise; may include acceptance tests if buildable.
- audit: full audit appendix.
- deep: expanded committee + full audit appendix; may include extra rounds.

## Environment variables

See .env.example for required variables.

Checklist (minimum for master LLM):

- ANTHROPIC_API_KEY
- ANTHROPIC_VERSION
- CLAUDE_MODEL_MASTER
- CLAUDE_MODEL_SOLVER
- CLAUDE_MODEL_CRITIC
- CLAUDE_MODEL_VERIFIER

Optional:

- OPENAI_API_KEY (if enabling OpenAI)
- XAI_API_KEY (if enabling xAI)
- MASTER_API_KEY (protect /api/chat)

## Smoke tests

1) Health check:

- curl <http://localhost:8787/health>

1) Chat request (requires model env vars):

- curl -X POST <http://localhost:8787/api/chat> \
    -H 'Content-Type: application/json' \
    -d '{"source":"http","mode":"ask","user":{"id":"test"},"message":"Say hello"}'

## Repo layout

``` structure
/
  llm.config.json
  .env.example
  docker-compose.master.yml
  /apps
    /master
  /packages
    /core
    /providers
    /runners
    /prompts
    /tests
```

## References

- <https://arxiv.org/pdf/2305.14325>
