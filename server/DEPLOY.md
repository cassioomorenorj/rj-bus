# Publicar o GPS do RJ Bus (Cloudflare Workers — plano Free)

Esta etapa **não pode ser feita apenas com acesso ao GitHub**: é necessário que o proprietário autorize a conexão da própria conta Cloudflare. Não é preciso comprar domínio.

1. Abra https://dash.cloudflare.com/ e entre ou crie uma conta. Escolha **Workers Free** (não selecione um plano pago).
2. Em **Workers & Pages**, clique em **Create application**, escolha **GitHub** e conecte a conta `cassioomorenorj`.
3. Selecione o repositório público **cassioomorenorj/rj-bus**.
4. Use exatamente:
   - **Worker name**: `rj-bus-gps` (igual a `server/wrangler.toml`);
   - **Production branch**: `main`;
   - **Root directory**: `server`;
   - **Build command**: `npm ci --ignore-scripts && npm test && npm run build && npm run validate`;
   - **Deploy command**: `npx wrangler deploy`;
   - **Public URL**: mantenha a opção `workers.dev` ativada.
5. Clique em **Save and Deploy**. A integração do GitHub faz novos deploys automaticamente quando o código da pasta `server/` é alterado.

## Verificar

No painel, copie a URL HTTPS pública `https://rj-bus-gps.<seu-subdominio>.workers.dev`. O subdomínio é informado pelo Cloudflare; **não é possível adivinhá-lo**.

Abra a URL raiz para testar o botão **Consultar ônibus agora**.
- `https://<worker>/api/gps/onibus` → deve retornar JSON com `vehicles` e `fetchedAt`;
- `https://<worker>/api/gps/brt` → mesmo formato para o BRT.

Se o feed oficial estiver indisponível, o serviço retorna HTTP 503 e não inventa posições. A atualização automática do RJ Bus ocorre a cada 30 segundos; posições com mais de 5 minutos são descartadas.

## Ativar no aplicativo

**Somente depois de testar as duas rotas com sucesso**, configure `config.js` no repositório:
```js
export const GPS_API = 'https://rj-bus-gps.<seu-subdominio>.workers.dev';
```
Substitua pelo endereço real, sem barra final. Não use a URL de `/api/gps/onibus` como base.

O frontend do RJ Bus passa a mostrar os ônibus atualizados automaticamente nos detalhes das linhas. Nunca salve tokens Cloudflare no GitHub ou em `config.js`.

### Diagnóstico rápido

- Build falhou: confirme **Root directory=server**. O código contém `wrangler.toml` e a entrada compilada `dist/server/index.js`.
- Erro de dependência: confirme `npm ci --ignore-scripts` antes de `npm run build`.
- `503`: o serviço oficial pode estar fora do ar ou o limite de CPU/rede do plano gratuito pode ter sido atingido; conferir logs do Cloudflare.
- Nenhum ônibus em uma linha: não significa que ela esteja parada. Confira se `routeId` do GPS coincide com o GTFS e se a posição é recente.
- A conta Workers Free possui limites de uso; o aplicativo não deve assumir capacidade ilimitada.

Fontes:
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/platform/limits/
