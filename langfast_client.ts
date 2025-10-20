// langfast_client.ts
// This module handles all communication with the LangFast Supabase backend.

const BASE_SUPABASE = "https://yzaaxwkjukajpwqflndu.supabase.co";
const AUTH_SIGNUP_URL = `${BASE_SUPABASE}/auth/v1/signup`;
const RPC_CREATE_PROMPT_URL = `${BASE_SUPABASE}/rest/v1/rpc/create_prompt`;
const FN_INITIATE_RUN_URL = `${BASE_SUPABASE}/functions/v1/initiate-prompt-run`;
export const SOCKET_IO_BASE = "https://langfast-prompt-runner-35808038077.us-central1.run.app";

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6YWF4d2tqdWthanB3cWZsbmR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNTgzNzUsImV4cCI6MjA1ODczNDM3NX0.tDu7BsFUOV4aPo8U-dsokQJSRw29LQWT8JfDqQe5MoI";

interface SupabaseAuthResponse {
    access_token: string;
    user: {
        id: string;
    };
}

interface InitiateRunResponse {
    run_id: string;
    jobs: { job_id: string }[];
}

async function fetchJson(url: string, options: RequestInit): Promise<any> {
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return response.json();
    }
    return response.text();
}

export async function getAccessToken(): Promise<{ accessToken: string; userId: string }> {
    const headers = {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json;charset=UTF-8",
    };
    const body = JSON.stringify({ data: {}, gotrue_meta_security: {} });
    const data: SupabaseAuthResponse = await fetchJson(AUTH_SIGNUP_URL, { method: "POST", headers, body });
    if (!data.access_token || !data.user?.id) {
        throw new Error("Failed to get access token");
    }
    return { accessToken: data.access_token, userId: data.user.id };
}

export async function createPrompt(accessToken: string, model: string, messages: any[]): Promise<string> {
    const headers = {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
    };
    const body = JSON.stringify({
        "p_name": `api-${Date.now()}`,
        "p_icon": "openai",
        "p_meta": {
            "model": model,
            "messages": messages,
            "stream": true,
        },
        "p_test_cases": [{"name": "API Test Case", "variables": []}],
    });

    const promptId = await fetchJson(RPC_CREATE_PROMPT_URL, { method: "POST", headers, body });
    if (typeof promptId !== 'string') {
        throw new Error(`Expected a string prompt_id, but got: ${JSON.stringify(promptId)}`);
    }
    return promptId.trim().replace(/"/g, "");
}

export async function initiatePromptRun(accessToken: string, promptId: string, userId: string, model: string, messages: any[]): Promise<InitiateRunResponse> {
    const headers = {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
    };
    const body = JSON.stringify({
        "run_id": crypto.randomUUID(),
        "prompt_id": promptId,
        "prompt_meta": {
            "model": model,
            "messages": messages,
            "max_completion_tokens": 9000,
            "stream": true,
            "response_format": "text",
        },
        "test_cases": [{"name": "API Test Case", "variables": []}],
        "created_by": userId,
    });

    const result: InitiateRunResponse = await fetchJson(FN_INITIATE_RUN_URL, { method: "POST", headers, body });
    if (!result.run_id || !result.jobs || result.jobs.length === 0) {
        throw new Error("Invalid response from initiate-prompt-run");
    }
    return result;
}

export async function createStreamingResponse(
    accessToken: string,
    jobId: string,
    runId: string,
    model: string,
): Promise<ReadableStream<Uint8Array>> {
    const url = `${SOCKET_IO_BASE}/socket.io/?EIO=4&transport=websocket`;

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        let resolved = false;
        const textEncoder = new TextEncoder();
        let previousContent = "";
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                ws.onopen = () => {
                    // Step 1: Send Connect event
                    ws.send(`40{"token":"${accessToken}"}`);
                };

                ws.onmessage = (event) => {
                    const data = event.data.toString();
                    if (data.startsWith("42")) {
                        try {
                            const socketData = JSON.parse(data.slice(2));
                            if (socketData[0] === "execution:chunk" && socketData[1].executionId === jobId) {
                                const chunk = socketData[1];
                                const currentFullContent = chunk.content || "";
                                const deltaContent = currentFullContent.substring(previousContent.length);
                                previousContent = currentFullContent;
                                
                                const oaiChunk = `data: ${JSON.stringify({
                                    id: runId,
                                    object: "chat.completion.chunk",
                                    created: Math.floor(Date.now() / 1000),
                                    model: model,
                                    choices: [{
                                        delta: { content: deltaContent },
                                        index: 0,
                                        finish_reason: chunk.finish_reason,
                                    }],
                                })}\n\n`;
                                controller.enqueue(textEncoder.encode(oaiChunk));

                                if (chunk.status === "completed") {
                                    controller.enqueue(textEncoder.encode('data: [DONE]\n\n'));
                                    ws.close();
                                }
                            }
                        } catch (e) {
                            console.error("Error parsing Socket.IO data:", e);
                        }
                    }
                };

                ws.onerror = (err) => {
                    console.error("WebSocket error:", err);
                    if (!resolved) {
                        reject(new Error("WebSocket connection failed"));
                    }
                    controller.close();
                };

                ws.onclose = () => {
                    controller.close();
                };
            },
            cancel() {
                ws.close();
            }
        });

        resolve(stream);
    });
}