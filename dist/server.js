import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "crypto";
import { z } from "zod";
import { aggregateWithMaster } from "./agents/aggregate.js";
import { routeAgents } from "./agents/router.js";
import { runAgents } from "./agents/runner.js";
import {} from "./agents/types.js";
const chatSchema = z
    .object({
    source: z.literal("discord"),
    user: z.object({ id: z.string(), name: z.string() }),
    context: z
        .object({
        channelId: z.string().optional(),
        guildId: z.string().optional(),
    })
        .optional(),
    message: z.string().min(1),
})
    .strict();
const logLevel = process.env.LOG_LEVEL ?? "info";
const fastify = Fastify({
    logger: {
        level: logLevel,
    },
    genReqId: () => randomUUID(),
});
await fastify.register(cors, { origin: true });
fastify.get("/health", async () => ({ ok: true }));
fastify.post("/api/chat", async (request, reply) => {
    const authKey = process.env.MASTER_API_KEY;
    if (authKey) {
        const authorization = request.headers.authorization;
        const token = authorization?.startsWith("Bearer ")
            ? authorization.slice("Bearer ".length)
            : undefined;
        if (!token || token !== authKey) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
    }
    const parsed = chatSchema.safeParse(request.body);
    if (!parsed.success) {
        request.log.warn({ requestId: request.id, issues: parsed.error.issues }, "Invalid chat payload");
        return reply.status(400).send({ error: "Invalid payload" });
    }
    const payload = parsed.data;
    const normalizedContext = `Discord context: guildId=${payload.context?.guildId ?? "unknown"}, channelId=${payload.context?.channelId ?? "unknown"}`;
    const context = {
        source: payload.source,
        message: payload.message,
        user: payload.user,
        discordContext: payload.context,
        normalizedContext,
        requestId: String(request.id ?? randomUUID()),
    };
    const plan = routeAgents(payload.message);
    request.log.info({ requestId: context.requestId, plan }, "Agent routing plan");
    const { outputs, timings } = await runAgents(plan, context, request.log);
    request.log.info({ requestId: context.requestId, timings }, "Agent timings");
    const aggregated = await aggregateWithMaster(outputs, payload.message, context.requestId);
    request.log.info({ requestId: context.requestId, useCase: aggregated.useCase }, "Master categorization");
    const replyText = aggregated.reply || "I am here to help.";
    return { reply: replyText };
});
const port = Number(process.env.PORT ?? 8000);
const host = "0.0.0.0";
fastify
    .listen({ port, host })
    .then(() => {
    fastify.log.info({ port }, "Master service listening");
})
    .catch((error) => {
    fastify.log.error({ err: error }, "Failed to start server");
    process.exit(1);
});
