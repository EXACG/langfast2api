import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import modelsData from "./models.json" with { type: "json" };
import { getAccessToken, createPrompt, initiatePromptRun, createStreamingResponse } from "./langfast_client.ts";
import type { ExecutionChunk } from "./types.ts";

// Function to transform the loaded models into OpenAI format
function transformToOAIModels(models: any[]): any {
    const data = models.map(model => ({
        id: model.slug,
        object: "model",
        created: Math.floor(new Date(model.created_at).getTime() / 1000),
        owned_by: model.provider, // or a static value like "openai"
    }));

    return {
        object: "list",
        data,
    };
}

const handler = async (req: Request): Promise<Response> => {
    const { pathname } = new URL(req.url);

    if (req.method === "GET" && pathname === "/v1/models") {
        try {
            const oaiModels = transformToOAIModels(modelsData);
            return new Response(JSON.stringify(oaiModels, null, 2), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (error) {
            console.error("Error processing models:", error);
            return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
        }
    }

    if (req.method === "POST" && pathname === "/v1/chat/completions") {
        try {
            const { model, messages, stream } = await req.json();

            const { accessToken, userId } = await getAccessToken();
            const promptId = await createPrompt(accessToken, model, messages);
            const runInfo = await initiatePromptRun(accessToken, promptId, userId, model, messages);
            const jobId = runInfo.jobs[0].job_id;

            if (stream) {
                const readableStream = await createStreamingResponse(accessToken, jobId, runInfo.run_id, model);
                return new Response(readableStream, { headers: { "Content-Type": "text/event-stream" } });
            } else {
                // Non-streamed response: consume the stream and return the final result.
                const readableStream = await createStreamingResponse(accessToken, jobId, runInfo.run_id, model);
                const reader = readableStream.getReader();
                const decoder = new TextDecoder();
                let fullContent = "";
                let done = false;

                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) {
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    const delta = data.choices[0]?.delta?.content;
                                    if (delta) {
                                        // LangFast's delta seems to be the full content so far, not just the new part.
                                        // We will take the latest content as the whole message.
                                        fullContent = delta;
                                    }
                                } catch (e) {
                                    // Ignore parsing errors for non-data lines
                                }
                            }
                        }
                    }
                }
                
                
                const responsePayload = {
                    id: runInfo.run_id,
                    object: "chat.completion",
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [{ message: { role: "assistant", content: fullContent }, index: 0, finish_reason: "stop" }],
                };
                return new Response(JSON.stringify(responsePayload), { headers: { "Content-Type": "application/json" } });
            }
        } catch (error) {
            const err = error as Error;
            console.error("Chat completion error:", err);
            return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
        }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
};

console.log("Server running on http://localhost:8000");
serve(handler, { port: 8000 });