import { useState } from 'react';
import { ChevronDown, ChevronRight, Cog, Clock } from 'lucide-react';
import { ProgressTimeline } from './ProgressTimeline';
import { TraceStep } from './TraceStep';
import type { ChatMessage } from '../hooks/useChatStream';

interface Props {
  message: ChatMessage;
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AgentProcessPanel({ message }: Props) {
  const [open, setOpen] = useState(false);
  const dur = formatDuration(
    message.finishedAt ? message.finishedAt - message.startedAt : undefined,
  );
  const stepCount = message.progresses.length;
  const traceCount = message.trace.length;

  const summary = (
    <span className="flex items-center gap-2 text-xs text-stone-600">
      <Cog className="size-3.5" />
      <span>思考过程</span>
      <span className="text-stone-300">·</span>
      <span>{stepCount} 个阶段</span>
      {traceCount > 0 && (
        <>
          <span className="text-stone-300">·</span>
          <span>{traceCount} 条 trace</span>
        </>
      )}
      {dur && (
        <>
          <span className="text-stone-300">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {dur}
          </span>
        </>
      )}
    </span>
  );

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-white/80 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-50 transition text-left"
      >
        {open ? (
          <ChevronDown className="size-4 text-stone-500" />
        ) : (
          <ChevronRight className="size-4 text-stone-500" />
        )}
        {summary}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 animate-fade-in border-t border-stone-100">
          <div className="pt-2">
            <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5">
              阶段进度
            </div>
            <ProgressTimeline progresses={message.progresses} streaming={message.status === 'streaming'} />
          </div>
          {message.trace.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5">
                执行 trace
              </div>
              <div className="space-y-1.5 max-h-96 overflow-auto pr-1">
                {message.trace.map((t, i) => (
                  <TraceStep key={i} trace={t} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
