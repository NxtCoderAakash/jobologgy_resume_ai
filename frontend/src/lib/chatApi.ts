const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Stream a coach reply from POST /api/chat. Calls `onChunk` with each text
 * fragment as it arrives. Resolves when the stream ends; throws on HTTP error
 * (with the server's message) or if aborted.
 */
export async function streamChat(opts: {
  messages: ChatMessage[];
  token: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
}): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({ messages: opts.messages }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) opts.onChunk(text);
    }
  } finally {
    reader.releaseLock();
  }
}
