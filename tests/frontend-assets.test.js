import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const map = readFileSync(new URL('../map.js', import.meta.url), 'utf8');

test('versões dos arquivos da interface coincidem com cache offline', () => {
  const css = html.match(/href="(\.\/style\.css\?v=\d+)"/)?.[1];
  const script = html.match(/src="(\.\/app\.js\?v=\d+)"/)?.[1];
  assert.ok(css, 'HTML deve especificar versão do CSS');
  assert.ok(script, 'HTML deve especificar versão do app');
  for (const file of [css, script]) assert.ok(sw.includes("'" + file + "'"), 'SW deve cachear: ' + file);
});

test('módulos do aplicativo e mapa estão incluídos no cache offline', () => {
  for (const name of ['core', 'config', 'map']) {
    const version = app.match(new RegExp("'\\./" + name + "\\.js\\?v=\\d+'"))?.[0];
    assert.ok(version, 'App importa ' + name + ' com versão');
    assert.ok(sw.includes(version), 'SW deve cachear: ' + version);
  }
});

test('mapas permitem abrir detalhes de uma parada e centralizar a vista', () => {
  assert.ok(map.includes('onSelect(point.stopId)'));
  assert.ok(map.includes('Enquadrar todos os pontos'));
  assert.ok(map.includes('Centralizar na sua localização'));
});

test('endereço compartilhável pode abrir uma linha ou ponto específico', () => {
  assert.ok(app.includes("url.searchParams.set(type === 'route' ? 'linha' : 'ponto', id)"));
  assert.ok(app.includes("params.has('linha')"));
  assert.ok(app.includes("params.has('ponto')"));
});
