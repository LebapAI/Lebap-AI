const { v4: uuidv4 } = require("uuid");
const { Document } = require("../../../models/documents");
const { Telemetry } = require("../../../models/telemetry");
const { Workspace } = require("../../../models/workspace");
const { getEmbeddingEngineSelection } = require("../../../utils/helpers");
const { reqBody } = require("../../../utils/http");
const { validApiKey } = require("../../../utils/middleware/validApiKey");
const { apiKeyOwnerIsAdmin } = require("../../../utils/middleware/apiKeyOwnerIsAdmin");
const { EventLogs } = require("../../../models/eventLogs");
const { ApiUsage } = require("../../../models/apiUsage");
const { usageMeteringEnabled, usageMetricsFromChatResult } = require("../../../utils/apiUsageMetering");
const {
  OpenAICompatibleChat,
} = require("../../../utils/chats/openaiCompatible");
const { getModelTag } = require("../../utils");
const { extractTextContent, extractAttachments } = require("./helpers");
const { handleImageGenUpload } = require("../../../utils/files/multer");

function isWorkspaceAllowed(response, workspaceSlug) {
  const allowlist = response.locals?.apiKey?.workspaceSlugs;
  return allowlist === null || allowlist === undefined || allowlist.includes(workspaceSlug);
}

async function finalizeUsageSafely(payload) {
  try {
    await ApiUsage.finalize(payload);
  } catch (_error) {
    // Observe-only rollout: metering failures must not break a completed chat.
    console.error("API usage event finalization failed.");
  }
}

