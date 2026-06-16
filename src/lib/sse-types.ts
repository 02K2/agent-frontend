// 与 oge-agent/app/api/agent.py:chat_stream 推送的事件对齐

export interface ChatStreamRequest {
  user_id: number;
  session_id?: string | null;
  request: string;
  token?: string | null;
}

export type SseEventName = 'session' | 'progress' | 'final' | 'error' | 'done';

export interface SseEvent<T = unknown> {
  event: SseEventName;
  data: T;
}

// ---- session ----
export interface SessionEventData {
  sessionId: string;
  messageId: string;
}

// ---- progress ----
export type GaNode =
  | 'ga_intent_interpreter'
  | 'ga_rag'
  | 'ga_planner'
  | 'ga_executor'
  | 'ga_replanner'
  | 'ga_error_reflector'
  | 'ga_result_aggregator'
  | string;

export interface ExecutionTraceEvent {
  node?: GaNode;
  step?: string;
  status?: string;
  message?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  timestamp?: string;
  [k: string]: unknown;
}

export interface ProgressEventData {
  node: GaNode;
  message: string;
  status?: string;
  trace?: ExecutionTraceEvent;
  traceCount?: number;
}

// ---- final ----
export type ContentItemType = 'text' | 'script' | 'list';

export interface ContentItem {
  type: ContentItemType;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface FinalEventData {
  sessionId: string;
  messageId: string;
  content: ContentItem[];
  trace?: ExecutionTraceEvent[];
  status?: string;
  usedTools?: string[];
}

// ---- error ----
export interface ErrorEventData {
  message: string;
  code?: string;
}
