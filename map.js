// Mapa interativo do RJ Bus. 🚌 identifica pontos CADASTRADOS, não ônibus ao vivo.
// Leaflet e mosaicos OpenStreetMap são carregados pelo navegador quando o mapa abre.
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
      script.onload = () => globalThis.L ? resolve(globalThis.L) : reject(new Error('Biblioteca do mapa indisponível'));
      script.onerror = () => reject(new Error('Não foi possível carregar o mapa'));
      document.head.append(script);
    }).catch(error => { leafletPromise = undefined; throw error; });
  }
  return leafletPromise;
}

// Agrupa marcadores próximos em pixels para evitar dezenas de emojis sobrepostos.
// Mantém posição do usuário independente. A lista de paradas continua acessível no popup.
export function groupMapPoints(points, project, radius = 43) {
  const groups = [];
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const kind = point.isUser ? 'user' : point.isVehicle ? 'vehicle' : 'stop';
    const pixel = project(point);
    if (!Number.isFinite(pixel.x) || !Number.isFinite(pixel.y)) continue;
    let group;
    if (kind !== 'user') {
      group = groups.find(item => item.kind === kind &&
        (item.x - pixel.x) ** 2 + (item.y - pixel.y) ** 2 <= radius ** 2);
    }
    if (!group) {
      groups.push({ kind, x: pixel.x, y: pixel.y, lat: point.lat, lon: point.lon, items: [point] });
    } else {
      const count = group.items.length;
      group.x = (group.x * count + pixel.x) / (count + 1);
      group.y = (group.y * count + pixel.y) / (count + 1);
      group.lat = (group.lat * count + point.lat) / (count + 1);
      group.lon = (group.lon * count + point.lon) / (count + 1);
      group.items.push(point);
    }
  }
  return groups;
}

function createIcon(L, kind, count = 1) {
  const label = kind === 'user' ? '●' : '🚌';
  const counter = count > 1 ? '<span class="rjbus-pin-count">' + count + '</span>' : '';
  return L.divIcon({
    className: 'rjbus-marker-anchor',
    html: '<span class="rjbus-pin rjbus-pin-' + kind + '" aria-hidden="true">' + label + counter + '</span>',
    iconSize: [42, 48],
    iconAnchor: [21, 45],
    popupAnchor: [0, -41],
  });
}

function addText(parent, tag, value, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  parent.append(el);
  return el;
}

function addStopActions(parent, point, onSelect) {
  if (point.stopId && typeof onSelect === 'function') {
    const btn = addText(parent, 'button', 'Ver linhas deste ponto', 'map-open-stop');
    btn.type = 'button';
    btn.addEventListener('click', () => onSelect(point.stopId));
  }
  const link = addText(parent, 'a', 'Ver no OpenStreetMap');
  link.href = 'https://www.openstreetmap.org/?mlat=' + point.lat + '&mlon=' + point.lon +
    '#map=18/' + point.lat + '/' + point.lon;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  if (point.stopId) {
    const walk = addText(parent, 'a', 'Como chegar a pé');
    walk.href = 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(point.lat + ',' + point.lon) + '&travelmode=walking';
    walk.target = '_blank';
    walk.rel = 'noopener noreferrer';
  }
}

function createPopup(group, onSelect, zoomIn) {
  const root = document.createElement('div');
  root.className = 'rjbus-map-popup';
  if (group.items.length === 1) {
    const point = group.items[0];
    addText(root, 'strong', point.isUser ? 'Sua localização' : point.label || 'Ponto de ônibus');
    if (point.subtitle) addText(root, 'div', point.subtitle, 'map-popup-subtitle');
    if (!point.isUser) addStopActions(root, point, onSelect);
  } else {
    addText(root, 'strong', group.items.length + (group.kind === 'vehicle' ? ' ônibus nesta região' : ' pontos nesta região'));
    addText(root, 'div', 'Amplie para separar os marcadores ou escolha abaixo.', 'map-popup-subtitle');
    const zoom = addText(root, 'button', 'Aproximar pontos', 'map-open-stop');
    zoom.type = 'button';
    zoom.addEventListener('click', zoomIn);
    const items = document.createElement('div');
    items.className = 'map-popup-list';
    for (const point of group.items) {
      const row = document.createElement('div');
      row.className = 'map-popup-item';
      addText(row, 'strong', (group.kind === 'vehicle' ? '🚌 ' : '📍 ') + (point.label || (group.kind === 'vehicle' ? 'Ônibus' : 'Ponto de ônibus')));
      if (point.subtitle) addText(row, 'span', point.subtitle, 'map-popup-subtitle');
      addStopActions(row, point, onSelect);
      items.append(row);
    }
    root.append(items);
  }
  return root;
}

