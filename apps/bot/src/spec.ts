export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "RoundTable Bot API",
    version: "1.0.0"
  },
  paths: {
    "/ask": { post: buildOperation("ask") },
    "/audit": { post: buildOperation("audit") },
    "/deep": { post: buildOperation("deep") }
  },
  components: {
    schemas: {
      ChatRequest: {
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
      },
      ChatResponse: {
        type: "object",
        required: ["reply"],
        properties: {
          reply: { type: "string" }
        }
      }
    }
  }
};

function buildOperation(mode: string) {
  return {
    summary: `Proxy to master /api/chat (mode=${mode})`,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ChatRequest" }
        }
      }
    },
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ChatResponse" }
          }
        }
      }
    }
  };
}
