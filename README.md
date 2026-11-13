# RJ Bus

Aplicativo gratuito e sem anúncios para consultar os ônibus da cidade do Rio de Janeiro.

**Abrir:** https://cassioomorenorj.github.io/rj-bus/

## Disponível

- Busca por número, nome ou destino da linha.
- Busca de pontos pelo nome da rua ou pelo código do ponto.
- Linhas cadastradas em cada ponto.
- Pontos próximos, calculados no aparelho a partir da localização autorizada.
- Mapas interativos sob demanda para pontos próximos, um ponto específico e pontos de uma linha. Os mapas exibem cadastros, não o trajeto ordenado nem a posição atual dos veículos.
- Favoritos de linhas e pontos, guardados neste navegador.
- Instalação como aplicativo em navegadores compatíveis.
- Consulta da base já carregada sem internet.

A interface é simples, sem anúncios, cadastro ou cobrança. O GPS está preparado em `server/`, mas a integração pública permanece desativada em `config.js` até a liberação do serviço. A versão pública não mostra posições nem previsões de chegada enquanto isso.

## Dados oficiais

Fonte: [GTFS da SMTR / Prefeitura do Rio](https://dados.mobilidade.rio/gtfs/schedule), consultado em 13/11/2026. A transformação inclui 494 cadastros de linhas, 7.493 pontos referenciados por viagens e 52.064 relações entre linha e ponto. Variantes podem compartilhar o mesmo número de linha.

O arquivo `feed_info.txt` declara cobertura de 01/01/2024 a 31/12/2026. `generatedAt` registra a transformação local, não a data de publicação da Prefeitura. A base representa a rede planejada: estar no cadastro não garante operação naquele momento.

As listas de pontos de uma linha reúnem sentidos e variantes; não representam a ordem do trajeto. Distâncias de pontos próximos são em linha reta, não percursos a pé.

GPS preparado com os novos feeds [Ônibus](https://www.arcgis.com/home/item.html?id=997bc16cc4344a5cb0e48ab06cbdfd1f) e [BRT](https://www.arcgis.com/home/item.html?id=8bb196cc02174d25b77437bb2f6443d4) da SMTR. Esses catálogos informam licença CC BY 4.0 e caráter beta. Posições acima de 5 minutos são descartadas, sem estimar horários de chegada. A transformação e a apresentação dos dados são do RJ Bus; não se trata de aplicativo oficial da Prefeitura.

## Privacidade

Sua localização é usada na memória do aparelho para encontrar pontos próximos e não é enviada ao serviço de GPS. Favoritos ficam no armazenamento do navegador. Ao abrir “Ver no mapa”, você acessa o OpenStreetMap com as coordenadas do ponto ou do ônibus selecionado. O mapa interativo é opcional: ao clicar para abri-lo, seu navegador carrega Leaflet via unpkg e mosaicos do OpenStreetMap, expondo a esses serviços dados técnicos da conexão. Sua posição não é enviada ao servidor do RJ Bus. Não há publicidade ou código de análise de visitantes adicionado ao aplicativo.

## Executar e verificar

Sem dependências no frontend. Sirva esta pasta por HTTP, por exemplo `python3 -m http.server 8000`, e abra `http://localhost:8000`. Geolocalização e instalação exigem HTTPS ou localhost.

```sh
npm test
```

Para atualizar a base, baixe o GTFS oficial e execute:

```sh
python3 scripts/update_gtfs.py /caminho/gtfs.zip /tmp/rj-bus-gtfs
python3 scripts/pack_data.py /tmp/rj-bus-gtfs data/network.json
npm test
```

Os testes incluem contagens da versão atual; revise essas expectativas contra o relatório `validation.json` quando a Prefeitura mudar o cadastro. Não aceite automaticamente uma redução inesperada da base.

A publicação do frontend usa GitHub Pages, branch `main`, pasta raiz. O serviço em `server/` é publicado separadamente. Nunca coloque credenciais em `config.js` ou no repositório.
