import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const map = readFileSync(new URL('../map.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('GPS é ligado somente depois de configurar uma API pública', () => {
  assert.match(config, /export const GPS_API = ''/);
  assert.match(app, /if \(!GPS_API\) liveContent\.append/);
  assert.match(app, /else refreshGps\(item, liveContent, gpsGeneration, liveMapContainer\)/);
});

test('ônibus são exibidos no mapa e atualizados a cada 30 segundos', () => {
  assert.match(app, /vehicles = freshVehicles\(data\.vehicles, route\.id\)/);
  assert.match(app, /await updateLiveMap\(liveMapContainer, vehicles, generation\)/);
  assert.match(app, /setTimeout\(\(\) => refreshGps\(route, container, generation, liveMapContainer\), 30000\)/);
  assert.match(map, /map\.rjBusUpdatePoints = newPoints =>/);
});

test('falhas e ausência de posições removem o mapa anterior', () => {
  assert.match(app, /function clearLiveMap\(panel\)/);
  assert.match(app, /if \(!vehicles\.length\) \{/);
  assert.match(app, /clearLiveMap\(liveMapContainer\)/);
});

test('nova versão de interface, mapa e CSS está incluída no cache', () => {
  const css = html.match(/href="(\.\/style\.css\?v=\d+)"/)?.[1];
  const script = html.match(/src="(\.\/app\.js\?v=\d+)"/)?.[1];
  assert.ok(css && script);
  assert.ok(sw.includes("'" + css + "'"));
  assert.ok(sw.includes("'" + script + "'"));
  const mapImport = app.match(/'\.\/map\.js\?v=\d+'/)?.[0];
  assert.ok(mapImport && sw.includes(mapImport));
});
