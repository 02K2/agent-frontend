import { useEffect, useRef, useState } from 'react';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';
import Text from 'ol/style/Text';
import type { FeatureLike } from 'ol/Feature';
import { fromLonLat } from 'ol/proj';
import { getCenter as getExtentCenter } from 'ol/extent';
import { defaults as defaultControls, ScaleLine, Attribution } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import { Eye, EyeOff, Trash2, MapPin, X, Loader2, Upload, Settings2 } from 'lucide-react';
import type { FetchedLayer } from '../lib/geo';
import { AVAILABLE_PROJECTIONS } from '../lib/geo';
import 'ol/ol.css';

interface MapPanelProps {
  open: boolean;
  layers: FetchedLayer[];
  pending: { id: string; name: string; url: string }[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAddLocal: (layer: FetchedLayer) => void;
  onError: (msg: string) => void;
  onChangeProjection: (layerId: string, newProj: string) => void;
}

const COLORS = ['#14b8a6', '#0ea5e9', '#f59e0b', '#ef4444', '#a855f7', '#10b981', '#ec4899'];

/**
 * 点图层 fit 时,避免把 zoom 推得太高导致瓦片稀疏区变白。
 * extent 现在是 EPSG:3857 (Web Mercator, 单位米), 按米跨度算 zoom。
 */
function safeFitZoom(extent3857: [number, number, number, number]): number {
  const [minX, minY, maxX, maxY] = extent3857;
  const dx = maxX - minX;
  const dy = maxY - minY;
  const maxSpan = Math.max(dx, dy); // 单位: 米
  // 单点 / 极小跨度
  if (maxSpan < 500) return 15;      // ~500m 视野
  if (maxSpan < 2000) return 14;     // ~2km
  if (maxSpan < 10000) return 13;    // ~10km
  if (maxSpan < 50000) return 12;
  if (maxSpan < 200000) return 10;
  if (maxSpan < 1000000) return 8;
  return 6;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 对点要素做"明显"样式: 较大半径 + 白色描边;
 * 线/面要素走"低透明填充 + 粗描边 + 白边" 样式,
 * 避免多层叠加时把底图全盖白。
 * 同时渲染要素的 name 字段作为标签。
 */
function makeStyle(color: string) {
  // 标签样式: 白色背景 + 描边 + 黑字, 确保在各种底图上可读
  const labelStyle = new Text({
    font: 'bold 12px sans-serif',
    fill: new Fill({ color: '#1f2937' }),
    stroke: new Stroke({ color: '#ffffff', width: 3 }),
    offsetY: -18,
    textAlign: 'center',
  });

  const pointStyle = new Style({
    image: new CircleStyle({
      radius: 9,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
    }),
    text: labelStyle,
    zIndex: 10,
  });

  // 面 / 线: 填充低透明度 (8%), 描边加粗 + 白边,
  // 多个 polygon 叠加也不会把底图盖死.
  const lineStyle = new Style({
    stroke: new Stroke({ color: '#ffffff', width: 5 }),
    fill: new Fill({ color: hexToRgba(color, 0.08) }),
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
    }),
    text: labelStyle,
  });

  return (feature: FeatureLike) => {
    const g = feature.getGeometry();
    if (!g) return lineStyle;
    const t = g.getType();
    // 从要素属性中取 name 字段作为标签文本
    const name = feature.get('name') || feature.get('NAME') || '';
    const style = (t === 'Point' || t === 'MultiPoint') ? pointStyle.clone() : lineStyle.clone();
    if (name) {
      const text = style.getText();
      if (text) text.setText(String(name));
    } else {
      style.setText(undefined as any); // 无 name 字段时不显示标签
    }
    return style;
  };
}

