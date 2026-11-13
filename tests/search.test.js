import test from 'node:test';
import assert from 'node:assert/strict';
import { findStops, normalize } from '../core.js';

function stop(id, name, lat = -22.9, lon = -43.2) {
  return { id, name, lat, lon, query: normalize(name + ' ' + id) };
}

test('a busca de pontos prioriza código exato e nomes completos', () => {
  const data = [
    stop('p3', 'Rua Barata Ribeiro, 500'),
    stop('p2', 'Barata Ribeiro'),
    stop('p1', 'Rua Barata Ribeiro, 100'),
    stop('BR123', 'Avenida Atlântica')
  ];
  assert.equal(findStops(data, 'barata ribeiro')[0].id, 'p2');
  assert.equal(findStops(data, 'BR123')[0].id, 'BR123');
  assert.deepEqual(findStops(data, 'zxy'), []);
  assert.deepEqual(findStops(data, 'b'), []);
});

test('a busca de pontos usa distância como desempate entre ruas iguais', () => {
  const data = [
    stop('longe', 'Rua das Flores', -23.2, -43.2),
    stop('perto', 'Rua das Flores', -22.901, -43.2),
  ];
  const result = findStops(data, 'rua das flores', { lat: -22.9, lon: -43.2 });
  assert.equal(result[0].id, 'perto');
  assert.equal(result[1].id, 'longe');
});

test('busca de pontos ignora maiúsculas e acentos', () => {
  const data = [stop('c1', 'São Cristóvão'), stop('c2', 'Rua da Lapa')];
  assert.equal(findStops(data, 'sao cristovao')[0].id, 'c1');
});
