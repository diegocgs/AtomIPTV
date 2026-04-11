# Cloudflare 403 — Providers que bloqueiam IPs de data center

## Problema

Alguns providers IPTV (especialmente brasileiros) usam Cloudflare/WAF que bloqueia requests originados de IPs de data center (AWS, GCP, Azure). A Lambda em `ca-central-1` recebia **HTTP 403** com uma pagina HTML do Cloudflare em vez do JSON esperado.

Sintoma na TV:
```
Live catalog API failed (502): {"error":"live_catalog_failed","message":"Xtream HTTP 403 — <!DOCTYPE html>..."}
```

## Causa raiz

1. O `User-Agent` default do Node.js (`undici`) e o custom `IPTV-Samsung/1.0` sao identificados como bots pelo Cloudflare.
2. O IP da Lambda AWS (`ca-central-1`) esta em ranges conhecidos de data center — alguns WAFs bloqueiam automaticamente.
3. Headers ausentes (`Accept-Language`, `Accept-Encoding`) tambem contribuem para a deteccao como bot.

## Solucao aplicada

### 1. User-Agent de browser real em todos os fetch server-side

Ficheiros alterados:
- `server/live/xtreamApi.mjs` — `xtreamFetchJson()`
- `server/live/liveCatalogService.mjs` — `fetchM3uText()`
- `server/vod/moviesCatalogService.mjs` — `fetchM3uText()`
- `server/vod/seriesCatalogService.mjs` — `fetchM3uText()`
- `aws-proxy/lambda/index.mjs` — `/api/proxy` endpoint

User-Agent utilizado:
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36
```

### 2. Headers completos no proxy generico (`/api/proxy`)

```javascript
headers: {
  'User-Agent': HLS_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
}
```

### 3. Fallback client-side (fetch directo da TV)

Quando o proxy Lambda falha (502/403), a app tenta fetch directo do dispositivo (TV tem IP residencial que o Cloudflare aceita). Limitado por CORS — funciona apenas quando o provider envia headers CORS.

Ficheiros:
- `src/services/xtream.ts` — `xtreamFetch()`: tenta proxy, fallback fetch directo
- `src/features/catalog/services/liveCatalogService.ts` — `resolveLiveCatalogInClient()`: proxy -> directo -> cache offline
- `src/features/catalog/services/moviesCatalogService.ts` — mesmo padrao
- `src/features/catalog/services/seriesCatalogService.ts` — mesmo padrao

## Deploy

Apos alterar os ficheiros em `server/`, executar:
```bash
npm run lambda:deploy
```

O script `lambda:sync` copia `server/live`, `server/vod`, `server/utils` para `aws-proxy/lambda/` antes do deploy CDK.

**Nota:** O `aws-proxy/lambda/index.mjs` NAO e copiado pelo `lambda:sync` — deve ser editado directamente.

## Se o problema voltar

1. **Verificar logs:** `aws logs filter-log-events --log-group-name /aws/lambda/iptv-proxy-fn --region ca-central-1 --filter-pattern "error" --limit 10`
2. **Forcar cold start:** alterar qualquer env var da Lambda para invalidar instancias quentes com cache de 403.
3. **Ultima opcao:** mover a Lambda para `sa-east-1` (Sao Paulo) — IP brasileiro pode ter menos bloqueios de providers BR. Requer re-deploy do stack CDK com regiao diferente.
