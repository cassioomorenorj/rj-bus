// Mapa opcional: carrega Leaflet apenas quando a pessoa abre o mapa.
// O navegador consulta os mosaicos do OpenStreetMap somente após o clique.
let leafletPromise;
function loadLeaflet() {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.append(css);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => globalThis.L ? resolve(globalThis.L) : reject(new Error('Leaflet indisponível'));
      script.onerror = () => reject(new Error('Não foi possível carregar o mapa'));
      document.head.append(script);
    }).catch(error => { leafletPromise = undefined; throw error; });
  }
  return leafletPromise;
}
export async function openMap(container, points, { center, zoom = 15 } = {}) {
  if (!points.length) throw new Error('Nenhum ponto para exibir');
  const L = await loadLeaflet();
  if (!container.isConnected) return;
  const map = L.map(container, { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);
  const bounds = [];
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const marker = L.circleMarker([point.lat, point.lon], {
      radius: point.isUser ? 9 : 6,
      color: point.isUser ? '#2355aa' : '#356c51',
      fillColor: point.isUser ? '#4285f4' : '#56a87b',
      fillOpacity: .85, weight: 2
    }).addTo(map);
    // Leaflet escapes text via DOM textContent, avoiding HTML injection from GTFS names.
    const popup = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = point.label;
    popup.append(name);
    if (point.subtitle) {
      const detail = document.createElement('div');
      detail.textContent = point.subtitle;
      popup.append(detail);
    }
    const link = document.createElement('a');
    link.href = 'https://www.openstreetmap.org/?mlat=' + point.lat + '&mlon=' + point.lon + '#map=18/' + point.lat + '/' + point.lon;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = 'Abrir no OpenStreetMap';
    popup.append(link);
    marker.bindPopup(popup);
    bounds.push([point.lat, point.lon]);
  }
  if (center) map.setView([center.lat, center.lon], zoom);
  else if (bounds.length === 1) map.setView(bounds[0], zoom);
  else map.fitBounds(bounds, { padding: [22, 22], maxZoom: 16 });
  requestAnimationFrame(() => map.invalidateSize());
  return map;
}
