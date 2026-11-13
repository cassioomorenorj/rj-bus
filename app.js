import { inflateNetwork, normalize, distanceMeters, findRoutes, readFavorites, freshVehicles } from './core.js';
import { GPS_API } from './config.js';

const tabs = { proximos: 'Próximos', linhas: 'Linhas', pontos: 'Pontos', favoritos: 'Favoritos' };
const $ = id => document.getElementById(id);
const heading = $('heading'), content = $('content'), search = $('search'), status = $('status');
let tab = 'proximos', selected = null, network, position, locationError = '', locating = false;
let favorites = [], storageError = false, installPrompt, gpsController, gpsTimer, gpsGeneration = 0, limit = 40;
try { favorites = readFavorites(localStorage.getItem('rjbus-fav')); } catch { /* Session still works. */ }

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function button(label, action, className = 'small') {
  const el = node('button', label, className);
  el.type = 'button'; el.addEventListener('click', action); return el;
}
function note(text) { return node('p', text, 'muted'); }
function empty(text) { content.append(node('div', text, 'empty')); }
function favoriteButton(type, id, label) {
  const saved = favorites.some(f => f.type === type && f.id === id);
  const el = button(saved ? '★ Salvo' : '☆ Salvar', () => {
    favorites = saved ? favorites.filter(f => f.type !== type || f.id !== id) : [...favorites, { type, id }];
    try { localStorage.setItem('rjbus-fav', JSON.stringify(favorites)); storageError = false; }
    catch { storageError = true; }
    if (tab === 'favoritos' && !selected) render();
    else el.replaceWith(favoriteButton(type, id, label));
    updateStatus();
  });
  el.setAttribute('aria-label', (saved ? 'Remover ' : 'Salvar ') + label + ' nos favoritos');
  el.setAttribute('aria-pressed', String(saved));
  return el;
}
function updateStatus() {
  status.textContent = storageError ? 'O navegador bloqueou o armazenamento. Favoritos disponíveis só nesta sessão.'
    : network ? 'Dados de linhas e pontos: SMTR / Prefeitura do Rio. A programação pode mudar.' : 'Carregando a base de linhas e pontos…';
}
function mapLink(lat, lon, label = 'Ver no mapa') {
  const link = node('a', label, 'small link-button');
  link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
  link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function openDetail(type, id) { selected = { type, id }; render(); heading.focus(); }
function routeRow(route) {
  const row = node('div', undefined, 'row');
  const open = button('', () => openDetail('route', route.id), 'row-main');
  open.append(node('strong', route.number, 'route-number'), node('span', route.name, 'row-name'));
  row.append(open, favoriteButton('route', route.id, 'linha ' + route.number)); return row;
}
function stopRow(stop, distance) {
  const row = node('div', undefined, 'row');
  const open = button('', () => openDetail('stop', stop.id), 'row-main');
  const text = node('span', undefined, 'row-name');
  text.append(node('strong', stop.name));
  const count = stop.routeIds.length;
  text.append(node('span', `${distance === undefined ? '' : formatDistance(distance) + ' · '}${count} ${count === 1 ? 'linha cadastrada' : 'linhas cadastradas'}`, 'muted block'));
  open.append(text); row.append(open, favoriteButton('stop', stop.id, 'ponto ' + stop.name)); return row;
}
function formatDistance(value) { return value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1).replace('.', ',')} km`; }
function addResults(items, row, container = content) {
  items.slice(0, limit).forEach(item => container.append(row(item)));
  if (items.length > limit) container.append(button(`Mostrar mais (${items.length - limit})`, () => { limit += 40; render(); }));
}
function stopGps() { gpsGeneration++; clearTimeout(gpsTimer); gpsController?.abort(); gpsController = undefined; }

function render() {
  stopGps();
  heading.textContent = tabs[tab]; content.replaceChildren(); content.className = '';
  document.querySelectorAll('nav button').forEach(el => {
    const active = el.dataset.tab === tab; el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  search.placeholder = tab === 'pontos' || tab === 'proximos' ? 'Pesquisar ponto ou rua…' : tab === 'favoritos' ? 'Pesquisar nos favoritos…' : 'Número ou nome da linha…';
  updateStatus();
  if (!network) { empty('Carregando linhas e pontos…'); return; }
  if (selected) { renderDetail(); return; }
  const query = normalize(search.value.trim());
  if (tab === 'proximos') {
    content.append(note('Encontre os pontos perto de você e veja as linhas que passam por eles.'));
    const locateButton = button(locating ? 'Obtendo localização…' : position ? 'Atualizar minha localização' : 'Usar minha localização', locate, 'primary');
    locateButton.disabled = locating; content.append(locateButton);
    content.append(note('Sua localização é usada apenas neste aparelho.'));
    if (locationError) content.append(node('p', locationError, 'notice'));
    if (position) {
      const nearest = network.stops.map(stop => ({ stop, distance: distanceMeters(position, stop) })).sort((a, b) => a.distance - b.distance);
      const nearby = nearest.filter(s => s.distance <= 2000).slice(0, 20);
      if (!nearby.length) empty('Nenhum ponto cadastrado em até 2 km. Você pode pesquisar pela aba Pontos.');
      else {
        content.append(note('Distância em linha reta. O caminho a pé pode ser maior.'));
        nearby.forEach(({ stop, distance }) => content.append(stopRow(stop, distance)));
      }
    }
    return;
  }
  if (tab === 'linhas') {
    const found = findRoutes(network.routes, search.value);
    content.append(note(query ? `${found.length} linhas encontradas` : 'Pesquise o número ou o destino da linha.'));
    if (!found.length) empty('Nenhuma linha encontrada. Tente outro número ou destino.');
    else addResults(found, routeRow);
    return;
  }
  if (tab === 'pontos') {
    if (query.length < 2) { empty('Digite pelo menos 2 letras do nome da rua ou do ponto.'); return; }
    const found = network.stops.filter(s => s.query.includes(query));
    content.append(note(`${found.length} pontos encontrados`));
    if (!found.length) empty('Nenhum ponto encontrado. Tente o nome de uma rua próxima.');
    else addResults(found, stop => stopRow(stop, position ? distanceMeters(position, stop) : undefined));
    return;
  }
  let count = 0;
  favorites.forEach(f => {
    const item = f.type === 'route' ? network.routeById.get(f.id) : f.type === 'stop' ? network.stopById.get(f.id) : null;
    if (item && item.query.includes(query)) { content.append(f.type === 'route' ? routeRow(item) : stopRow(item)); count++; }
    else if (f.type === 'search' && normalize(f.id).includes(query)) {
      const row = node('div', undefined, 'row');
      row.append(button('Pesquisa: ' + f.id, () => { tab = 'linhas'; search.value = f.id; limit = 40; render(); }, 'row-main'), favoriteButton(f.type, f.id, f.id));
      content.append(row); count++;
    }
  });
  if (!count) empty(query ? 'Nenhum favorito encontrado.' : 'Salve suas linhas e pontos para encontrá-los aqui.');
}

function renderDetail() {
  content.append(button('← Voltar', () => { selected = null; render(); }));
  const item = selected.type === 'route' ? network.routeById.get(selected.id) : network.stopById.get(selected.id);
  if (!item) { empty('Este cadastro não está disponível na base atual.'); return; }
  heading.textContent = selected.type === 'route' ? 'Linha ' + item.number : 'Ponto de ônibus';
  content.append(node('h3', item.name), favoriteButton(selected.type, item.id, item.name));
  if (selected.type === 'stop') {
    content.append(mapLink(item.lat, item.lon));
    content.append(note('Código do ponto: ' + item.id));
    content.append(node('h3', 'Linhas que passam aqui'));
    findRoutes(item.routeIds.map(id => network.routeById.get(id)), '').forEach(route => content.append(routeRow(route)));
    return;
  }
  if (item.directions.length) content.append(note('Sentidos: ' + [...new Set(item.directions.map(d => d.label))].join(' / ')));
  const live = node('section', undefined, 'live-panel');
  live.append(node('h3', 'Ônibus desta linha'));
  const liveContent = node('div'); liveContent.setAttribute('aria-live', 'polite'); live.append(liveContent); content.append(live);
  if (!GPS_API) liveContent.append(note('O GPS está em preparação. A consulta de linhas e pontos já está disponível.'));
  else refreshGps(item, liveContent, gpsGeneration);
  const details = node('details'); details.append(node('summary', `${item.stopIds.length} pontos cadastrados`));
  details.append(note('Pontos de todos os sentidos e variantes. Esta lista não indica a ordem da viagem.'));
  let shown = 0;
  const list = node('div'); details.append(list);
  const more = button('Mostrar mais pontos', appendStops);
  function appendStops() {
    more.remove();
    item.stopIds.slice(shown, shown + 30).forEach(id => list.append(stopRow(network.stopById.get(id))));
    shown += 30; if (shown < item.stopIds.length) list.append(more);
  }
  details.addEventListener('toggle', () => { if (details.open && !shown) appendStops(); });
  content.append(details);
}

async function refreshGps(route, container, generation) {
  if (document.hidden || generation !== gpsGeneration) return;
  container.replaceChildren(note('Buscando posições recentes…'));
  const controller = new AbortController(); gpsController = controller;
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const feed = /mobi.?rio/i.test(route.agency) ? 'brt' : 'onibus';
    const response = await fetch(`${GPS_API}/api/gps/${feed}`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('Feed unavailable');
    const data = await response.json();
    if (!Array.isArray(data.vehicles)) throw new Error('Invalid feed');
    if (generation !== gpsGeneration || !container.isConnected) return;
    const vehicles = freshVehicles(data.vehicles, route.id);
    container.replaceChildren();
    if (!vehicles.length) container.append(note('Nenhuma posição recente recebida para esta linha. Isso não confirma que ela esteja fora de operação.'));
    else {
      container.append(note(`${vehicles.length} ônibus com posição de até 5 minutos atrás. Atualização automática a cada 30 segundos.`));
      vehicles.forEach(vehicle => {
        const row = node('div', undefined, 'row');
        const text = node('div');
        text.append(node('strong', 'Ônibus ' + vehicle.id));
        const direction = route.directions.find(d => Number(d.id) === vehicle.directionId);
        if (direction) text.append(node('span', direction.label, 'block'));
        text.append(node('span', 'Posição às ' + new Date(vehicle.timestamp * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }), 'muted block'));
        row.append(text, mapLink(vehicle.lat, vehicle.lon)); container.append(row);
      });
    }
    container.append(note('Posições informadas pela Prefeitura. Ainda não há previsão de chegada.'));
  } catch {
    if (generation !== gpsGeneration || !container.isConnected) return;
    container.replaceChildren(note(navigator.onLine ? 'Não foi possível atualizar o GPS. Tentaremos novamente em 30 segundos.' : 'Sem internet. O GPS precisa de uma conexão ativa.'));
  } finally {
    clearTimeout(timeout);
    if (generation === gpsGeneration && container.isConnected && !document.hidden) gpsTimer = setTimeout(() => refreshGps(route, container, generation), 30000);
  }
}

function locate() {
  if (!navigator.geolocation) { locationError = 'Localização não disponível neste navegador.'; render(); return; }
  locating = true; locationError = ''; render();
  navigator.geolocation.getCurrentPosition(result => {
    position = { lat: result.coords.latitude, lon: result.coords.longitude }; locating = false;
    if (tab === 'proximos' && !selected) render();
  }, error => {
    locating = false;
    locationError = error.code === 1 ? 'A localização está bloqueada. Libere a permissão no navegador ou pesquise pela aba Pontos.' : 'Não foi possível obter sua localização. Tente novamente ou pesquise pela aba Pontos.';
    if (tab === 'proximos' && !selected) render();
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
}
document.querySelectorAll('nav button').forEach(el => el.addEventListener('click', () => {
  tab = el.dataset.tab; selected = null; search.value = ''; limit = 40; render();
}));
search.addEventListener('input', () => {
  selected = null; limit = 40;
  if (tab === 'proximos' && search.value.trim()) tab = /^\d/.test(search.value.trim()) ? 'linhas' : 'pontos';
  render();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopGps(); else if (selected?.type === 'route') render();
});
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').style.display = 'block'; });
$('install').addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt; installPrompt = undefined; $('install').style.display = 'none'; await prompt.prompt();
});
window.addEventListener('appinstalled', () => { installPrompt = undefined; $('install').style.display = 'none'; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

async function loadNetwork() {
  render();
  try {
    const response = await fetch('./data/network.json');
    if (!response.ok) throw new Error('Network unavailable');
    network = inflateNetwork(await response.json()); render();
  } catch {
    content.replaceChildren(node('div', 'Não foi possível carregar a base. Confira sua conexão e tente novamente.', 'empty'), button('Tentar novamente', loadNetwork));
    status.textContent = 'Base de linhas e pontos indisponível.';
  }
}
loadNetwork();
