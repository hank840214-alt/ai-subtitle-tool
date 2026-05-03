import { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

/**
 * SSE proxy: Next.js rewrites() buffers streaming responses, so we need a
 * dedicated Route Handler that pipes the FastAPI EventSource response chunk-by-chunk.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const upstream = await fetch(`${API_URL}/api/status/${id}`, {
    headers: { Accept: "text/event-stream" },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error", { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
