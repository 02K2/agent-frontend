import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface Props {
  language?: string;
  value: string;
}

export function CodeBlock({ language, value }: Props) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="my-2 rounded-lg border border-stone-200 bg-stone-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-stone-200 bg-white">
        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">
          {language ?? 'code'}
        </span>
        <button
          onClick={onCopy}
          className="text-[10px] text-stone-500 hover:text-stone-800 inline-flex items-center gap-1"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="p-3 overflow-auto text-[12.5px] leading-relaxed font-mono text-stone-800 max-h-96">
        <code>{value}</code>
      </pre>
    </div>
  );
}
