// Mapa interativo carregado quando necessário. Sem publicidade ou rastreamento no RJ Bus.
// Leaflet e mapas de terceiros exigem internet para a primeira abertura.
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
      script.onload = () => globalThis.L ? resolve(globalThis.L) : reject(new Error('Biblioteca de mapa indisponível'));
      script.onerror = () => reject(new Error('Não foi possível carregar o mapa'));
      document.head.append(script);
    }).catch(error => { leafletPromise = undefined; throw error; });
  }
  return leafletPromise;
}

// Pontos são da base GTFS e não representam a ordem real de viagem.
export async function openMap(container, points, { center, zoom = 15, onSelect } = {}) {
  if (!points.length) throw new Error('Nenhum ponto para exibir');
  const L = await loadLeaflet();
  if (!container.isConnected) return null;
  container.replaceChildren();
  const map = L.map(container, { scrollWheelZoom: false, preferCanvas: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);
  const bounds = [];
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const isUser = !!point.isUser;
    const isVehicle = !!point.isVehicle;
    const marker = L.circleMarker([point.lat, point.lon], {
      radius: isUser ? 10 : isVehicle ? 8 : 6,
      color: isUser ? '#194b99' : isVehicle ? '#ae622c' : '#356c51',
      fillColor: isUser ? '#4285f4' : isVehicle ? '#ee9d57' : '#56a87b',
      fillOpacity: .9, weight: 2
    }).addTo(map);
    // Dados oficiais são colocados como texto, nunca como HTML não confiável.
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = point.label || 'Ponto de ônibus';
    popup.append(title);
    if (point.subtitle) {
      const detail = document.createElement('div');
      detail.textContent = point.subtitle;
      popup.append(detail);
    }
    if (point.stopId && typeof onSelect === 'function') {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'map-open-stop';
      control.textContent = 'Ver linhas deste ponto';
      control.addEventListener('click', () => onSelect(point.stopId));
      popup.append(control);
    }
    const link = document.createElement('a');
    link.href = 'https://www.openstreetmap.org/?mlat=' + point.lat + '&mlon=' + point.lon + '#map=18/' + point.lat + '/' + point.lon;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Abrir no OpenStreetMap';
    popup.append(link);
    marker.bindPopup(popup);
    bounds.push([point.lat, point.lon]);
  }
  if (!bounds.length) { map.remove(); throw new Error('Coordenadas inválidas'); }
  const fit = () => {
    if (bounds.length === 1) map.setView(bounds[0], zoom);
    else map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  };
  if (center) map.setView([center.lat, center.lon], zoom);
  else fit();
  const controls = L.control({ position: 'topright' });
  controls.onAdd = () => {
    const wrapper = L.DomUtil.create('div', 'map-controls');
    const all = L.DomUtil.create('button', 'map-control-button', wrapper);
    all.type = 'button';
    all.textContent = 'Ver todos';
    all.title = 'Enquadrar todos os pontos';
    L.DomEvent.disableClickPropagation(wrapper);
    L.DomEvent.disableScrollPropagation(wrapper);
    L.DomEvent.on(all, 'click', fit);
    const expand = L.DomUtil.create('button', 'map-control-button', wrapper);
    expand.type = 'button';
    expand.textContent = 'Ampliar mapa';
    expand.title = 'Alternar mapa em tela ampliada';
    L.DomEvent.on(expand, 'click', () => {
      const expanded = container.classList.toggle('map-expanded');
      expand.textContent = expanded ? 'Reduzir mapa' : 'Ampliar mapa';
      requestAnimationFrame(() => map.invalidateSize());
    });
    if (center) {
      const me = L.DomUtil.create('button', 'map-control-button', wrapper);
      me.type = 'button';
      me.textContent = 'Minha posição';
      me.title = 'Centralizar na sua localização';
      L.DomEvent.on(me, 'click', () => map.setView([center.lat, center.lon], 16));
    }
    return wrapper;
  };
  controls.addTo(map);
  requestAnimationFrame(() => { if (container.isConnected) map.invalidateSize(); });
  return map;
}