export function MapPanel({ open, layers, pending, onClose, onRemove, onClearAll, onAddLocal, onError, onChangeProjection }: MapPanelProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<OlMap | null>(null);
  const layerByIdRef = useRef<Map<string, VectorLayer<VectorSource>>>(new globalThis.Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [projMenuOpen, setProjMenuOpen] = useState<string | null>(null);
  const [projMenuPos, setProjMenuPos] = useState<{ bottom: number; right: number }>({ bottom: 0, right: 0 });
  const projBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 允许连续选同一个文件: 清空 value
    e.target.value = '';
    if (!file) return;
    try {
      const { loadLocalGeoJsonFile } = await import('../lib/geo');
      const layer = await loadLocalGeoJsonFile(file);
      onAddLocal(layer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError(`本地文件加载失败: ${msg}`);
    }
  };

  // 初始化地图
  useEffect(() => {
    if (!open) return;
    if (!mapEl.current) return;
    if (mapRef.current) return;

    const base = new TileLayer({
      source: new XYZ({
        url: '/tile-proxy/?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
        attributions: '© 高德地图 OpenStreetMap',
        crossOrigin: 'anonymous',
        maxZoom: 18,
      }),
    });

    const map = new OlMap({
      target: mapEl.current,
      layers: [base],
      view: new View({
        center: fromLonLat([114.305, 30.593]),
        zoom: 11,
        minZoom: 3,
        maxZoom: 18,
      }),
      controls: defaultControls({ attribution: false }).extend([
        new ScaleLine(),
        new Attribution({ collapsible: true }),
      ]),
      interactions: defaultInteractions(),
    });
    mapRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      layerByIdRef.current.clear();
    };
  }, [open]);

  // 同步 layers 增删
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentIds = new Set(Array.from(layerByIdRef.current.keys()));
    const wantedIds = new Set(layers.map((l) => l.id));

    for (const id of currentIds) {
      if (!wantedIds.has(id)) {
        const lyr = layerByIdRef.current.get(id);
        if (lyr) {
          map.removeLayer(lyr);
          layerByIdRef.current.delete(id);
        }
      }
    }
    for (const l of layers) {
      if (layerByIdRef.current.has(l.id)) continue;
      const idx = layers.findIndex((x) => x.id === l.id);
      const color = COLORS[idx % COLORS.length];
      const source = new VectorSource();
      // GeoJSON 已在 geo.ts 中被 proj4 直接转为 EPSG:3857,
      // dataProjection === featureProjection = 3857, OL 不做任何变换 (彻底绕过轴序问题).
      const geoForRender = l.normalizedGeojson || l.geojson;
      const features = new GeoJSON().readFeatures(geoForRender, {
        dataProjection: 'EPSG:3857',
        featureProjection: 'EPSG:3857',
      });
      source.addFeatures(features);
      const vLayer = new VectorLayer({ source, style: makeStyle(color) });
      map.addLayer(vLayer);
      layerByIdRef.current.set(l.id, vLayer);
    }

    if (layers.length > 0) {
      const last = layers[layers.length - 1];
      if (last.extent) {
        try {
          // last.extent 已经在 geo.ts 中按 sourceProj -> 3857 计算, 直接是 3857 米坐标。
          const ext3857 = last.extent;
          const view = map.getView();
          const isPointLike = last.featureCount > 0 &&
            last.extent[0] === last.extent[2] &&
            last.extent[1] === last.extent[3];

          if (isPointLike) {
            // 单点: 不 fit, 直接 setCenter + setZoom (避免 animate 容器未就绪的 race)
            const center: [number, number] = [
              (last.extent[0] + last.extent[2]) / 2,
              (last.extent[1] + last.extent[3]) / 2,
            ];
            if (isFinite(center[0]) && isFinite(center[1])) {
              view.setCenter(center);
              view.setZoom(14); // ~2km 视野, 上下文保留够多
            }
          } else {
            const targetZoom = safeFitZoom(last.extent);
            view.fit(ext3857, {
              padding: [50, 50, 50, 50],
              maxZoom: Math.min(targetZoom, 16),
              duration: 400,
            });
          }
          // 强制更新 size (避免父容器刚刚展开时尺寸未就绪)
          requestAnimationFrame(() => map.updateSize());
        } catch {
          /* noop */
        }
      }
    }
  }, [layers]);

  useEffect(() => {
    for (const [id, lyr] of layerByIdRef.current.entries()) {
      lyr.setVisible(visible[id] !== false);
    }
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => mapRef.current?.updateSize(), 250);
    return () => clearTimeout(id);
  }, [open]);

  // 监听容器尺寸变化 (e.g. 窗口缩放、聊天/地图分栏过渡), 让 OL 重算 viewport
  useEffect(() => {
    if (!open || !mapEl.current) return;
    const el = mapEl.current;
    const ro = new ResizeObserver(() => {
      mapRef.current?.updateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  if (!open) return null;

  const goToLayer = (l: FetchedLayer) => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    if (l.extent) {
      // extent 已经是 3857 米坐标, 直接用
      const isPointLike = l.extent[0] === l.extent[2] && l.extent[1] === l.extent[3];
      if (isPointLike) {
        const c: [number, number] = [
          (l.extent[0] + l.extent[2]) / 2,
          (l.extent[1] + l.extent[3]) / 2,
        ];
        if (isFinite(c[0]) && isFinite(c[1])) {
          view.setCenter(c);
          view.setZoom(14);
        }
      } else {
        view.fit(l.extent, {
          padding: [50, 50, 50, 50],
          maxZoom: Math.min(safeFitZoom(l.extent), 16),
          duration: 400,
        });
      }
    } else if (l.featureCount > 0) {
      const src = layerByIdRef.current.get(l.id)?.getSource();
      const f0 = src?.getFeatures()[0];
      if (f0) {
        const c = getExtentCenter(f0.getGeometry()?.getExtent() ?? [0, 0, 0, 0]);
        view.setCenter(c);
        view.setZoom(14);
      }
    }
  };

  return (
    <>
    <div className="h-full flex flex-col bg-white border-l border-stone-200">
      <div className="flex items-center justify-between px-3 h-12 border-b border-stone-200 bg-stone-50">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
          <MapPin className="size-4 text-teal-600" />
          地图视图
          <span className="text-[10px] text-stone-500">
            ({layers.length} 个图层{pending.length > 0 ? `, ${pending.length} 下载中` : ''})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePickFile}
            className="size-8 rounded-md text-stone-500 hover:text-teal-700 hover:bg-teal-50 flex items-center justify-center transition"
            title="从本地加载 GeoJSON 文件"
          >
            <Upload className="size-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          {layers.length > 0 && (
            <button
              onClick={onClearAll}
              className="size-8 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 flex items-center justify-center transition"
              title="清除全部图层"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="size-8 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 flex items-center justify-center transition"
            title="收起地图"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapEl} className="absolute inset-0 bg-stone-100" />
        {pending.length > 0 && (
          <div className="absolute top-2 left-2 right-2 z-10 space-y-1">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md bg-white/95 border border-stone-200 shadow-sm px-2.5 py-1.5 text-xs text-stone-700"
              >
                <Loader2 className="size-3.5 animate-spin text-teal-600" />
                正在加载 {p.name}…
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="max-h-44 overflow-y-auto border-t border-stone-200 bg-stone-50">
        {layers.length === 0 && pending.length === 0 ? (
          <div className="px-3 py-3 text-xs text-stone-500">
            点击助手消息结果卡片中的「添加到地图」即可加载 GeoJSON 图层。
          </div>
        ) : (
          <ul className="py-1">
            {layers.map((l, i) => {
              const isOn = visible[l.id] !== false;
              const color = COLORS[i % COLORS.length];
              return (
                <li
                  key={l.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-stone-100 transition group"
                >
                  <span
                    className="inline-block size-3 rounded-sm border border-stone-300"
                    style={{ background: color }}
                  />
                  <button
                    onClick={() => goToLayer(l)}
                    className="flex-1 text-left text-xs text-stone-800 truncate"
                    title={l.url}
                  >
                    {l.name}
                    <span className="text-stone-500 ml-1">({l.featureCount})</span>
                  </button>
                  {/* 投影切换: 投影是探测出来的 或 用户点击了投影按钮 */}
                  <div className="relative">
                    <button
                      ref={(el) => { projBtnRefs.current[l.id] = el; }}
                      onClick={() => {
                        if (projMenuOpen === l.id) {
                          setProjMenuOpen(null);
                        } else {
                          const rect = projBtnRefs.current[l.id]?.getBoundingClientRect();
                          if (rect) {
                            // 下拉菜单在按钮上方显示 (列表往下拉，菜单往上弹)
                            setProjMenuPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
                          }
                          setProjMenuOpen(l.id);
                        }
                      }}
                      className={`size-7 rounded text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 flex items-center justify-center ${
                        l.projectionInferred ? 'text-amber-600' : ''
                      }`}
                      title={`当前投影: ${l.sourceProjection}${l.projectionInferred ? ' (自动探测，点击可切换)' : ''}`}
                    >
                      <Settings2 className="size-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => setVisible((v) => ({ ...v, [l.id]: !isOn }))}
                    className="size-7 rounded text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 flex items-center justify-center"
                    title={isOn ? '隐藏' : '显示'}
                  >
                    {isOn ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </button>
                  <button
                    onClick={() => onRemove(l.id)}
                    className="size-7 rounded text-stone-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                    title="移除"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>

    {/* 投影选择下拉菜单: fixed 定位, 逃离 overflow 裁剪 */}
    {projMenuOpen && (() => {
      const layer = layers.find((x) => x.id === projMenuOpen);
      if (!layer) return null;
      return (
        <>
          {/* 背景蒙层: 点击关闭 */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setProjMenuOpen(null)} />
          <div
            className="fixed z-[9999] w-72 bg-white border border-stone-200 rounded-lg shadow-xl py-1 max-h-80 overflow-y-auto"
            style={{ bottom: projMenuPos.bottom, right: projMenuPos.right }}
          >
            <div className="px-3 py-1.5 text-[11px] text-stone-500 border-b border-stone-100 bg-stone-50/50">
              切换坐标系
              {layer.projectionInferred && <span className="text-amber-600"> （当前为自动探测）</span>}
            </div>
            {AVAILABLE_PROJECTIONS.map((p) => (
              <button
                key={p.code}
                onClick={() => {
                  onChangeProjection(layer.id, p.code);
                  setProjMenuOpen(null);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 transition ${
                  layer.sourceProjection === p.code
                    ? 'text-teal-700 font-medium bg-teal-50/50'
                    : 'text-stone-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      );
    })()}
    </>
  );
}
