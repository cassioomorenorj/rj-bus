import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inflateNetwork, findRoutes, normalize, distanceMeters, readFavorites, freshVehicles } from '../core.js';
const network = inflateNetwork(JSON.parse(fs.readFileSync(new URL('../data/network.json', import.meta.url))));

test('official network joins routes to the stops served by actual GTFS trips', () => {
  assert.equal(network.routes.length, 494); assert.equal(network.stops.length, 7493);
  const route = network.routeById.get('O0355AAA0A');
  assert.equal(route.number, '355'); assert.equal(route.stopIds.length, 147);
  assert.ok(route.stopIds.includes('1001O00006C0'));
  let pairs = 0;
  for (const stop of network.stops) {
    assert.ok(Number.isFinite(stop.lat) && Math.abs(stop.lat) <= 90);
    assert.ok(Number.isFinite(stop.lon) && Math.abs(stop.lon) <= 180);
    for (const id of stop.routeIds) { assert.ok(network.routeById.get(id).stopIds.includes(stop.id)); pairs++; }
  }
  assert.equal(pairs, 52064);
});
test('route lookup accepts unaccented destination text and prioritizes exact numbers', () => {
  assert.equal(findRoutes(network.routes, '355')[0].id, 'O0355AAA0A');
  assert.ok(findRoutes(network.routes, 'praca tiradentes').some(r => r.number === '355'));
  assert.equal(normalize('São Cristóvão'), 'sao cristovao');
});
test('nearby calculation is local, geographic and handles identical coordinates', () => {
  const stop = network.stopById.get('1001O00006C0');
  assert.equal(distanceMeters(stop, stop), 0);
  assert.ok(distanceMeters(stop, { lat: stop.lat + .01, lon: stop.lon }) > 1100);
  assert.ok(distanceMeters(stop, { lat: stop.lat + .01, lon: stop.lon }) < 1120);
});
test('favorites migrate old searches, deduplicate and tolerate damaged storage', () => {
  assert.deepEqual(readFavorites('{broken'), []);
  assert.deepEqual(readFavorites('{"type":"route"}'), []);
  assert.deepEqual(readFavorites('["355","355",null,{"type":"stop","id":"x"},{"type":"bad","id":"x"}]'), [{type:'search',id:'355'},{type:'stop',id:'x'}]);
});
test('only matching, fresh, valid vehicle positions are displayed', () => {
  const now = 2000000, good = { id:'bus',routeId:'355',lat:-22.9,lon:-43.2,timestamp:1999 };
  assert.equal(freshVehicles([good,{...good,timestamp:1699},{...good,timestamp:2061},{...good,lat:200},{...good,routeId:'999'}], '355', now).length, 1);
});
