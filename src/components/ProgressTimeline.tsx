import { Check, Loader2 } from 'lucide-react';
import { metaFor } from '../lib/nodeMeta';
import type { ProgressRecord } from '../hooks/useChatStream';

interface Props {
  progresses: ProgressRecord[];
  streaming: boolean;
}

export function ProgressTimeline({ progresses, streaming }: Props) {
  if (progresses.length === 0) {
    return <div className="text-xs text-stone-500">暂无进度</div>;
  }
  const merged = new Map<string, ProgressRecord>();
  for (const p of progresses) {
    merged.set(p.node, p);
  }
  const items = Array.from(merged.values());
  const lastNode = items[items.length - 1]?.node;
  const isPending = (n: string) => n === lastNode && streaming;

  return (
    <ol className="space-y-1.5">
      {items.map((p) => {
        const meta = metaFor(p.node);
        const pending = isPending(p.node);
        const Icon = meta.Icon;
        return (
          <li
            key={p.node}
            className="flex items-start gap-3 rounded-lg px-2.5 py-2 bg-stone-50 border border-stone-200"
          >
            <div className={`mt-0.5 ${meta.tone}`}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Icon className={`size-3.5 ${meta.tone}`} />
                <span className="text-sm text-stone-800 font-medium">{meta.short}</span>
                {p.status && (
                  <span className="text-[10px] uppercase tracking-wider text-stone-500">
                    {p.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-0.5 break-words">{p.message}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
