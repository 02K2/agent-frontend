import { ChevronRight, Wrench, Cog } from 'lucide-react';
import type { ExecutionTraceEvent } from '../lib/sse-types';
import { metaFor } from '../lib/nodeMeta';

interface Props {
  trace: ExecutionTraceEvent;
  index: number;
}

function safeStringify(v: unknown): string {
  if (v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function TraceStep({ trace, index }: Props) {
  const meta = metaFor(trace.node);
  const Icon = meta.tone.includes('teal') || meta.tone.includes('emerald') ? Wrench : Cog;
  const toolName = (trace.tool ?? trace.step ?? trace.type ?? '') as string;
  const title = toolName || meta.short;

  const argStr = safeStringify(trace.args);
  const resultStr = safeStringify(trace.result);

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-200 bg-stone-50/70">
        <span className="text-[10px] text-stone-500 font-mono">#{String(index + 1).padStart(2, '0')}</span>
        <Icon className={`size-3.5 ${meta.tone}`} />
        <span className="text-xs font-medium text-stone-800">{title}</span>
        {trace.status && (
          <span className="text-[10px] uppercase tracking-wider text-stone-500 ml-auto">
            {trace.status}
          </span>
        )}
      </div>
      <div className="px-3 py-2 space-y-2 text-xs">
        {trace.message && (
          <div className="text-stone-700">{String(trace.message)}</div>
        )}
        {argStr && (
          <details className="group">
            <summary className="cursor-pointer text-stone-600 hover:text-stone-900 flex items-center gap-1 select-none">
              <ChevronRight className="size-3 transition group-open:rotate-90" />
              参数
            </summary>
            <pre className="mt-1.5 max-h-60 overflow-auto rounded bg-stone-50 border border-stone-200 p-2 text-stone-700 font-mono text-[11px] leading-relaxed">
              {argStr}
            </pre>
          </details>
        )}
        {resultStr && (
          <details className="group">
            <summary className="cursor-pointer text-stone-600 hover:text-stone-900 flex items-center gap-1 select-none">
              <ChevronRight className="size-3 transition group-open:rotate-90" />
              结果
            </summary>
            <pre className="mt-1.5 max-h-72 overflow-auto rounded bg-stone-50 border border-stone-200 p-2 text-stone-700 font-mono text-[11px] leading-relaxed">
              {resultStr}
            </pre>
          </details>
        )}
        {trace.timestamp && (
          <div className="text-[10px] text-stone-500 font-mono">{String(trace.timestamp)}</div>
        )}
      </div>
    </div>
  );
}
