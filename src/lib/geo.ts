import GeoJSON from 'ol/format/GeoJSON';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

export interface FetchedLayer {
  id: string;
  url: string;
  name: string;
  featureCount: number;
  extent: [number, number, number, number] | null;
  /** 原始 GeoJSON (保留原始坐标, 用于用户切换投影时重新投影) */
  geojson: object;
  /** 4326 归一化后的 GeoJSON (用于 MapPanel 直接渲染) */
  normalizedGeojson?: object;
  sourceProjection: string;
  /** true if projection was inferred from coordinate heuristics (not from GeoJSON crs field) */
  projectionInferred?: boolean;
}

let counter = 0;
export function nextLayerId(): string {
  counter += 1;
  return `layer-${Date.now()}-${counter}`;
}

let projRegistered = false;

function ensureProjRegistered() {
  if (projRegistered) return;
  projRegistered = true;

  // ── CGCS2000 / 3-degree Gauss-Kruger 各分区 (覆盖全国) ──
  // EPSG:4513 — zone 25, CM 75°E  (新疆西部)
  proj4.defs('EPSG:4513', '+proj=tmerc +lat_0=0 +lon_0=75 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4516 — zone 28, CM 84°E  (新疆)
  proj4.defs('EPSG:4516', '+proj=tmerc +lat_0=0 +lon_0=84 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4518 — zone 30, CM 90°E  (西藏/青海)
  proj4.defs('EPSG:4518', '+proj=tmerc +lat_0=0 +lon_0=90 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4520 — zone 32, CM 96°E  (青海/甘肃)
  proj4.defs('EPSG:4520', '+proj=tmerc +lat_0=0 +lon_0=96 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4522 — zone 34, CM 102°E (四川/云南)
  proj4.defs('EPSG:4522', '+proj=tmerc +lat_0=0 +lon_0=102 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4524 — zone 36, CM 108°E (重庆/贵州/广西)
  proj4.defs('EPSG:4524', '+proj=tmerc +lat_0=0 +lon_0=108 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4526 — zone 38, CM 114°E (湖北/湖南/广东/河南)
  proj4.defs('EPSG:4526', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4528 — zone 40, CM 120°E (江苏/浙江/福建)
  proj4.defs('EPSG:4528', '+proj=tmerc +lat_0=0 +lon_0=120 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4530 — zone 42, CM 126°E (山东/东北)
  proj4.defs('EPSG:4530', '+proj=tmerc +lat_0=0 +lon_0=126 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4532 — zone 44, CM 132°E (东北东部)
  proj4.defs('EPSG:4532', '+proj=tmerc +lat_0=0 +lon_0=132 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
  // EPSG:4534 — zone 45, CM 135°E (黑龙江东部)
  proj4.defs('EPSG:4534', '+proj=tmerc +lat_0=0 +lon_0=135 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');

  // ── CGCS2000 地理坐标 (与 4326 几乎一致, 作为兜底) ──
  proj4.defs('EPSG:4490', '+proj=longlat +ellps=GRS80 +no_defs');

  // ── UTM zones covering China ──
  proj4.defs('EPSG:32648', '+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs');
  proj4.defs('EPSG:32649', '+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs');
  proj4.defs('EPSG:32650', '+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs');
  proj4.defs('EPSG:32651', '+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs');

  try {
    register(proj4);
  } catch {
    /* 已注册过 */
  }
}

/**
 * 可手动选择的投影列表 (供 UI 下拉用)。
 */
export const AVAILABLE_PROJECTIONS = [
  { code: 'EPSG:4326', label: 'WGS84 经纬度 (EPSG:4326)' },
  { code: 'EPSG:4490', label: 'CGCS2000 经纬度 (EPSG:4490)' },
  { code: 'EPSG:4513', label: 'CGCS2000 3°带 CM75°E (EPSG:4513)' },
  { code: 'EPSG:4516', label: 'CGCS2000 3°带 CM84°E (EPSG:4516)' },
  { code: 'EPSG:4518', label: 'CGCS2000 3°带 CM90°E (EPSG:4518)' },
  { code: 'EPSG:4520', label: 'CGCS2000 3°带 CM96°E (EPSG:4520)' },
  { code: 'EPSG:4522', label: 'CGCS2000 3°带 CM102°E (EPSG:4522)' },
  { code: 'EPSG:4524', label: 'CGCS2000 3°带 CM108°E (EPSG:4524)' },
  { code: 'EPSG:4526', label: 'CGCS2000 3°带 CM114°E (EPSG:4526)' },
  { code: 'EPSG:4528', label: 'CGCS2000 3°带 CM120°E (EPSG:4528)' },
  { code: 'EPSG:4530', label: 'CGCS2000 3°带 CM126°E (EPSG:4530)' },
  { code: 'EPSG:4532', label: 'CGCS2000 3°带 CM132°E (EPSG:4532)' },
  { code: 'EPSG:4534', label: 'CGCS2000 3°带 CM135°E (EPSG:4534)' },
  { code: 'EPSG:32648', label: 'WGS84 UTM 48N (EPSG:32648)' },
  { code: 'EPSG:32649', label: 'WGS84 UTM 49N (EPSG:32649)' },
  { code: 'EPSG:32650', label: 'WGS84 UTM 50N (EPSG:32650)' },
  { code: 'EPSG:32651', label: 'WGS84 UTM 51N (EPSG:32651)' },
];

/**
 * 从 GeoJSON 的 crs.name 提取 EPSG code, 例如:
 *   "urn:ogc:def:crs:EPSG::4526" -> "EPSG:4526"
 *   "EPSG:4326" -> "EPSG:4326"
 * 如果 GeoJSON 没有声明 crs, 则通过坐标范围启发式探测。
 */
function detectProjection(geojson: any): { code: string; inferred: boolean } {
  const name = geojson?.crs?.properties?.name;
  if (typeof name === 'string') {
    const m = name.match(/EPSG[::]*(\d+)/i);
    if (m) return { code: `EPSG:${m[1]}`, inferred: false };
  }
  // 没有 crs 声明 → 通过坐标启发式探测
  const inferred = inferProjectionFromCoords(geojson);
  return { code: inferred, inferred: inferred !== 'EPSG:4326' };
}

/**
 * 从坐标值范围推断投影类型。
 * CGCS2000 3° Gauss-Kruger 坐标特征 (GeoJSON [X, Y] 格式):
 *   - X(easting): 带号前缀 zoneNum×10^6+500000±offset (如 38452678)
 *                  或无带号 500000±offset (如 452678)
 *   - Y(northing): 中国范围 ≈ 2 000 000 ~ 5 500 000
 */
function inferProjectionFromCoords(geojson: any): string {
  const sample = collectFirstCoords(geojson, 30);
  if (sample.length === 0) return 'EPSG:4326';

  // 如果坐标都是常规经纬度范围, 直接返回 4326
  const allGeo = sample.every(([x, y]) =>
    x >= -180 && x <= 180 && y >= -90 && y <= 90,
  );
  if (allGeo) return 'EPSG:4326';

  // 坐标值明显是投影坐标 (米), 尝试识别 Gauss-Kruger 带号
  for (const [x, y] of sample) {
    // 带号前缀在 X(easting) 上: X 值 7~8 位, 前两位是带号 (25~45)
    if (x >= 25_000_000 && x <= 45_999_999) {
      const zone = Math.floor(x / 1_000_000);
      const cm = zone * 3;
      const epsg = cmToEpsg45xx(cm);
      if (epsg) return epsg;
    }
    // 无带号: X 在 100000~900000 附近 (500000 false easting ± 偏移)
    // 此时无法从坐标值判断带号, 依赖 Y (northing) 范围确认是投影坐标
  }

  // 确认是投影坐标但无法自动判断带号 → 默认 CM114°E (EPSG:4526, 覆盖中部)
  // 用户可通过 UI 手动切换
  const anyProjected = sample.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90);
  if (anyProjected) {
    return 'EPSG:4526';
  }

  return 'EPSG:4326';
}

/** CGCS2000 3° 带号 → EPSG code 映射 */
function cmToEpsg45xx(cm: number): string | null {
  const map: Record<number, string> = {
    75: 'EPSG:4513', 84: 'EPSG:4516', 90: 'EPSG:4518',
    96: 'EPSG:4520', 102: 'EPSG:4522', 108: 'EPSG:4524',
    114: 'EPSG:4526', 120: 'EPSG:4528', 126: 'EPSG:4530',
    132: 'EPSG:4532', 135: 'EPSG:4534',
  };
  return map[cm] ?? null;
}

/**
 * 从 GeoJSON 中提取前 N 个叶子坐标 (用于启发式探测)。
 */
function collectFirstCoords(geojson: any, max: number): [number, number][] {
  const result: [number, number][] = [];
  const walk = (obj: any) => {
    if (result.length >= max) return;
    if (!obj) return;
    if (Array.isArray(obj)) {
      if (obj.length >= 2 && typeof obj[0] === 'number') {
        result.push([obj[0], obj[1]]);
      } else {
        for (const item of obj) {
          walk(item);
          if (result.length >= max) return;
        }
      }
    } else if (typeof obj === 'object') {
      if (obj.coordinates) walk(obj.coordinates);
      if (obj.features) walk(obj.features);
      if (obj.geometry) walk(obj.geometry);
    }
  };
  walk(geojson);
  return result;
}

/**
 * CGCS2000 3° Gauss-Kruger EPSG code → 带号 映射.
 * 带号 = CM / 3 (CM 为中央经线度数).
 */
const EPSG_TO_ZONE: Record<string, number> = {
  'EPSG:4513': 25, 'EPSG:4516': 28, 'EPSG:4518': 30,
  'EPSG:4520': 32, 'EPSG:4522': 34, 'EPSG:4524': 36,
  'EPSG:4526': 38, 'EPSG:4528': 40, 'EPSG:4530': 42,
  'EPSG:4532': 44, 'EPSG:4534': 45,
};


/**
 * 把 GeoJSON 的坐标用 proj4 直接转为 EPSG:3857 (Web Mercator).
 *
 * 核心思路:
 *   不走 OpenLayers 的投影变换 (OL 会按 EPSG 官方轴序解析坐标,
 *   对 tmerc 等投影会把 [easting, northing] 反转成 [northing, easting]).
 *   而是用 proj4 直接转到 3857, 然后 OL 不做任何变换 (dataProj === featureProj).
 */
function reprojectTo3857(geojson: any, sourceProj: string): any {
  if (!proj4.defs('EPSG:3857')) {
    proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +no_defs');
  }

  const isGeo = sourceProj === 'EPSG:4326' || sourceProj === 'EPSG:4490';

  // ── 带号前缀检测 ──
  let sourceProjForTransform: any = sourceProj;
  if (!isGeo) {
    const expectedZone = EPSG_TO_ZONE[sourceProj];
    if (expectedZone) {
      const firstCoord = extractFirstCoord(geojson);
      if (firstCoord) {
        const x = firstCoord[0]; // 带号前缀在 X (easting) 上
        const zoneBase = expectedZone * 1_000_000;
        const isZonePrefixed = x >= zoneBase + 100_000 && x <= zoneBase + 999_999;
        if (isZonePrefixed) {
          const srcDef = proj4.defs(sourceProj);
          if (srcDef) {
            const lon0Deg = (srcDef.long0 ?? 0) * 180 / Math.PI;
            const ellps = srcDef.ellps || 'GRS80';
            const falseEasting = zoneBase + 500_000;
            sourceProjForTransform = `+proj=tmerc +lat_0=0 +lon_0=${lon0Deg} +k=1 +x_0=${falseEasting} +y_0=0 +ellps=${ellps} +units=m +no_defs`;
          }
        }
      }
    }
  }

  const transformOne = (x: number, y: number): number[] | null => {
    try {
      let lonlat: number[];
      if (isGeo) {
        lonlat = [x, y];
      } else {
        lonlat = proj4(sourceProjForTransform, 'EPSG:4326', [x, y]);
        if (!lonlat || !isFinite(lonlat[0]) || !isFinite(lonlat[1])) return null;
      }
      const out = proj4('EPSG:4326', 'EPSG:3857', lonlat);
      if (!out || !isFinite(out[0]) || !isFinite(out[1])) return null;
      // 高德底图偏移校正: X+640m, Y-263m
      return [out[0] + 640, out[1] - 263];
    } catch {
      return null;
    }
  };

  const transformCoords = (coords: any): any => {
    if (!Array.isArray(coords) || coords.length === 0) return coords;
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      if (!isFinite(x) || !isFinite(y)) return [0, 0];
      const out = transformOne(x, y);
      if (!out) return [0, 0];
      return [...out, ...coords.slice(2)];
    }
    return coords.map(transformCoords);
  };

  const result = JSON.parse(JSON.stringify(geojson));
  if (result.features) {
    for (const f of result.features) {
      if (f.geometry?.coordinates) {
        f.geometry.coordinates = transformCoords(f.geometry.coordinates);
      }
    }
  } else if (result.coordinates) {
    result.coordinates = transformCoords(result.coordinates);
  }
  delete result.crs;
  return result;
}

/**
 * 从 GeoJSON 中提取第一个叶子坐标 (用于带号前缀探测).
 */
function extractFirstCoord(geojson: any): [number, number] | null {
  const walk = (obj: any): [number, number] | null => {
    if (!obj) return null;
    if (Array.isArray(obj)) {
      if (obj.length >= 2 && typeof obj[0] === 'number') {
        return [obj[0], obj[1]];
      }
      for (const item of obj) {
        const r = walk(item);
        if (r) return r;
      }
      return null;
    }
    if (typeof obj === 'object') {
      if (obj.coordinates) return walk(obj.coordinates);
      if (obj.features) return walk(obj.features);
      if (obj.geometry) return walk(obj.geometry);
    }
    return null;
  };
  return walk(geojson);
}

/**
 * 把绝对 URL 改写成走 Vite 代理的相对路径, 避免浏览器 CORS.
 */
function toProxyUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.host === '10.101.250.91:5000') {
      return `/geo-proxy${u.pathname}${u.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

export async function fetchGeoJsonLayer(url: string, name: string): Promise<FetchedLayer> {
  ensureProjRegistered();

  const proxyUrl = toProxyUrl(url);
  let res: Response;
  try {
    res = await fetch(proxyUrl);
  } catch (e) {
    throw new Error('网络请求失败 (可能是 CORS): ' + (e instanceof Error ? e.message : String(e)));
  }
  if (!res.ok) {
    throw new Error(`下载失败: HTTP ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('响应不是合法 JSON: ' + (e instanceof Error ? e.message : String(e)));
  }
  return buildLayerFromGeoJson(json, name, url);
}

export function extentToCenter(extent: [number, number, number, number] | null): [number, number] | null {
  if (!extent) return null;
  return [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
}

/**
 * 内部共用: 拿到原始 GeoJSON 对象后, 做投影探测/重投影/extent 计算.
 * fetchGeoJsonLayer (URL 下载) 和 loadLocalGeoJsonFile (FileReader) 都走这里.
 */
function buildLayerFromGeoJson(json: any, name: string, url: string): FetchedLayer {
  ensureProjRegistered();

  const { code: sourceProj, inferred } = detectProjection(json);

  // 验证 proj4 能识别该投影, 否则回退 4326
  let effectiveProj = sourceProj;
  try {
    if (sourceProj !== 'EPSG:4326') {
      proj4(sourceProj, 'EPSG:4326', [0, 0]);
    }
  } catch {
    effectiveProj = 'EPSG:4326';
  }

  // ── 关键: 用 proj4 直接把坐标转为 EPSG:3857 ──
  // 避免 OL 的 EPSG 轴序 (northing, easting) 把 GeoJSON [easting, northing] 反转.
  // 转换后 stored GeoJSON 已是 3857, MapPanel 的 dataProj=featureProj=3857 不做变换.
  const normalizedJson = reprojectTo3857(json, effectiveProj);

  const reader = new GeoJSON();
  let features: ReturnType<typeof reader.readFeatures>;
  try {
    features = reader.readFeatures(normalizedJson, {
      dataProjection: 'EPSG:3857',
      featureProjection: 'EPSG:3857',
    });
  } catch (e) {
    throw new Error('GeoJSON 解析失败: ' + (e instanceof Error ? e.message : String(e)));
  }

  let extent: [number, number, number, number] | null = null;
  try {
    if (features.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const f of features) {
        const g = f.getGeometry();
        if (!g) continue;
        const e = g.getExtent();
        if (e[0] < minX) minX = e[0];
        if (e[1] < minY) minY = e[1];
        if (e[2] > maxX) maxX = e[2];
        if (e[3] > maxY) maxY = e[3];
      }
      if (isFinite(minX)) extent = [minX, minY, maxX, maxY];
    }
  } catch {
    extent = null;
  }

  return {
    id: nextLayerId(),
    url,
    name,
    featureCount: features.length,
    extent,
    geojson: json, // 保留原始 GeoJSON (用于重新投影)
    normalizedGeojson: normalizedJson, // 3857 归一化版, 用于 MapPanel 渲染
    sourceProjection: effectiveProj, // 原始投影 (供显示/UI参考)
    projectionInferred: inferred,
  };
}

/**
 * 用新的投影重新构建图层 (用户手动切换投影时调用)。
 */
export function rebuildLayerWithProjection(layer: FetchedLayer, newProj: string): FetchedLayer {
  ensureProjRegistered();
  const rebuilt = buildLayerFromGeoJsonWithProj(layer.geojson, layer.name, layer.url, newProj);
  return { ...rebuilt, id: layer.id };
}

/**
 * 与 buildLayerFromGeoJson 类似, 但强制使用指定投影 (跳过自动探测)。
 */
function buildLayerFromGeoJsonWithProj(json: any, name: string, url: string, forcedProj: string): FetchedLayer {
  ensureProjRegistered();

  let effectiveProj = forcedProj;
  try {
    if (forcedProj !== 'EPSG:4326') {
      proj4(forcedProj, 'EPSG:4326', [0, 0]);
    }
  } catch {
    effectiveProj = 'EPSG:4326';
  }

  // 同 buildLayerFromGeoJson: 先用 proj4 直接转到 3857, 避免 OL 轴序问题
  const normalizedJson = reprojectTo3857(json, effectiveProj);

  const reader = new GeoJSON();
  let features: ReturnType<typeof reader.readFeatures>;
  try {
    features = reader.readFeatures(normalizedJson, {
      dataProjection: 'EPSG:3857',
      featureProjection: 'EPSG:3857',
    });
  } catch (e) {
    throw new Error('GeoJSON 解析失败: ' + (e instanceof Error ? e.message : String(e)));
  }

  let extent: [number, number, number, number] | null = null;
  try {
    if (features.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const f of features) {
        const g = f.getGeometry();
        if (!g) continue;
        const e = g.getExtent();
        if (e[0] < minX) minX = e[0];
        if (e[1] < minY) minY = e[1];
        if (e[2] > maxX) maxX = e[2];
        if (e[3] > maxY) maxY = e[3];
      }
      if (isFinite(minX)) extent = [minX, minY, maxX, maxY];
    }
  } catch {
    extent = null;
  }

  return {
    id: nextLayerId(),
    url,
    name,
    featureCount: features.length,
    extent,
    geojson: json,
    normalizedGeojson: normalizedJson,
    sourceProjection: effectiveProj,
    projectionInferred: false,
  };
}

/**
 * 加载用户从本地上传的 .geojson / .json 文件.
 * 走 FileReader 读文本, 复用投影探测 / 重投影 / extent 计算逻辑.
 */
export async function loadLocalGeoJsonFile(file: File): Promise<FetchedLayer> {
  const text = await file.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('文件不是合法 JSON: ' + (e instanceof Error ? e.message : String(e)));
  }
  if (!json || (json.type !== 'FeatureCollection' && json.type !== 'Feature' && !json.coordinates)) {
    throw new Error('文件内容不是合法 GeoJSON (缺少 type=FeatureCollection/Feature/几何体)');
  }
  return buildLayerFromGeoJson(json, file.name, `local://${file.name}`);
}
