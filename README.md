# RJ Bus

Aplicativo gratuito e sem anúncios para consultar os ônibus da cidade do Rio de Janeiro.

**Abrir:** https://cassioomorenorj.github.io/rj-bus/

## Disponível

- Busca por número, nome ou destino da linha.
- Busca de pontos pelo nome da rua ou pelo código do ponto, com prioridade para resultados exatos e próximos.
- Linhas cadastradas em cada ponto.
- Pontos próximos, calculados no aparelho a partir da localização autorizada. Quando o navegador já concedeu permissão, a posição é obtida automaticamente ao abrir a aba Próximos; na primeira vez, usa-se o botão de autorização.
- Mapa interativo automático dos pontos próximos após autorizar a localização; mapas sob demanda para resultados da pesquisa, favoritos, um ponto específico e pontos de uma linha. Marcadores 🚌 indicam **pontos cadastrados**, não veículos em tempo real; agrupamentos numerados evitam sobreposição de paradas e podem ser abertos para consultar as linhas de cada ponto. A localização do usuário tem marcador azul. Os mapas não exibem o trajeto ordenado nem posições atuais dos veículos.
- Favoritos de linhas e pontos, guardados neste navegador.
- Links compartilháveis diretamente para um ponto ou uma linha, com opção de navegação a pé pelo Google Maps.
- Instalação como aplicativo em navegadores compatíveis.
- Consulta da base já carregada sem internet.

A interface é simples, sem anúncios, cadastro ou cobrança. O GPS está preparado em `server/`, mas a integração pública permanece desativada em `config.js` até a liberação do serviço. A versão pública não mostra posições nem previsões de chegada enquanto isso.

## Dados oficiais

Fonte: [GTFS da SMTR / Prefeitura do Rio](https://dados.mobilidade.rio/gtfs/schedule), consultado em 13/11/2026. A transformação inclui 494 cadastros de linhas, 7.493 pontos referenciados por viagens e 52.064 relações entre linha e ponto. Variantes podem compartilhar o mesmo número de linha.

O arquivo `feed_info.txt` declara cobertura de 01/01/2024 a 31/12/2026. `generatedAt` registra a transformação local, não a data de publicação da Prefeitura. A base representa a rede planejada: estar no cadastro não garante operação naquele momento.

As listas de pontos de uma linha reúnem sentidos e variantes; não representam a ordem do trajeto. Distâncias de pontos próximos são em linha reta, não percursos a pé.

GPS preparado com os novos feeds [Ônibus](https://www.arcgis.com/home/item.html?id=997bc16cc4344a5cb0e48ab06cbdfd1f) e [BRT](https://www.arcgis.com/home/item.html?id=8bb196cc02174d25b77437bb2f6443d4) da SMTR. Esses catálogos informam licença CC BY 4.0 e caráter beta. Posições acima de 5 minutos são descartadas, sem estimar horários de chegada. A transformação e a apresentação dos dados são do RJ Bus; não se trata de aplicativo oficial da Prefeitura.

## Privacidade

Sua localização é usada na memória do aparelho para encontrar pontos próximos e não é enviada ao serviço de GPS. Ao abrir o mapa automático de próximos, o provedor de mosaicos recebe requisições da área visualizada, que podem revelar a região aproximada. A opção “Como chegar a pé” abre o Google Maps em outro site. Favoritos e a preferência por localização automática ficam no armazenamento do navegador; as coordenadas não são salvas. Ao abrir “Ver no mapa”, você acessa o OpenStreetMap com as coordenadas do ponto ou do ônibus selecionado. O mapa interativo de pontos próximos é carregado ao consultar a localização; nos detalhes, é aberto sob demanda. Seu navegador carrega Leaflet via unpkg e mosaicos do OpenStreetMap, expondo a esses serviços dados técnicos da conexão. Sua posição não é enviada ao servidor do RJ Bus. Não há publicidade ou código de análise de visitantes adicionado ao aplicativo.

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

A publicação do frontend usa GitHub Pages, branch `main`, pasta raiz. O mapa precisa de conexão para carregar a biblioteca Leaflet e os mosaicos do OpenStreetMap; a lista de pontos continua disponível offline. Links diretos de pontos e linhas funcionam offline após instalar e carregar a base. O serviço em `server/` é publicado separadamente. Nunca coloque credenciais em `config.js` ou no repositório.
