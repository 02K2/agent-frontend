import GeoJSON from 'ol/format/GeoJSON';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { get as getProjection } from 'ol/proj';

export interface FetchedLayer {
  id: string;
  url: string;
  name: string;
  featureCount: number;
  extent: [number, number, number, number] | null;
  geojson: object;
  sourceProjection: string;
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

  // EPSG:4526 — CGCS2000 / 3-degree Gauss-Kruger CM 114E  (覆盖湖北/武汉)
  proj4.defs(
    'EPSG:4526',
    '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs',
  );
  // EPSG:4549 — CGCS2000 / 3-degree Gauss-Kruger CM 120E (备用)
  proj4.defs(
    'EPSG:4549',
    '+proj=tmerc +lat_0=0 +lon_0=120 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs',
  );
  // EPSG:4490 — CGCS2000 地理坐标 (与 4326 几乎一致, 作为兜底)
  // 注意: proj4.defs 第二参数必须是 proj4 字符串/WKT, 不能直接传 'EPSG:4326' (会触发 colon 解析错误)
  proj4.defs(
    'EPSG:4490',
    '+proj=longlat +ellps=GRS80 +no_defs',
  );
  // EPSG:32650 — WGS84 / UTM 50N (备用)
  proj4.defs(
    'EPSG:32650',
    '+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs',
  );

  try {
    register(proj4);
  } catch {
    /* 已注册过 */
  }
}

/**
 * 从 GeoJSON 的 crs.name 提取 EPSG code, 例如:
 *   "urn:ogc:def:crs:EPSG::4526" -> "EPSG:4526"
 *   "EPSG:4326" -> "EPSG:4326"
 */
function detectProjection(geojson: any): string {
  const name = geojson?.crs?.properties?.name;
  if (typeof name === 'string') {
    const m = name.match(/EPSG[:]*(\d+)/i);
    if (m) return `EPSG:${m[1]}`;
  }
  return 'EPSG:4326';
}

/**
 * 把一个不在 4326 的 GeoJSON 整体重投影到 4326.
 * OL 不会自动把 EPSG:4526 -> EPSG:3857, 我们手动用 proj4 转.
 */
function reprojectTo4326(geojson: any, sourceProj: string): any {
  if (sourceProj === 'EPSG:4326' || sourceProj === 'EPSG:4490') {
    return geojson; // 不需要转
  }
  // 验证 proj4 知道这个投影
  try {
    proj4(sourceProj, 'EPSG:4326', [0, 0]);
  } catch {
    return geojson; // 不认识, 原样返回
  }

  const transformCoords = (coords: any): any => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      const [lon, lat] = proj4(sourceProj, 'EPSG:4326', [x, y]);
      return [lon, lat, ...coords.slice(2)];
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
  // 改写 crs
  result.crs = { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } };
  return result;
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

  const sourceProj = detectProjection(json);
  // 保留原始投影, 不做 normalize — 加载时由 MapPanel 按 sourceProjection 一次性投到 3857。

  const reader = new GeoJSON();
  let features: ReturnType<typeof reader.readFeatures>;
  try {
    // 加载 features 时直接 sourceProj -> 3857 (一次性转换)
    features = reader.readFeatures(json, {
      dataProjection: sourceProj,
      featureProjection: 'EPSG:3857',
    });
  } catch (e) {
    throw new Error('GeoJSON 解析失败: ' + (e instanceof Error ? e.message : String(e)));
  }

  let extent: [number, number, number, number] | null = null;
  try {
    if (features.length > 0) {
      // extent 也按 sourceProj -> 3857 算, 后续 MapPanel 直接用 (不要再 transform)
      const rawFeatures = reader.readFeatures(json, {
        dataProjection: sourceProj,
        featureProjection: 'EPSG:3857',
      });
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const f of rawFeatures) {
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
    sourceProjection: sourceProj,
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
