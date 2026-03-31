import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { fileURLToPath, URL } from 'node:url'

/**
 * Proxy de fetch só em dev: o browser não consegue ler M3U/Xtream noutros
 * domínios (CORS) nem seguir redirects para HTTP a partir de HTTPS (mixed content).
 * O Node faz o pedido e devolve o corpo ao cliente (mesma origem).
 */
function iptvDevFetchProxy(): Plugin {
  return {
    name: 'iptv-dev-fetch-proxy',
    /** Garante que este plugin regista o servidor antes de outros. */
    enforce: 'pre',
    configureServer(server) {
      /**
       * Tem de ser registado aqui de forma síncrona (sem callback devolvido por configureServer).
       * Os callbacks devolvidos correm depois do htmlFallbackMiddleware, que para SPAs
       * reescreve req.url para /index.html em GET com Accept wildcard (como o fetch do browser).
       * O nosso path deixa de bater e o cliente recebia HTML em vez do M3U.
       */
      server.middlewares.use(async (req, res, next) => {
        const raw = req.url ?? ''
        if (!raw.startsWith('/__iptv_dev/fetch')) {
          next()
          return
        }
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const u = new URL(raw, 'http://localhost')
          const target = u.searchParams.get('url')
          if (!target) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Missing url query parameter')
            return
          }
          let parsed: URL
          try {
            parsed = new URL(target)
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Invalid url')
            return
          }
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Only http(s) URLs are allowed')
            return
          }
          const r = await fetch(target, {
            redirect: 'follow',
            headers: {
              'User-Agent': 'IPTV-Samsung/1.0 (dev-proxy)',
              Accept: '*/*',
            },
          })
          const body = await r.text()
          res.statusCode = r.status
          const ct = r.headers.get('content-type')
          res.setHeader(
            'Content-Type',
            ct && ct.length > 0 ? ct : 'text/plain; charset=utf-8',
          )
          res.end(body)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Fetch failed'
          res.statusCode = 502
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(msg)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  /**
   * Caminhos relativos para empacotamento Tizen (.wgt): o widget carrega index.html
   * a partir do sistema de ficheiros / origem da app; base absoluta `/` partia assets.
   */
  base: './',
  /** Proxy de fetch primeiro — ver plugin `enforce: 'pre'`. */
  plugins: [
    iptvDevFetchProxy(),
    react(),
    ...(mode === 'tizen'
      ? [
          legacy({
            /**
             * TVs antigas podem não suportar `type="module"` plenamente.
             * Gera fallback `nomodule` para o app arrancar e mostrar a UI.
             */
            targets: ['defaults', 'chrome >= 53', 'safari >= 10'],
            modernPolyfills: true,
            renderLegacyChunks: true,
          }),
        ]
      : []),
  ],
  /**
   * App React: `dist/` (padrão Vite). Pacote TV (shell + config.xml, …): **`tizen/out/`** via `npm run build:tizen`.
   */
  build:
    mode === 'tizen'
      ? {
          minify: false,
          sourcemap: true,
        }
      : undefined,
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.HYBRID_API_PORT ?? '8787'}`,
        changeOrigin: true,
      },
    },
  },
  /**
   * `vite preview` serve a build estática; sem este proxy, `fetch('/api/...')` falha
   * (o proxy só existia em dev). TV / hosted app em :4173 precisam disto + API em 8787.
   */
  preview: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.HYBRID_API_PORT ?? '8787'}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
