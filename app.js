'use strict';

const tabs = { proximos: 'Próximos', linhas: 'Linhas', pontos: 'Pontos', favoritos: 'Favoritos' };
const storageKey = 'rjbus-fav';
const heading = document.getElementById('heading');
const content = document.getElementById('content');
const search = document.getElementById('search');
const status = document.getElementById('status');
const installButton = document.getElementById('install');
let tab = 'proximos';
let favorites = [];
let installPrompt;

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) {
    favorites = [...new Set(saved.filter(value => typeof value === 'string' && value.trim() && value.length <= 120))];
  }
} catch {
  // A blocked or damaged storage entry must not stop the interface from opening.
}

function saveFavorites(values) {
  favorites = values;
  try {
    localStorage.setItem(storageKey, JSON.stringify(values));
  } catch {
    status.textContent = 'Favoritos guardados só nesta sessão: o navegador bloqueou o armazenamento.';
  }
}

function button(label, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'small';
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function render() {
  heading.textContent = tabs[tab];
  document.querySelectorAll('nav button').forEach(element => {
    const active = element.dataset.tab === tab;
    element.classList.toggle('active', active);
    if (active) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  });
  content.replaceChildren();
  content.className = 'empty';
  const query = search.value.trim();

  if (tab === 'proximos') {
    content.append('Permita o acesso à localização para encontrar pontos próximos.');
    const paragraph = document.createElement('p');
    paragraph.append(button('Usar minha localização', locate));
    content.append(paragraph);
    return;
  }

  if (tab === 'favoritos') {
    const matches = favorites.filter(value => value.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    if (!matches.length) {
      content.textContent = query ? 'Nenhum favorito encontrado.' : 'Nenhum favorito salvo.';
      return;
    }
    content.className = '';
    matches.forEach(value => {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('span');
      label.textContent = value;
      const remove = button('Remover', () => {
        saveFavorites(favorites.filter(item => item !== value));
        render();
      });
      remove.setAttribute('aria-label', 'Remover ' + value + ' dos favoritos');
      row.append(label, remove);
      content.append(row);
    });
    return;
  }

  if (!query) {
    content.textContent = tab === 'linhas'
      ? 'Pesquise uma linha para consultar seu trajeto e seus ônibus.'
      : 'Aqui aparecerão os pontos de ônibus e as linhas que passam por eles.';
    return;
  }

  content.append('A busca por ');
  const emphasis = document.createElement('strong');
  emphasis.textContent = query;
  content.append(emphasis, ' estará disponível quando conectarmos os dados oficiais.');
  const paragraph = document.createElement('p');
  const save = button(favorites.includes(query) ? '✓ Salvo' : '☆ Salvar pesquisa', () => {
    if (!favorites.includes(query)) saveFavorites([...favorites, query]);
    save.textContent = '✓ Salvo';
    save.disabled = true;
  });
  save.disabled = favorites.includes(query);
  paragraph.append(save);
  content.append(paragraph);
}

function locate() {
  if (!navigator.geolocation) {
    content.textContent = 'Localização não disponível neste navegador.';
    return;
  }
  content.textContent = 'Obtendo localização...';
  navigator.geolocation.getCurrentPosition(
    () => {
      if (tab === 'proximos') {
        content.textContent = 'Localização obtida. Os pontos próximos aparecerão após a integração com a base oficial.';
      }
    },
    () => {
      if (tab === 'proximos') {
        content.textContent = 'Não foi possível obter a localização. Confira a permissão do navegador.';
      }
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
  );
}

document.querySelectorAll('nav button').forEach(element => {
  element.addEventListener('click', () => {
    tab = element.dataset.tab;
    search.value = '';
    render();
  });
});
search.addEventListener('input', render);

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.style.display = 'block';
});
installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = undefined;
  installButton.style.display = 'none';
  await prompt.prompt();
});
window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  installButton.style.display = 'none';
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    status.textContent = 'Protótipo sem dados em tempo real. Acesso sem conexão indisponível neste navegador.';
  });
}
render();
