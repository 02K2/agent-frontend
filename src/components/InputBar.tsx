import { useRef, useState, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onAbort: () => void;
  busy: boolean;
  initial?: string;
}

export function InputBar({ onSend, onAbort, busy, initial = '' }: Props) {
  const [text, setText] = useState(initial);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const v = text.trim();
    if (!v || busy) return;
    onSend(v);
    setText('');
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.style.height = 'auto';
        el.focus();
      }
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autosize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    setText(el.value);
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div className="border-t border-stone-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div
          className={`relative rounded-2xl border bg-white transition-colors shadow-sm ${
            busy
              ? 'border-teal-400 ring-2 ring-teal-300/40'
              : 'border-stone-200 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-300/30'
          }`}
        >
          <textarea
            ref={taRef}
            value={text}
            onChange={autosize}
            onKeyDown={onKey}
            disabled={busy}
            rows={1}
            placeholder={busy ? '智能体正在思考…' : '输入你的问题，Enter 发送 · Shift+Enter 换行'}
            className="block w-full resize-none bg-transparent outline-none px-4 py-3 pr-14 text-stone-800 placeholder-stone-400 max-h-[200px]"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {busy ? (
              <button
                onClick={onAbort}
                className="size-9 rounded-xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition shadow-sm"
                title="停止"
              >
                <Square className="size-4 fill-white" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!text.trim()}
                className="size-9 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-stone-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-sm"
                title="发送"
              >
                <Send className="size-4" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-stone-500 text-center">
          luojia fox · 流式输出，思考过程可在助手消息中展开
        </p>
      </div>
    </div>
  );
}
