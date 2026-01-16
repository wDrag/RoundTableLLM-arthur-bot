# RoundTable LLM Orchestrator

Production-ready deterministic master orchestrator with an OpenAPI-first bot gateway.

## Quickstart (Docker)

```bash
docker compose up -d
```

Health check:

```bash
curl http://localhost:8787/health
```

## Change models via llm.config.json

1) Edit llm.config.json to select provider and model env-var names per role.
2) Set the corresponding environment variables (e.g., CLAUDE_MODEL_SOLVER).
3) Restart services (or set CONFIG_WATCH=1 for live reload).

## API (OpenAPI)

- Bot OpenAPI document: <http://localhost:8788/openapi.json>
- Master endpoint: POST /api/chat

### Request body (ChatRequest)

```json
{
  "source": "discord|api|...",
  "mode": "ask|audit|deep",
  "user": { "id": "string", "name": "string" },
  "context": "string",
  "message": "string",
  "attachments": [
    { "name": "string", "type": "string", "url": "string" }
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

- context: string
- attachments: array of objects
  - name: string (optional)
  - type: string (optional; use MIME type, e.g. image/png)
  - url: string (optional; URL or reference)

Headers:

- Content-Type: application/json
- Authorization: Bearer <MASTER_API_KEY> (required only when MASTER_API_KEY is set)

### Response body (ChatResponse)

```json
{ "reply": "string" }
```

### Datatype requirements (ChatResponse)

- reply: string (always present)

## Environment variables

See .env.example for required variables.

## Repo layout

``` structure
/
  llm.config.json
  .env.example
  docker-compose.yml
  /apps
    /bot
    /master
  /packages
    /core
    /providers
    /runners
    /prompts
    /tests
```
