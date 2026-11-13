import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('localização automática consulta a permissão antes de usar GPS', () => {
  assert.match(app, /navigator\.permissions\.query\(\{ name: 'geolocation' \}\)/);
  assert.match(app, /permission\.state === 'granted'/);
  assert.match(app, /locate\(\{ automatic: true \}\)/);
  assert.match(app, /startAutoLocation\(\)/);
});

test('aplicativo guarda preferência, não guarda coordenadas', () => {
  assert.match(app, /AUTO_LOCATION_KEY = 'rjbus-auto-location'/);
  assert.match(app, /localStorage\.setItem\(AUTO_LOCATION_KEY, '1'\)/);
  assert.match(app, /localStorage\.removeItem\(AUTO_LOCATION_KEY\)/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^)]*(?:position|coords|latitude|longitude)/);
});

test('versão do código está incluída no cache offline', () => {
  const v = html.match(/src="(\.\/app\.js\?v=\d+)"/)?.[1];
  assert.ok(v);
  assert.ok(worker.includes("'" + v + "'"));
});
