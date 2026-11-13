export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function inflateNetwork(data) {
  if (data.schemaVersion !== 1 || !Array.isArray(data.routes) || !Array.isArray(data.stops)) throw new Error('Invalid network');
  const routes = data.routes.map(route => ({ ...route, stopIds: [], query: normalize(route.number + ' ' + route.name) }));
  const stops = data.stops.map(([id, name, lat, lon, routeIndexes]) => {
    const routeIds = routeIndexes.map(index => {
      if (!routes[index]) throw new Error('Invalid route reference');
      routes[index].stopIds.push(id);
      return routes[index].id;
    });
    return { id, name, lat, lon, routeIds, query: normalize(name + ' ' + id) };
  });
  return { ...data, routes, stops, routeById: new Map(routes.map(r => [r.id, r])), stopById: new Map(stops.map(s => [s.id, s])) };
}

export function distanceMeters(a, b) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function findRoutes(routes, query) {
  const q = normalize(query.trim());
  return routes.filter(r => r.query.includes(q)).sort((a, b) => {
    const exact = Number(normalize(b.number) === q) - Number(normalize(a.number) === q);
    return exact || a.number.localeCompare(b.number, 'pt-BR', { numeric: true }) || a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function readFavorites(raw) {
  try {
    const values = JSON.parse(raw || '[]');
    if (!Array.isArray(values)) return [];
    return [...new Map(values.map(v => typeof v === 'string' ? { type: 'search', id: v } : v)
      .filter(v => v && ['route', 'stop', 'search'].includes(v.type) && typeof v.id === 'string' && v.id.trim() && v.id.length <= 120)
      .map(v => [v.type + ':' + v.id, { type: v.type, id: v.id }])).values()].slice(0, 500);
  } catch { return []; }
}

export function freshVehicles(vehicles, routeId, now = Date.now()) {
  return vehicles.filter(v => v.routeId === routeId && Number.isFinite(v.timestamp)
    && now / 1000 - v.timestamp >= -60 && now / 1000 - v.timestamp <= 300
    && Number.isFinite(v.lat) && Number.isFinite(v.lon) && Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180);
}
