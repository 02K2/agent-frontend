import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import {
  FileCheck2,
  ExternalLink,
  Copy,
  Check,
  MapPinPlus,
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
} from 'lucide-react';
import type { ContentItem } from '../lib/sse-types';

interface Props {
  content: ContentItem[];
  onAddToMap?: (url: string, name: string) => void;
  mapLoadingUrl?: string | null;
  mapAddedUrls?: string[];
  mapOpen?: boolean;
  onOpenMap?: () => void;
}

function normalizeText(d: unknown): string {
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && 'text' in (d as Record<string, unknown>)) {
    return String((d as { text: unknown }).text ?? '');
  }
  try {
    return JSON.stringify(d, null, 2);
  } catch {
    return String(d);
  }
}

function normalizeScript(d: unknown): { language: string; value: string } {
  if (typeof d === 'string') return { language: 'text', value: d };
  if (d && typeof d === 'object') {
    const obj = d as Record<string, unknown>;
    return {
      language: String(obj.language ?? obj.lang ?? 'text'),
      value: String(obj.code ?? obj.value ?? obj.script ?? ''),
    };
  }
  return { language: 'text', value: String(d) };
}

function normalizeList(d: unknown): { title?: string; items: Array<Record<string, unknown>> } {
  if (Array.isArray(d)) return { items: d as Array<Record<string, unknown>> };
  if (d && typeof d === 'object') {
    const obj = d as Record<string, unknown>;
    return {
      title: typeof obj.title === 'string' ? obj.title : undefined,
      items: Array.isArray(obj.items) ? (obj.items as Array<Record<string, unknown>>) : [],
    };
  }
  return { items: [] };
}

