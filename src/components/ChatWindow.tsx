import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, RadioTower, Map as MapIcon, X } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { InputBar } from './InputBar';
import { MessageBubble } from './MessageBubble';
import { MapPanel } from './MapPanel';
import { useChatStream } from '../hooks/useChatStream';
import { fetchGeoJsonLayer, rebuildLayerWithProjection, type FetchedLayer } from '../lib/geo';

export function ChatWindow() {
  const { messages, isStreaming, send, abort, clear } = useChatStream();
  const [pendingInput, setPendingInput] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  // 地图状态
  const [mapOpen, setMapOpen] = useState(false);
  const [layers, setLayers] = useState<FetchedLayer[]>([]);
  const [pending, setPending] = useState<{ id: string; name: string; url: string }[]>([]);
  const [mapLoadingUrl, setMapLoadingUrl] = useState<string | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = (text: string) => {
    send(text);
  };

  const handlePick = (text: string) => {
    setPendingInput(text);
  };

  const handleAddToMap = useCallback(async (url: string, name: string) => {
    // 已经在地图上就不再加
    if (layers.some((l) => l.url === url)) {
      setMapOpen(true);
      return;
    }
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setPending((p) => [...p, { id: tempId, name, url }]);
    setMapLoadingUrl(url);
    try {
      const layer = await fetchGeoJsonLayer(url, name);
      setLayers((ls) => [...ls, layer]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`加载到地图失败: ${msg}`);
    } finally {
      setPending((p) => p.filter((x) => x.id !== tempId));
      setMapLoadingUrl((cur) => (cur === url ? null : cur));
    }
  }, [layers]);

  const handleOpenMap = useCallback(() => setMapOpen(true), []);

  const handleRemoveLayer = useCallback((id: string) => {
    setLayers((ls) => ls.filter((l) => l.id !== id));
  }, []);

  const handleClearLayers = useCallback(() => {
    setLayers([]);
  }, []);

  const handleAddLocalLayer = useCallback((layer: FetchedLayer) => {
    setLayers((ls) => [...ls, layer]);
    setMapOpen(true);
  }, []);

  const handleMapError = useCallback((msg: string) => {
    alert(msg);
  }, []);

  const handleChangeProjection = useCallback((layerId: string, newProj: string) => {
    setLayers((ls) =>
      ls.map((l) => {
        if (l.id !== layerId) return l;
        try {
          return rebuildLayerWithProjection(l, newProj);
        } catch {
          return l;
        }
      }),
    );
  }, []);

  const handleClear = useCallback(() => {
    if (isStreaming) return;
    clear();
    setLayers([]);
    setPending([]);
  }, [isStreaming, clear]);

  const addedUrls = layers.map((l) => l.url);

  return (
    <div className="h-full flex flex-col bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-sm">
              <RadioTower className="size-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-stone-900">luojia fox</div>
              <div className="text-[10px] text-stone-500 -mt-0.1">地理空间智能体</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-teal-700">
                <span className="size-1.5 rounded-full bg-teal-500 animate-pulse-soft" />
                处理中
              </span>
            )}
            <button
              onClick={() => setMapOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 h-8 rounded-lg border px-2.5 text-xs transition ${
                mapOpen
                  ? 'border-teal-300 bg-teal-50 text-teal-800'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
              title={mapOpen ? '收起地图' : '展开地图'}
            >
              {mapOpen ? <X className="size-3.5" /> : <MapIcon className="size-3.5" />}
              {mapOpen ? '收起地图' : '地图'}
              {layers.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-teal-500 text-white text-[10px]">
                  {layers.length}
                </span>
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={isStreaming || (messages.length === 0 && layers.length === 0)}
              className="size-8 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center transition"
              title="清空对话和地图"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Body: 分栏 */}
      <div className="flex-1 min-h-0 flex">
        {/* Chat column */}
        <div
          className={`flex flex-col min-h-0 transition-all duration-300 ${
            mapOpen ? 'w-2/5' : 'w-full'
          }`}
        >
          <div ref={scrollerRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {messages.length === 0 ? (
                <EmptyState onPick={handlePick} />
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onAddToMap={handleAddToMap}
                    mapLoadingUrl={mapLoadingUrl}
                    mapAddedUrls={addedUrls}
                    mapOpen={mapOpen}
                    onOpenMap={handleOpenMap}
                  />
                ))
              )}
            </div>
          </div>
          <InputBar
            onSend={handleSend}
            onAbort={abort}
            busy={isStreaming}
            initial={pendingInput}
            key={pendingInput}
          />
        </div>

        {/* Map column */}
        {mapOpen && (
          <div className="w-3/5 min-h-0 animate-fade-in">
            <MapPanel
              open={mapOpen}
              layers={layers}
              pending={pending}
              onClose={() => setMapOpen(false)}
              onRemove={handleRemoveLayer}
              onClearAll={handleClearLayers}
              onAddLocal={handleAddLocalLayer}
              onError={handleMapError}
              onChangeProjection={handleChangeProjection}
            />
          </div>
        )}
      </div>
    </div>
  );
}
