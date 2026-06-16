import { useCallback, useRef, useState } from 'react';
import { chatStream } from '../lib/api';
import type {
  ContentItem,
  ErrorEventData,
  ExecutionTraceEvent,
  FinalEventData,
  ProgressEventData,
  SessionEventData,
} from '../lib/sse-types';

export type MessageStatus = 'streaming' | 'done' | 'error' | 'idle';

export interface ProgressRecord {
  node: string;
  message: string;
  status?: string;
  trace?: ExecutionTraceEvent;
  receivedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status: MessageStatus;
  progresses: ProgressRecord[];
  trace: ExecutionTraceEvent[];
  finalContent?: ContentItem[];
  errorMessage?: string;
  startedAt: number;
  finishedAt?: number;
}

const DEMO_USER_ID = 1;

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateMessage = useCallback(
    (id: string, patch: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
    },
    [],
  );

  const send = useCallback(
    async (userInput: string) => {
      const text = userInput.trim();
      if (!text || isStreaming) return;

      const userMsg: ChatMessage = {
        id: cryptoId(),
        role: 'user',
        text,
        status: 'idle',
        progresses: [],
        trace: [],
        startedAt: Date.now(),
      };
      const assistantId = cryptoId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        status: 'streaming',
        progresses: [],
        trace: [],
        startedAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        for await (const evt of chatStream(
          {
            user_id: DEMO_USER_ID,
            session_id: sessionIdRef.current,
            request: text,
          },
          ac.signal,
        )) {
          if (evt.event === 'session') {
            const d = evt.data as SessionEventData;
            sessionIdRef.current = d.sessionId;
          } else if (evt.event === 'progress') {
            const d = evt.data as ProgressEventData;
            const rec: ProgressRecord = {
              node: d.node,
              message: d.message,
              status: d.status,
              trace: d.trace,
              receivedAt: Date.now(),
            };
            updateMessage(assistantId, (m) => ({
              ...m,
              progresses: [...m.progresses, rec],
              trace: d.trace ? [...m.trace, d.trace] : m.trace,
            }));
          } else if (evt.event === 'final') {
            const d = evt.data as FinalEventData;
            updateMessage(assistantId, (m) => ({
              ...m,
              status: 'done',
              finalContent: d.content ?? [],
              trace: d.trace && d.trace.length > 0 ? d.trace : m.trace,
              finishedAt: Date.now(),
            }));
          } else if (evt.event === 'error') {
            const d = evt.data as ErrorEventData;
            updateMessage(assistantId, (m) => ({
              ...m,
              status: 'error',
              errorMessage: d.message ?? '未知错误',
              finishedAt: Date.now(),
            }));
          } else if (evt.event === 'done') {
            updateMessage(assistantId, (m) =>
              m.status === 'streaming'
                ? { ...m, status: 'done', finishedAt: Date.now() }
                : m,
            );
          }
        }
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.name === 'AbortError'
              ? '已取消'
              : e.message
            : String(e);
        updateMessage(assistantId, (m) => ({
          ...m,
          status: 'error',
          errorMessage: msg,
          finishedAt: Date.now(),
        }));
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, updateMessage],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    sessionIdRef.current = null;
  }, [isStreaming]);

  return { messages, isStreaming, send, abort, clear };
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
