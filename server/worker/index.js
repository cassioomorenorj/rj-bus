import bindings from 'gtfs-realtime-bindings';

const SOURCES = Object.freeze({
  onibus: 'https://dados.mobilidade.rio/gtfs/realtime/onibus/vehicle-positions',
  brt: 'https://dados.mobilidade.rio/gtfs/realtime/brt/vehicle-positions',
});
const APP_ORIGIN = 'https://cassioomorenorj.github.io';
const MAX_BYTES = 8 * 1024 * 1024;
const pending = new Map();
const memoryEntries = new Map();
const memoryCache = {
  async match(key) {
    const entry = memoryEntries.get(key.url);
    if (entry && entry.expires > Date.now()) return entry.response.clone();
    memoryEntries.delete(key.url);
  },
  async put(key, response) { memoryEntries.set(key.url, { response: response.clone(), expires: Date.now() + 20000 }); },
};
async function responseCache() {
  // Sites isolates cannot use caches.default. A named cache is preferred;
  // a bounded, short-lived in-process cache also supports other runtimes.
  try { return await globalThis.caches?.open('rj-bus-gps-v1') || memoryCache; }
  catch { return memoryCache; }
}

export function normalizeFeed(bytes, now = Date.now()) {
  const feed = bindings.transit_realtime.FeedMessage.decode(bytes);
  if (!feed.header?.gtfsRealtimeVersion) throw new Error('Invalid feed');
  const vehicles = new Map();
  let ignored = 0;
  for (const entity of feed.entity || []) {
    const v = entity.vehicle;
    if (entity.isDeleted || !v?.position || !v.trip?.routeId) { ignored++; continue; }
    const lat = v.position.latitude, lon = v.position.longitude;
    const timestamp = Number(v.timestamp);
    const age = now / 1000 - timestamp;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180
      || !timestamp || age > 300 || age < -60) { ignored++; continue; }
    const id = String(v.vehicle?.id || entity.id);
    const value = { id, routeId: v.trip.routeId, lat, lon, timestamp,
      directionId: Object.hasOwn(v.trip, 'directionId') ? v.trip.directionId : null };
    if (!vehicles.has(id) || timestamp > vehicles.get(id).timestamp) vehicles.set(id, value);
  }
  return { sourceTimestamp: Number(feed.header.timestamp) || null, fetchedAt: new Date(now).toISOString(),
    maxPositionAgeSeconds: 300, ignored, vehicles: [...vehicles.values()] };
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
function cors(response, origin) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}
async function readLimited(response) {
  if (Number(response.headers.get('Content-Length')) > MAX_BYTES) throw new Error('Feed too large');
  if (!response.body) throw new Error('Empty feed');
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) { await reader.cancel(); throw new Error('Feed too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
async function upstream(feed, fetcher) {
  const response = await fetcher(SOURCES[feed], { signal: AbortSignal.timeout(15000), redirect: 'manual', headers: { Accept: 'application/x-protobuf' } });
  if (!response.ok) throw new Error('Upstream HTTP ' + response.status);
  const data = normalizeFeed(await readLimited(response));
  return json({ ...data, feed, source: SOURCES[feed], attribution: 'SMTR / Prefeitura do Rio de Janeiro — CC BY 4.0' }, 200,
    { 'Cache-Control': 'public, max-age=20, s-maxage=20' });
}

const PAGE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RJ Bus — GPS</title>
<style>body{font:16px system-ui;background:#f8faf9;color:#24342e;margin:0}main{max-width:680px;margin:32px auto;padding:24px;background:white;border:1px solid #e1e7e3;border-radius:16px}h1{font-size:24px}p{line-height:1.6}button,a{font:inherit;color:#356c51}button{padding:10px;border:1px solid #cddbd2;border-radius:8px;background:white}li{margin:12px 0}small{color:#65776c}</style>
<main><h1>RJ Bus · GPS</h1><p>Teste da conexão com as posições oficiais dos ônibus do Rio.</p><button id="load">Consultar ônibus agora</button><p id="status" role="status">Clique para consultar a fonte oficial.</p><ul id="vehicles"></ul><p><small>Somente posições com até 5 minutos. Sem previsão de chegada. Dados: SMTR / Prefeitura do Rio, licença CC BY 4.0.</small></p><a href="https://cassioomorenorj.github.io/rj-bus/">Abrir RJ Bus</a></main>
<script>const button=document.getElementById('load');button.onclick=async()=>{button.disabled=true;const s=document.getElementById('status'),list=document.getElementById('vehicles');s.textContent='Consultando…';list.replaceChildren();try{const r=await fetch('/api/gps/onibus');if(!r.ok)throw Error();const d=await r.json();s.textContent=d.vehicles.length+' ônibus com posição recente recebida. Consulta às '+new Date(d.fetchedAt).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})+'.';for(const v of d.vehicles.slice(0,10)){const li=document.createElement('li'),a=document.createElement('a');li.append('Ônibus '+v.id+' · '+new Date(v.timestamp*1000).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · ');a.textContent='Ver posição';a.href='https://www.openstreetmap.org/?mlat='+v.lat+'&mlon='+v.lon+'#map=16/'+v.lat+'/'+v.lon;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li)}}catch{s.textContent='A fonte oficial está indisponível no momento. Tente novamente.'}finally{button.disabled=false}}</script></html>`;

export async function handleRequest(request, { fetcher = fetch, cache, ctx } = {}) {
  const url = new URL(request.url), origin = request.headers.get('Origin');
  if (origin && origin !== APP_ORIGIN && origin !== url.origin) return json({ error: 'Origin not allowed' }, 403);
  const respond = response => cors(response, origin || APP_ORIGIN);
  if (request.method !== 'GET' && request.method !== 'OPTIONS') return respond(json({ error: 'Method not allowed' }, 405, { Allow: 'GET, OPTIONS' }));
  if (url.pathname === '/' && request.method === 'GET') return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
  const feed = url.pathname.match(/^\/api\/gps\/(onibus|brt)$/)?.[1];
  if (!feed || url.search) return respond(json({ error: 'Not found' }, 404));
  if (request.method === 'OPTIONS') return respond(new Response(null, { status: 204 }));
  cache = cache || await responseCache();
  const cacheKey = new Request(url.origin + url.pathname);
  const cached = await cache.match(cacheKey).catch(() => undefined);
  if (cached) return respond(cached);
  try {
    if (!pending.has(feed)) pending.set(feed, upstream(feed, fetcher).finally(() => pending.delete(feed)));
    const response = (await pending.get(feed)).clone();
    if (cache) {
      const save = cache.put(cacheKey, response.clone()).catch(() => undefined);
      if (ctx?.waitUntil) ctx.waitUntil(save); else await save;
    }
    return respond(response);
  } catch (error) {
    console.warn('GPS source unavailable', feed, String(error?.message || error).slice(0, 200));
    return respond(json({ error: 'Fonte de GPS temporariamente indisponível. Tente novamente.' }, 503, { 'Retry-After': '30' }));
  }
}
export default { fetch(request, env, ctx) { return handleRequest(request, { ctx }); } };