export async function openMap(container, points, { center, zoom = 15, onSelect } = {}) {
  if (!points.length) throw new Error('Nenhum ponto para exibir');
  const L = await loadLeaflet();
  if (!container.isConnected) return null;
  container.replaceChildren();

  const map = L.map(container, { scrollWheelZoom: false, zoomControl: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  }).addTo(map);

  const onlyValid = data => data.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  let valid = onlyValid(points);
  if (!valid.length) { map.remove(); throw new Error('Coordenadas inválidas'); }

  const bounds = L.latLngBounds(valid.map(point => [point.lat, point.lon]));
  const fit = () => {
    if (valid.length === 1) map.setView([valid[0].lat, valid[0].lon], zoom);
    else map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  };
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) {
    map.setView([center.lat, center.lon], zoom);
  } else fit();

  const layer = L.layerGroup().addTo(map);
  const draw = () => {
    layer.clearLayers();
    const groups = groupMapPoints(valid, p => map.project([p.lat, p.lon], map.getZoom()));
    for (const group of groups) {
      const icon = createIcon(L, group.kind, group.items.length);
      const marker = L.marker([group.lat, group.lon], {
        icon, keyboard: true,
        alt: group.kind === 'user' ? 'Sua localização' :
          group.items.length > 1 ? group.items.length + ' pontos próximos' :
            group.items[0].label || 'Ponto de ônibus'
      }).addTo(layer);
      const nearby = () => {
        if (map.getZoom() < 18) map.setView([group.lat, group.lon], Math.min(18, map.getZoom() + 2));
      };
      marker.bindPopup(createPopup(group, onSelect, nearby), { maxWidth: 280, minWidth: 205 });
    }
  };
  draw();
  map.on('zoomend', draw);
  // Atualiza marcadores de veículos sem recriar o mapa nem alterar zoom/posição.
  map.rjBusUpdatePoints = newPoints => {
    valid = onlyValid(newPoints);
    draw();
  };

  // Controles compactos deixam mais espaço para ruas e marcadores.
  L.control.zoom({ position: 'topleft', zoomInTitle: 'Aproximar mapa', zoomOutTitle: 'Afastar mapa' }).addTo(map);
  const controls = L.control({ position: 'topright' });
  controls.onAdd = () => {
    const wrapper = L.DomUtil.create('div', 'map-controls');
    L.DomEvent.disableClickPropagation(wrapper);
    L.DomEvent.disableScrollPropagation(wrapper);
    const control = (label, title, action) => {
      const btn = L.DomUtil.create('button', 'map-control-button', wrapper);
      btn.type = 'button';
      btn.textContent = label;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      L.DomEvent.on(btn, 'click', action);
      return btn;
    };
    control('⊞', 'Mostrar todos os pontos', fit);
    const expand = control('⛶', 'Ampliar mapa', () => {
      const expanded = container.classList.toggle('map-expanded');
      expand.textContent = expanded ? '×' : '⛶';
      expand.title = expanded ? 'Reduzir mapa' : 'Ampliar mapa';
      expand.setAttribute('aria-label', expand.title);
      requestAnimationFrame(() => map.invalidateSize());
    });
    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) {
      control('⌖', 'Centralizar na minha localização',
        () => map.setView([center.lat, center.lon], 16));
    }
    return wrapper;
  };
  controls.addTo(map);

  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const box = L.DomUtil.create('div', 'rjbus-map-legend');
    addText(box, 'span', '🚌 Pontos cadastrados');
    if (valid.some(point => point.isUser)) addText(box, 'span', '🔵 Você');
    if (valid.some(point => point.isVehicle)) addText(box, 'span', '🟠 Veículos com GPS');
    return box;
  };
  legend.addTo(map);
  const onKey = event => {
    if (event.key === 'Escape' && container.classList.contains('map-expanded')) {
      container.classList.remove('map-expanded');
      requestAnimationFrame(() => map.invalidateSize());
    }
  };
  document.addEventListener('keydown', onKey);
  map.on('unload', () => document.removeEventListener('keydown', onKey));
  requestAnimationFrame(() => { if (container.isConnected) map.invalidateSize(); });
  return map;
}
