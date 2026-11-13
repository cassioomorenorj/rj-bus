# RJ Bus — serviço de GPS

Ponte de leitura para os feeds oficiais GTFS-Realtime da SMTR / Prefeitura do Rio, necessária porque a origem oficial não libera leitura direta pelo navegador do RJ Bus.

- `GET /api/gps/onibus`: posições dos ônibus urbanos.
- `GET /api/gps/brt`: posições do BRT.
- `GET /`: teste manual da conexão oficial.

Somente esses dois endereços fixos são consultados. Não aceita URL arbitrária, escrita, coordenadas do usuário ou credenciais. CORS permite o aplicativo `https://cassioomorenorj.github.io` e a própria origem do serviço. Respostas válidas têm cache por 20 segundos (cache nomeado da hospedagem, com alternativa em memória por processo); requisições simultâneas no mesmo processo são agrupadas. Há timeout de 15 segundos e limite de 8 MiB por feed. Falhas retornam 503 sem reapresentar posições antigas como atuais.

O protocolo é decodificado com `gtfs-realtime-bindings` da MobilityData. Posições sem linha, sem timestamp, com coordenadas inválidas, mais de 5 minutos antigas ou mais de 1 minuto no futuro são descartadas. Para veículos duplicados fica o registro mais recente. O cliente também verifica a idade ao exibir. Não são calculadas previsões de chegada.

Dados: SMTR / Prefeitura do Rio de Janeiro, CC BY 4.0. Fontes oficiais:
- https://www.arcgis.com/home/item.html?id=997bc16cc4344a5cb0e48ab06cbdfd1f
- https://www.arcgis.com/home/item.html?id=8bb196cc02174d25b77437bb2f6443d4

Esses serviços estão em beta e podem mudar sem aviso. O RJ Bus não é um aplicativo oficial.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run validate
```

O artefato gerado é um Worker ESM. O código não requer chaves de API. A publicação atual é privada para revisão do proprietário; o frontend só deve apontar para o serviço depois da liberação de acesso público. Nunca publique tokens de acesso privado no frontend.
