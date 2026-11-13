# RJ Bus

Aplicativo gratuito e sem anúncios para acompanhar os ônibus da cidade do Rio de Janeiro.

## Estado atual

Esta é a primeira versão da interface. **Ainda não há integração com GPS, linhas, trajetos ou pontos reais.** Nenhum horário de chegada ou veículo mostrado deve ser entendido como informação operacional: esses dados ainda não são apresentados.

- Interface simples, pensada para celular.
- Abas Próximos, Linhas, Pontos e Favoritos.
- Pesquisas favoritas salvas no próprio navegador.
- Arquivos de instalação como aplicativo web (PWA).
- Interface disponível sem conexão após a primeira visita.
- Sem anúncios, cadastro, rastreadores ou dependências pagas.

A localização só é solicitada quando a pessoa toca em **Usar minha localização**. Nesta versão, ela apenas confirma que a permissão está disponível; não envia a posição a um servidor e não consulta pontos.

## Executar localmente

Com Python 3 instalado, execute na pasta do projeto:

```sh
python -m http.server 8000
```

Abra `http://localhost:8000`. A instalação e a localização exigem HTTPS ou localhost e dependem do navegador.

## Publicar

O projeto é estático e não exige compilação. No GitHub Pages, use a branch `main` e a pasta raiz `/`.

## Próximas etapas

1. Validar uma fonte oficial e gratuita de posições dos ônibus.
2. Integrar linhas, trajetos e pontos de parada.
3. Mostrar as linhas que passam por cada ponto.
4. Validar atualização, disponibilidade e qualidade dos dados antes de informar previsões de chegada.

## Arquivos

- `index.html`: página principal.
- `style.css`: aparência.
- `app.js`: navegação e favoritos.
- `manifest.webmanifest` e `icon.svg`: identidade do aplicativo.
- `sw.js`: cache da interface.
