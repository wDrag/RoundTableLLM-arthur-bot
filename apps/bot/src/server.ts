import Fastify from "fastify";
import cors from "@fastify/cors";
import { openApiSpec } from "@/spec.js";

const app = Fastify({ logger: true });

const requestSchema = {
  type: "object",
  required: ["source", "user", "message"],
  properties: {
    source: { type: "string" },
    user: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        name: { type: "string" }
      }
    },
    context: { type: "string" },
    message: { type: "string" },
    attachments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string" },
          url: { type: "string" }
        }
      }
    }
  }
};

const responseSchema = {
  type: "object",
  required: ["reply"],
  properties: {
    reply: { type: "string" }
  }
};

const forward = async (mode: "ask" | "audit" | "deep", payload: unknown): Promise<unknown> => {
  const baseUrl = process.env.MASTER_BASE_URL ?? "http://localhost:8787";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.MASTER_API_KEY
        ? { Authorization: `Bearer ${process.env.MASTER_API_KEY}` }
        : {})
    },
    body: JSON.stringify({ ...(payload as object), mode })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Master error ${response.status}: ${text}`);
  }
  return response.json();
};

const registerRoute = (mode: "ask" | "audit" | "deep"): void => {
  app.post(
    `/${mode}`,
    { schema: { body: requestSchema, response: { 200: responseSchema } } },
    async (request, reply) => {
      const data = await forward(mode, request.body);
      return reply.send(data);
    }
  );
};

const runBot = async (): Promise<void> => {
  await app.register(cors, { origin: true });
  app.get("/openapi.json", async () => openApiSpec);
  app.get("/health", async () => ({ ok: true }));

  registerRoute("ask");
  registerRoute("audit");
  registerRoute("deep");

  const port = Number(process.env.BOT_PORT ?? 8788);
  await app.listen({ port, host: "0.0.0.0" });
};

runBot().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