function apiOpenAICompatibleEndpoints(app) {
  if (!app) return;

  app.get("/v1/openai/models", [validApiKey, apiKeyOwnerIsAdmin], async (_, response) => {
    /*
    #swagger.tags = ['OpenAI Compatible Endpoints']
    #swagger.description = 'Get all available "models" which are workspaces you can use for chatting.'
    #swagger.responses[200] = {
      content: {
        "application/json": {
          "schema": {
            "type": "object",
            "example": {
              "object": "list",
              "data": [
                {
                  "id": "model-id-0",
                  "object": "model",
                  "created": 1686935002,
                  "owned_by": "organization-owner"
                },
                {
                  "id": "model-id-1",
                  "object": "model",
                  "created": 1686935002,
                  "owned_by": "organization-owner"
                }
              ]
            }
          }
        }
      }
    }
    #swagger.responses[403] = {
      schema: {
        "$ref": "#/definitions/InvalidAPIKey"
      }
    }
    */
    try {
      const data = [];
      const workspaces = await Workspace.where();
      const allowlist = response.locals?.apiKey?.workspaceSlugs;
      const visibleWorkspaces = Array.isArray(allowlist)
        ? workspaces.filter((workspace) => allowlist.includes(workspace.slug))
        : workspaces;
      for (const workspace of visibleWorkspaces) {
        data.push({
          id: workspace.slug,
          object: "model",
          created: Math.floor(Number(new Date(workspace.createdAt)) / 1000),
          owned_by: workspace?.chatProvider || process.env.LLM_PROVIDER,
        });
      }
      return response.status(200).json({
        object: "list",
        data,
      });
    } catch (e) {
      console.error(e.message, e);
      response.sendStatus(500).end();
    }
  });

  app.post(
    "/v1/openai/chat/completions",
    [validApiKey, apiKeyOwnerIsAdmin],
    async (request, response) => {
      let usageEvent = null;
      const usageStartedAt = Date.now();
      let clientDisconnected = false;
      response.once("close", () => {
        if (!response.writableEnded) clientDisconnected = true;
      });
      /*
      #swagger.tags = ['OpenAI Compatible Endpoints']
      #swagger.description = 'Execute a chat with a workspace with OpenAI compatibility. Supports streaming as well. Model must be a workspace slug from /models.'
      #swagger.requestBody = {
          description: 'Send a prompt to the workspace with full use of documents as if sending a chat in AnythingLLM. Only supports some values of OpenAI API. See example below.',
          required: true,
          content: {
            "application/json": {
              example: {
                messages: [
                {"role":"system", content: "You are a helpful assistant"},
                {"role":"user", content: "What is AnythingLLM?"},
                {"role":"assistant", content: "AnythingLLM is...."},
                {"role":"user", content: "Follow up question..."}
                ],
                model: "sample-workspace",
                stream: true,
                temperature: 0.7
              }
            }
          }
        }
      #swagger.responses[403] = {
        schema: {
          "$ref": "#/definitions/InvalidAPIKey"
        }
      }
      */
      try {
        const {
          model,
          messages,
          temperature,
          stream = false,
        } = reqBody(request);

        // Validate the OpenAI-compatible request before workspace lookup or
        // mutating the message list. Malformed payloads should fail as 400s,
        // not turn into misleading 401s or runtime exceptions.
        if (
          typeof model !== "string" ||
          model.trim().length === 0 ||
          !Array.isArray(messages) ||
          messages.length === 0
        ) {
          return response.status(400).json({
            error: {
              message: "A non-empty model string and non-empty messages array are required.",
              type: "invalid_request_error",
            },
          });
        }

        const workspace = await Workspace.get({ slug: model.trim() });
        if (!workspace) return response.status(404).json({
          error: { message: "Workspace not found.", type: "invalid_request_error" },
        });
        if (!isWorkspaceAllowed(response, workspace.slug)) {
          return response.status(403).json({
            error: { message: "API key is not authorized for this workspace.", type: "permission_error" },
          });
        }

        const userMessage = messages[messages.length - 1];
        if (userMessage?.role !== "user") {
          return response.status(400).json({
            id: uuidv4(),
            type: "abort",
            textResponse: null,
            sources: [],
            close: true,
            error:
              "No user prompt found. Must be last element in message array with 'user' role.",
          });
        }

        const systemPrompt =
          extractTextContent(
            messages.find((chat) => chat.role === "system")?.content
          ) ?? null;
        const history = messages.filter((chat) => chat.role !== "system") ?? [];

        // Feature-flagged, observe-only usage capture. Use a server-generated
        // ledger ID so caller-supplied request IDs cannot collide with it.
        if (usageMeteringEnabled()) {
          try {
            usageEvent = {
              requestId: uuidv4(),
              apiKeyId: response.locals?.apiKey?.id ?? null,
              route: "/v1/openai/chat/completions",
              operation: stream ? "chat.completion.stream" : "chat.completion",
              provider: workspace.chatProvider ?? process.env.LLM_PROVIDER ?? null,
              model: workspace.chatModel ?? workspace.slug,
              workspaceSlug: workspace.slug,
            };
            await ApiUsage.createStarted(usageEvent);
          } catch (_error) {
            usageEvent = null;
            console.error("API usage event creation failed; chat will continue.");
          }
        }

        if (!stream) {
          const chatResult = await OpenAICompatibleChat.chatSync({
            workspace,
            systemPrompt,
            history,
            prompt: extractTextContent(userMessage.content),
            attachments: extractAttachments(userMessage.content),
            temperature,
          });

          await Telemetry.sendTelemetry("sent_chat", {
            LLMSelection:
              workspace.chatProvider ?? process.env.LLM_PROVIDER ?? "openai",
            Embedder: process.env.EMBEDDING_ENGINE || "inherit",
            VectorDbSelection: process.env.VECTOR_DB || "lancedb",
            TTSSelection: process.env.TTS_PROVIDER || "native",
          });
          await EventLogs.logEvent("api_sent_chat", {
            workspaceName: workspace?.name,
            chatModel: workspace?.chatModel || "System Default",
          });
          if (usageEvent) {
            await finalizeUsageSafely({
              requestId: usageEvent.requestId,
              status: "completed",
              latencyMs: Math.max(0, Date.now() - usageStartedAt),
              ...usageMetricsFromChatResult(chatResult),
            });
          }
          return response.status(200).json(chatResult);
        }

        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Connection", "keep-alive");
        response.flushHeaders();

        await OpenAICompatibleChat.streamChat({
          workspace,
          systemPrompt,
          history,
          prompt: extractTextContent(userMessage.content),
          attachments: extractAttachments(userMessage.content),
          temperature,
          response,
        });
        await Telemetry.sendTelemetry("sent_chat", {
          LLMSelection: process.env.LLM_PROVIDER || "openai",
          Embedder: process.env.EMBEDDING_ENGINE || "inherit",
          VectorDbSelection: process.env.VECTOR_DB || "lancedb",
          TTSSelection: process.env.TTS_PROVIDER || "native",
          LLMModel: getModelTag(),
        });
        await EventLogs.logEvent("api_sent_chat", {
          workspaceName: workspace?.name,
          chatModel: workspace?.chatModel || "System Default",
        });
        response.end();
        if (usageEvent) {
          await finalizeUsageSafely({
            requestId: usageEvent.requestId,
            status: clientDisconnected ? "aborted" : "completed",
            latencyMs: Math.max(0, Date.now() - usageStartedAt),
            costSource: "unknown",
          });
        }
      } catch (e) {
        if (usageEvent) {
          await finalizeUsageSafely({
            requestId: usageEvent.requestId,
            status: clientDisconnected ? "aborted" : "failed",
            latencyMs: Math.max(0, Date.now() - usageStartedAt),
            errorCategory: "provider_or_chat_error",
            costSource: "unknown",
          });
        }
        console.error(e.message, e);
        if (response.headersSent) return response.end();
        return response.status(500).end();
      }
    }
  );

  app.post(
    "/v1/openai/images/generations",
    [validApiKey, apiKeyOwnerIsAdmin, handleImageGenUpload],
    async (request, response) => {
      /*
      #swagger.tags = ['OpenAI Compatible Endpoints']
      #swagger.description = 'Generate or edit an image using the system-configured image generation provider. Send a multipart/form-data request with a "prompt" field and an optional "size" field. To edit an existing image, attach one or more files as "image_references" — when present, the request is automatically routed to the provider image editing endpoint. Returns the image as a base64 PNG. If the provider does not support reference images (e.g. Ollama), the request fails with a descriptive error.'
      #swagger.consumes = ['multipart/form-data']
      #swagger.parameters['prompt'] = {
        in: 'formData',
        description: 'Text prompt describing the image to generate or the edit to apply.',
        required: true,
        type: 'string'
      }
      #swagger.parameters['size'] = {
        in: 'formData',
        description: "Image dimensions (e.g. 1024x1024). Defaults to the system IMAGE_GEN_SIZE_PREF setting.",
        required: false,
        type: 'string'
      }
      #swagger.parameters['image_references'] = {
        in: 'formData',
        description: 'Optional reference image file(s) for editing. When provided, the request is routed to the edit endpoint instead of generation.',
        required: false,
        type: 'file'
      }
      #swagger.parameters['response_format'] = {
        in: 'formData',
        description: "Response format: b64_json (default) returns base64-encoded image data in JSON, blob returns the raw image bytes with content-type image/png.",
        required: false,
        type: 'string',
        default: 'b64_json',
        enum: ['b64_json', 'blob']
      }
      #swagger.responses[403] = {
        schema: {
          "$ref": "#/definitions/InvalidAPIKey"
        }
      }
      */
      try {
        const prompt = request.body?.prompt;
        const size = request.body?.size;
        const responseFormat = request.body?.response_format || "b64_json";
        if (!prompt || !String(prompt).trim().length)
          return response.status(400).json({ error: "A prompt is required." });

        const abortController = new AbortController();
        response.on("close", () => abortController.abort());
        const signal = abortController.signal;

        const imageBuffers = (request.files || []).map((f) => f.buffer);
        const {
          generateImageForWorkspace,
          editImageForWorkspace,
        } = require("../../../utils/ImageGenerators");

        const result =
          imageBuffers.length > 0
            ? await editImageForWorkspace({
                prompt: String(prompt),
                images: imageBuffers,
                size: size ? String(size) : undefined,
                signal,
              })
            : await generateImageForWorkspace({
                prompt: String(prompt),
                size: size ? String(size) : undefined,
                signal,
              });

        if (responseFormat === "blob") {
          if (result.notice)
            response.setHeader("X-Image-Notice", result.notice);
          response.setHeader("Content-Type", "image/png");
          response.setHeader(
            "Content-Disposition",
            `inline; filename="${result.storageFilename}"`
          );
          return response.status(200).end(result.buffer);
        }

        return response.status(200).json({
          data: [{ b64_json: result.buffer.toString("base64") }],
          ...(result.notice && { notice: result.notice }),
        });
      } catch (e) {
        const { isAbortError } = require("../../../utils/helpers/abortSignals");
        if (isAbortError(e)) return response.end();
        console.error("OpenAI-compatible image generation failed.", e);
        return response.status(500).json({
          error: "Image generation failed. Check server logs for details.",
        });
      }
    }
  );

  app.post(
    "/v1/openai/embeddings",
    [validApiKey, apiKeyOwnerIsAdmin],
    async (request, response) => {
      /*
      #swagger.tags = ['OpenAI Compatible Endpoints']
      #swagger.description = 'Get the embeddings of any arbitrary text string. This will use the embedder provider set in the system. Please ensure the token length of each string fits within the context of your embedder model.'
      #swagger.requestBody = {
          description: 'The input string(s) to be embedded. If the text is too long for the embedder model context, it will fail to embed. The vector and associated chunk metadata will be returned in the array order provided',
          required: true,
          content: {
            "application/json": {
              example: {
                input: [
                "This is my first string to embed",
                "This is my second string to embed",
                ],
                model: null,
              }
            }
          }
        }
      #swagger.responses[403] = {
        schema: {
          "$ref": "#/definitions/InvalidAPIKey"
        }
      }
      */
      try {
        const body = reqBody(request);
        // Support input or "inputs" (for backwards compatibility) as an array of strings or a single string
        // TODO: "inputs" key support will eventually be fully removed.
        let input = body?.input || body?.inputs || [];
        // if input is not an array, make it an array and force to string content
        if (!Array.isArray(input)) input = [String(input)];

        if (Array.isArray(input)) {
          if (input.length === 0)
            throw new Error("Input array cannot be empty.");
          const validArray = input.every((text) => typeof text === "string");
          if (!validArray)
            throw new Error("All inputs to be embedded must be strings.");
        }

        const Embedder = getEmbeddingEngineSelection();
        const embeddings = await Embedder.embedChunks(input);
        const data = [];
        embeddings.forEach((embedding, index) => {
          data.push({
            object: "embedding",
            embedding,
            index,
          });
        });

        return response.status(200).json({
          object: "list",
          data,
          model: Embedder.model,
        });
      } catch (e) {
        console.error(e.message, e);
        response.status(500).end();
      }
    }
  );

  app.get(
    "/v1/openai/vector_stores",
    [validApiKey, apiKeyOwnerIsAdmin],
    async (request, response) => {
      /*
      #swagger.tags = ['OpenAI Compatible Endpoints']
      #swagger.description = 'List all the vector database collections connected to AnythingLLM. These are essentially workspaces but return their unique vector db identifier - this is the same as the workspace slug.'
      #swagger.responses[200] = {
        content: {
          "application/json": {
            "schema": {
              "type": "object",
              "example": {
                "data": [
                  {
                    "id": "slug-here",
                    "object": "vector_store",
                    "name": "My workspace",
                    "file_counts": {
                      "total": 3
                    },
                    "provider": "LanceDB"
                  }
                ]
              }
            }
          }
        }
      }
      #swagger.responses[403] = {
        schema: {
          "$ref": "#/definitions/InvalidAPIKey"
        }
      }
      */
      try {
        // We dump all in the first response and despite saying there is
        // not more data the library still checks with a query param so if
        // we detect one - respond with nothing.
        if (Object.keys(request?.query ?? {}).length !== 0) {
          return response.status(200).json({
            data: [],
            has_more: false,
          });
        }

        const data = [];
        const VectorDBProvider = process.env.VECTOR_DB || "lancedb";
        const workspaces = await Workspace.where();

        for (const workspace of workspaces) {
          data.push({
            id: workspace.slug,
            object: "vector_store",
            name: workspace.name,
            file_counts: {
              total: await Document.count({
                workspaceId: Number(workspace.id),
              }),
            },
            provider: VectorDBProvider,
          });
        }
        return response.status(200).json({
          first_id: [...data].splice(0)?.[0]?.id,
          last_id: [...data].splice(-1)?.[0]?.id ?? data.splice(1)?.[0]?.id,
          data,
          has_more: false,
        });
      } catch (e) {
        console.error(e.message, e);
        response.status(500).end();
      }
    }
  );
}

module.exports = { apiOpenAICompatibleEndpoints };
