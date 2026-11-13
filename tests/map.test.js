import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMapPoints } from '../map.js';

const project = point => ({ x: point.lon * 10000, y: point.lat * 10000 });
const stop = (id, lon) => ({ stopId: id, lat: -22.90, lon, label: 'Ponto ' + id });

test('pontos próximos são agrupados sem remover os registros originais', () => {
  const data = [stop('1', -43.200), stop('2', -43.201), stop('3', -43.250)];
  const groups = groupMapPoints(data, project);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.deepEqual(groups[0].items.map(p => p.stopId), ['1', '2']);
  assert.equal(groups[1].items[0].stopId, '3');
});

test('sua localização nunca é agrupada com as paradas', () => {
  const here = { lat: -22.9, lon: -43.2, isUser: true, label: 'Você' };
  const groups = groupMapPoints([here, stop('1', -43.2), stop('2', -43.2)], project);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(g => g.kind === 'user').items.length, 1);
  assert.equal(groups.find(g => g.kind === 'stop').items.length, 2);
});

test('veículos e paradas têm agrupamentos separados', () => {
  const bus = { lat: -22.9, lon: -43.2, isVehicle: true };
  const groups = groupMapPoints([bus, stop('1', -43.2)], project);
  assert.deepEqual(groups.map(g => g.kind), ['vehicle', 'stop']);
});

test('descarta coordenadas inválidas em vez de gerar marcadores quebrados', () => {
  assert.equal(groupMapPoints([stop('1', NaN), stop('2', Infinity)], project).length, 0);
});
