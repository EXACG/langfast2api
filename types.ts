// types.ts
export interface ExecutionChunk {
    executionId: string;
    status: "in_progress" | "completed";
    finish_reason: string | null;
    content: string;
}