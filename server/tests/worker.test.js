import test from 'node:test';
import assert from 'node:assert/strict';
import bindings from 'gtfs-realtime-bindings';
import { normalizeFeed, handleRequest } from '../worker/index.js';
const now = Math.floor(Date.now() / 1000);
function feed(entities) { return bindings.transit_realtime.FeedMessage.encode({header:{gtfsRealtimeVersion:'2.0',timestamp:now},entity:entities}).finish(); }
const vehicle = (id, timestamp, routeId='O0355AAA0A') => ({id,vehicle:{vehicle:{id},trip:{routeId},timestamp,position:{latitude:-22.9,longitude:-43.2}}});
test('decoder removes stale, future and deleted positions and retains newest duplicate', () => {
  const bytes = feed([vehicle('a',now-3),vehicle('a',now-1),vehicle('stale',now-301),vehicle('future',now+61),{...vehicle('deleted',now),isDeleted:true}]);
  const data = normalizeFeed(bytes, now*1000);
  assert.equal(data.vehicles.length,1); assert.equal(data.vehicles[0].timestamp,now-1);
  assert.equal(data.vehicles[0].directionId,null);
});
test('unknown paths, arbitrary upstream queries, foreign origins and writes are rejected', async () => {
  const fetcher=()=>{throw new Error('Must not call upstream');};
  assert.equal((await handleRequest(new Request('https://rj.test/api/gps/onibus?url=https://example.com'),{fetcher})).status,404);
  assert.equal((await handleRequest(new Request('https://rj.test/api/gps/trem'),{fetcher})).status,404);
  assert.equal((await handleRequest(new Request('https://rj.test/api/gps/onibus',{headers:{Origin:'https://example.com'}}),{fetcher})).status,403);
  assert.equal((await handleRequest(new Request('https://rj.test/api/gps/onibus',{method:'POST'}),{fetcher})).status,405);
});
test('normalizes official protobuf, supplies public-app CORS and caches a shared response', async () => {
  let calls=0, cached;
  const fetcher=async (url,options)=>{calls++;assert.equal(options.redirect,'manual');assert.equal(url,'https://dados.mobilidade.rio/gtfs/realtime/onibus/vehicle-positions');return new Response(feed([vehicle('a',now)]));};
  const cache={match:async()=>cached?.clone(),put:async(key,value)=>{cached=value;}};
  const request = new Request('https://rj.test/api/gps/onibus',{headers:{Origin:'https://cassioomorenorj.github.io'}});
  const response=await handleRequest(request,{fetcher,cache});
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://cassioomorenorj.github.io');
  assert.equal((await response.json()).vehicles.length,1);
  assert.equal((await handleRequest(request,{fetcher,cache})).status,200); assert.equal(calls,1);
});
test('upstream HTTP and malformed protobuf failures return a noncacheable 503', async () => {
  for (const fetcher of [async()=>new Response('',{status:500}),async()=>new Response('bad protobuf')]) {
    const response=await handleRequest(new Request('https://rj.test/api/gps/brt'),{fetcher});
    assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
});
test('works when the host forbids the default cache and named caching is unavailable', async () => {
  const previous = globalThis.caches;
  globalThis.caches = { get default() { throw Error('Forbidden default cache'); }, open: async()=>{throw Error('Cache unavailable');} };
  try {
    const response = await handleRequest(new Request('https://restricted.test/api/gps/onibus'), { fetcher:async()=>new Response(feed([vehicle('fallback',now)])) });
    assert.equal(response.status,200);assert.equal((await response.json()).vehicles[0].id,'fallback');
  } finally { globalThis.caches = previous; }
});
