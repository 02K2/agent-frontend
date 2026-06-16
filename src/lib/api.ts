import type { ChatStreamRequest, SseEvent, SseEventName } from './sse-types';

const CHAT_STREAM_PATH = '/api/agent/chat/stream';

/**
 * 手动解析 text/event-stream 流。
 * 每帧以 \n\n 切分；event: / data: 行单独处理（多行 data 会拼起来）。
 */
export async function* chatStream(
  req: ChatStreamRequest,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const response = await fetch(CHAT_STREAM_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: req.user_id,
      session_id: req.session_id ?? null,
      request: req.request,
      token: req.token ?? null,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('Response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        const frame = parseFrame(rawFrame);
        if (frame) yield frame;
      }
    }
    if (buffer.trim().length > 0) {
      const frame = parseFrame(buffer);
      if (frame) yield frame;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

function parseFrame(raw: string): SseEvent | null {
  let event: SseEventName | '' = '';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() as SseEventName;
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!event || dataLines.length === 0) return null;
  const dataStr = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return { event, data: dataStr };
  }
}