function describeItem(item: Record<string, unknown>): string {
  if (typeof item === 'string') return item;
  const candidates = ['name', 'title', 'label', 'description', 'value', 'text'];
  for (const k of candidates) {
    const v = item[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function isUrlString(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

function fileNameFromUrl(u: string): string {
  try {
    const path = new URL(u).pathname;
    const last = path.split('/').pop() ?? path;
    return last || u;
  } catch {
    return u;
  }
}

function isFinalOutputItem(c: ContentItem): boolean {
  if (c.type !== 'text') return false;
  const meta = c.metadata ?? {};
  if (meta.artifact_key && String(meta.artifact_key) === 'output') return true;
  if (typeof meta.label === 'string' && /最终output/i.test(meta.label)) return true;
  return false;
}

const URL_RE = /https?:\/\/\S+/g;

/**
 * 从纯文本中提取所有 URL；把这些 URL 从文本里抠掉（用换行/空格隔开，避免 markdown 把句子拼起来）。
 * 返回 cleanedText + urls[]
 */
function extractUrls(text: string): { cleaned: string; urls: string[] } {
  const urls: string[] = [];
  const matches: { start: number; end: number; url: string }[] = [];
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    const url = m[0].replace(/[),.;]+$/, ''); // 去掉尾部标点
    matches.push({ start: m.index, end: m.index + url.length, url });
    urls.push(url);
    URL_RE.lastIndex = m.index + url.length;
  }
  if (matches.length === 0) return { cleaned: text, urls: [] };
  let cleaned = '';
  let cursor = 0;
  for (const seg of matches) {
    cleaned += text.slice(cursor, seg.start);
    // 用零宽分隔符占位,避免合并相邻文字
    cleaned += '​';
    cursor = seg.end;
  }
  cleaned += text.slice(cursor);
  cleaned = cleaned.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { cleaned, urls };
}

interface SplitView {
  textBlocks: ContentItem[];
  otherBlocks: ContentItem[];
  finalUrl?: string;
  intermediateFiles: string[]; // 从 text 块中提取出的"非最终" URL
}

function splitContent(content: ContentItem[]): SplitView {
  const textBlocks: ContentItem[] = [];
  const otherBlocks: ContentItem[] = [];
  let finalUrl: string | undefined;
  const allExtracted: string[] = [];

  for (const c of content) {
    if (isFinalOutputItem(c)) {
      const txt = normalizeText(c.data);
      if (isUrlString(txt)) finalUrl = txt.trim();
      continue;
    }
    if (c.type === 'text') {
      const txt = normalizeText(c.data);
      const { cleaned, urls } = extractUrls(txt);
      if (cleaned.trim().length > 0) {
        textBlocks.push({ ...c, data: cleaned });
      }
      for (const u of urls) {
        if (u !== finalUrl) allExtracted.push(u);
      }
    } else {
      otherBlocks.push(c);
    }
  }
  return { textBlocks, otherBlocks, finalUrl, intermediateFiles: allExtracted };
}

function IntermediateFiles({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState(false);
  if (urls.length === 0) return null;
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border border-stone-200 bg-stone-50/60 overflow-hidden"
    >
      <summary className="cursor-pointer select-none flex items-center gap-2 px-3 py-2 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition">
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <Wrench className="size-3.5 text-stone-500" />
        <span>过程算子产生的中间文件 ({urls.length})</span>
        <span className="text-stone-400 ml-1 text-[10px]">点击展开</span>
      </summary>
      <ul className="px-3 py-2 space-y-1 border-t border-stone-200 bg-white">
        {urls.map((u, i) => (
          <li key={i} className="flex items-center gap-2 text-[12px]">
            <span className="inline-block size-1.5 rounded-full bg-stone-400" />
            <span className="text-stone-700 truncate" title={u}>
              {fileNameFromUrl(u)}
            </span>
            <a
              href={u}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-stone-500 hover:text-stone-800 inline-flex items-center gap-1"
            >
              <ExternalLink className="size-3" />
              <span>打开</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface ResultFileCardProps {
  url: string;
  onAddToMap?: (url: string, name: string) => void;
  mapLoadingUrl?: string | null;
  mapAddedUrls?: string[];
  mapOpen?: boolean;
  onOpenMap?: () => void;
}

function ResultFileCard({
  url,
  onAddToMap,
  mapLoadingUrl,
  mapAddedUrls,
  mapOpen,
  onOpenMap,
}: ResultFileCardProps) {
  const [copied, setCopied] = useState(false);
  const name = fileNameFromUrl(url);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  const isLoading = mapLoadingUrl === url;
  const isAdded = mapAddedUrls?.includes(url) ?? false;

  const handleAdd = () => {
    if (onAddToMap) onAddToMap(url, name);
    if (!mapOpen && onOpenMap) onOpenMap();
  };

  return (
    <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-teal-200/80 bg-teal-50">
        <FileCheck2 className="size-4 text-teal-700" />
        <span className="text-sm font-medium text-teal-900">最终结果文件</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-teal-700/80">
          最终 output
        </span>
      </div>
      <div className="px-3 py-3 bg-white space-y-2">
        <div className="text-sm font-medium text-stone-800 break-all">{name}</div>
        <div className="text-[12px] text-stone-600 break-all font-mono">{url}</div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-sm text-emerald-700 transition"
          >
            <ExternalLink className="size-3.5" />
            打开文件
          </a>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 px-3 py-1.5 text-sm text-stone-700 transition"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            {copied ? '已复制' : '复制链接'}
          </button>
          <button
            onClick={handleAdd}
            disabled={isLoading}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
              isAdded
                ? 'border-teal-300 bg-teal-50 text-teal-800'
                : 'border-teal-300 bg-teal-500 hover:bg-teal-600 text-white shadow-sm'
            } disabled:opacity-70 disabled:cursor-not-allowed`}
            title={isAdded ? '该文件已添加到地图' : '下载并加载到地图'}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                下载中…
              </>
            ) : isAdded ? (
              <>
                <Check className="size-3.5" />
                已添加到地图
              </>
            ) : (
              <>
                <MapPinPlus className="size-3.5" />
                添加到地图
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FinalAnswer({
  content,
  onAddToMap,
  mapLoadingUrl,
  mapAddedUrls,
  mapOpen,
  onOpenMap,
}: Props) {
  const split = useMemo(() => splitContent(content ?? []), [content]);

  if (!content || content.length === 0) {
    return <div className="text-sm text-stone-500 italic">(本次没有返回内容)</div>;
  }

  return (
    <div className="space-y-3">
      {split.textBlocks.map((c, i) => (
        <div key={`t-${i}`} className="markdown-body text-[14.5px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {normalizeText(c.data)}
          </ReactMarkdown>
        </div>
      ))}

      {split.otherBlocks.map((c, i) => {
        if (c.type === 'script') {
          const s = normalizeScript(c.data);
          return <CodeBlock key={`s-${i}`} language={s.language} value={s.value} />;
        }
        if (c.type === 'list') {
          const l = normalizeList(c.data);
          return (
            <div key={`l-${i}`} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              {l.title && (
                <div className="text-sm font-medium text-stone-800 mb-2">{l.title}</div>
              )}
              {l.items.length === 0 ? (
                <div className="text-xs text-stone-500">(空列表)</div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {l.items.map((it, j) => (
                    <li
                      key={j}
                      className="text-[13px] text-stone-700 rounded-md bg-white border border-stone-200 px-2.5 py-1.5"
                    >
                      {describeItem(it)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }
        return (
          <pre
            key={`o-${i}`}
            className="text-[12px] text-stone-600 bg-stone-50 border border-stone-200 rounded p-2 overflow-auto"
          >
            {JSON.stringify(c, null, 2)}
          </pre>
        );
      })}

      {split.intermediateFiles.length > 0 && (
        <IntermediateFiles urls={split.intermediateFiles} />
      )}

      {split.finalUrl && (
        <ResultFileCard
          url={split.finalUrl}
          onAddToMap={onAddToMap}
          mapLoadingUrl={mapLoadingUrl}
          mapAddedUrls={mapAddedUrls}
          mapOpen={mapOpen}
          onOpenMap={onOpenMap}
        />
      )}
    </div>
  );
}
