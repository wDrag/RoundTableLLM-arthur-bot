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

### Response body (ChatResponse)

```json
{ "reply": "string" }
```

## Environment variables

See .env.example for required variables.

## Repo layout

```
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
