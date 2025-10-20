// main.ts
import models from "./models.json" with { type: "json" };
import {
  getAccessToken,
  createPrompt,
  initiatePromptRun,
  createStreamingResponse,
} from "./langfast_client.ts";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

async function handleChatCompletions(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const stream = !!body.stream;
  const model = body.model ?? "gpt-5";
  const messages = Array.isArray(body.messages) ? body.messages : [];

  try {
    const { accessToken, userId } = await getAccessToken();
    const promptId = await createPrompt(accessToken, model, messages);
    const { run_id, jobs } = await initiatePromptRun(
      accessToken,
      promptId,
      userId,
      model,
      messages,
    );
    const jobId = jobs[0]?.job_id;
    if (!jobId) {
      return json({ error: "no job id returned" }, { status: 500 });
    }

    const sseStream = await createStreamingResponse(
      accessToken,
      jobId,
      run_id,
      model,
    );

    if (stream) {
      return new Response(sseStream, {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          "connection": "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    } else {
      // Non-streaming: consume the stream and aggregate the response
      const reader = sseStream.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let finish_reason = "stop"; // default

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // SSE messages are separated by double newlines
        const lines = chunk.split("\n\n").filter(line => line.startsWith("data: "));

        for (const line of lines) {
          const data = line.substring("data: ".length);
          if (data === "[DONE]") {
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0].delta?.content) {
              fullContent += parsed.choices[0].delta.content;
            }
            if (parsed.choices && parsed.choices[0].finish_reason) {
              finish_reason = parsed.choices[0].finish_reason;
            }
          } catch (e) {
            // Ignore parsing errors for potentially incomplete JSON chunks
          }
        }
      }

      return json({
        id: run_id,
        object: "chat.completion",
        model,
        choices: [{
          index: 0,
          finish_reason: finish_reason,
          message: { role: "assistant", content: fullContent },
        }],
      });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return json({ error: errorMessage }, { status: 500 });
  }
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  // 健康检查必须快速 200
  if (pathname === "/" && req.method === "GET") {
    return new Response("OK", { status: 200 });
  }

  if (pathname === "/v1/models" && req.method === "GET") {
    // 转换为 OpenAI 格式
    const data = models.map((model) => ({
      id: model.slug,
      object: "model",
      created: Math.floor(new Date(model.created_at).getTime() / 1000),
      owned_by: model.provider,
    }));
    return json({ object: "list", data });
  }

  if (pathname === "/v1/chat/completions" && req.method === "POST") {
    const userSetKey = Deno.env.get("USER_SET_KEY");
    
    if (userSetKey) {
      const authHeader = req.headers.get("Authorization");
      
      if (!authHeader) {
        return json({ error: "Missing Authorization header" }, { status: 401 });
      }
      
      const expectedAuth = `Bearer ${userSetKey}`;
      if (authHeader !== expectedAuth) {
        return json({ error: "Invalid authorization token" }, { status: 401 });
      }
    }
    
    return handleChatCompletions(req);
  }

  return new Response("Not Found", { status: 404 });
}