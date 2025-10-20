// main.ts
import models from "./models.json" with { type: "json" };

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

async function handleChatCompletions(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const stream = !!body.stream;

  if (stream) {
    // SSE 流式示例（最简版）
    const enc = new TextEncoder();
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(
          `data: ${JSON.stringify({
            id: "cmpl_mock",
            choices: [{ delta: { content: "Hello" }, index: 0 }],
          })}\n\n`,
        ));
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(streamBody, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        "connection": "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  }

  // 非流式示例
  return json({
    id: "cmpl_mock",
    object: "chat.completion",
    model: body.model ?? "gpt-5",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: "Hello" },
      },
    ],
  });
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  // 健康检查必须快速 200
  if (pathname === "/" && req.method === "GET") {
    return new Response("OK", { status: 200 });
  }

  if (pathname === "/v1/models" && req.method === "GET") {
    // 直接回 models.json
    return json({ data: models });
  }

  if (pathname === "/v1/chat/completions" && req.method === "POST") {
    return handleChatCompletions(req);
  }

  return new Response("Not Found", { status: 404 });
}