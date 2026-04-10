import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
  version?: string
}
const appVersion = packageJson.version ?? '0.0.0'

/**
 * Dev: serve o mesmo shell do Tizen em `/tizen-shell/` com iframe para a SPA na mesma origem (porta por defeito 5173).
 */
function tizenShellDevRoute(): Plugin {
  const prefix = '/tizen-shell'
  const shellDir = join(projectRoot, 'tizen/shell')
  return {
    name: 'tizen-shell-dev',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? ''
        const url = raw.split('?')[0] ?? ''
        if (!url.startsWith(prefix)) {
          next()
          return
        }
        if (url === `${prefix}/shell.css`) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8')
          res.end(readFileSync(join(shellDir, 'shell.css'), 'utf8'))
          return
        }
        if (url === `${prefix}/shell.js`) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.end(readFileSync(join(shellDir, 'shell.js'), 'utf8'))
          return
        }
        if (url === prefix || url === `${prefix}/`) {
          const host = req.headers.host ?? 'localhost:5173'
          const baseUrl = `http://${host}`
          let html = readFileSync(join(shellDir, 'index.html'), 'utf8')
          html = html.replace(
            '<script src="./runtime-config.js"></script>',
            `<script>window.__IPTV_SHELL_CONFIG__=${JSON.stringify({ hostedAppUrl: baseUrl })};</script>`,
          )
          html = html.replaceAll('./shell.css', `${prefix}/shell.css`)
          html = html.replaceAll('./shell.js', `${prefix}/shell.js`)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
          return
        }
        next()
      })
    },
  }
}

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

/**
 * Proxy HLS em dev: faz fetch da playlist M3U8, reescreve URLs de segmentos
 * e sub-playlists para passarem pelo mesmo proxy, e devolve ao browser.
 * Evita erros CORS e bloqueios de User-Agent ao carregar streams HLS.
 */
function iptvDevHlsProxy(): Plugin {
  // Browser UA: passes Cloudflare UA checks. Node.js fetch não envia Origin header,
  // evitando o bloqueio CORS que o Cloudflare aplica a requests XHR cross-origin.
  const HLS_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

  /** Reescreve linhas de URI num manifest HLS para passarem pelo proxy. */
  function rewriteM3u8(body: string, baseUrl: string): string {
    const base = new URL(baseUrl)
    return body
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('#')) return line
        if (!trimmed) return line
        try {
          const abs = new URL(trimmed, base).toString()
          return `/api/hls-proxy?url=${encodeURIComponent(abs)}`
        } catch {
          return line
        }
      })
      .join('\n')
  }

  return {
    name: 'iptv-dev-hls-proxy',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = req.url ?? ''
        if (!raw.startsWith('/api/hls-proxy')) {
          next()
          return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const u = new URL(raw, 'http://localhost')
          const target = u.searchParams.get('url')
          if (!target) {
            res.statusCode = 400
            res.end('Missing url parameter')
            return
          }
          const parsed = new URL(target)
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            res.statusCode = 400
            res.end('Only http(s) URLs allowed')
            return
          }

          const upstream = await fetch(target, {
            method: req.method,
            redirect: 'follow',
            headers: {
              // Imitar exactamente uma navegação directa do Chrome — sem Origin, sem Referer.
              // Cloudflare diferencia XHR (Origin: localhost) de navegação (sem Origin).
              'User-Agent': HLS_UA,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
              'Accept-Encoding': 'gzip, deflate',
              'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"Windows"',
              'sec-fetch-dest': 'document',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'none',
              'sec-fetch-user': '?1',
              'Upgrade-Insecure-Requests': '1',
              'Cache-Control': 'max-age=0',
            },
          })

          const ct = upstream.headers.get('content-type') ?? ''
          const isM3u8 =
            ct.includes('mpegurl') ||
            ct.includes('m3u') ||
            target.includes('.m3u8') ||
            target.includes('.m3u')

          res.statusCode = upstream.status

          if (req.method === 'HEAD' || upstream.body == null) {
            res.end()
            return
          }

          if (isM3u8 && upstream.status >= 200 && upstream.status < 300) {
            const text = await upstream.text()
            const rewritten = rewriteM3u8(text, target)
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(rewritten)
          } else {
            const headersToForward = [
              'content-type',
              'content-length',
              'cache-control',
              'accept-ranges',
              'content-range',
            ]
            for (const h of headersToForward) {
              const v = upstream.headers.get(h)
              if (v) res.setHeader(h, v)
            }
            res.setHeader('Access-Control-Allow-Origin', '*')
            Readable.fromWeb(upstream.body as globalThis.ReadableStream<Uint8Array>).pipe(res)
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'HLS proxy fetch failed'
          res.statusCode = 502
          res.end(msg)
        }
      })
    },
  }
}

/**
 * Proxy de media progressiva em dev: evita pedir `.mp4` direto ao provider
 * quando ele bloqueia o browser (403/Cloudflare). Mantido separado do HLS.
 */
function iptvDevVodProxy(): Plugin {
  return {
    name: 'iptv-dev-vod-proxy',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = req.url ?? ''
        if (!raw.startsWith('/api/vod-proxy')) {
          next()
          return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
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

          const upstream = await fetch(target, {
            method: req.method,
            redirect: 'follow',
            headers: {
              'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
              Accept: req.headers.accept ?? '*/*',
              ...(req.headers.range ? { Range: req.headers.range } : {}),
            },
          })

          res.statusCode = upstream.status
          const headersToForward = [
            'accept-ranges',
            'cache-control',
            'content-length',
            'content-range',
            'content-type',
            'etag',
            'expires',
            'last-modified',
          ]
          for (const header of headersToForward) {
            const value = upstream.headers.get(header)
            if (value) {
              res.setHeader(header, value)
            }
          }

          if (req.method === 'HEAD' || upstream.body == null) {
            res.end()
            return
          }

          Readable.fromWeb(upstream.body as globalThis.ReadableStream<Uint8Array>).pipe(res)
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
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  /** Proxy de fetch primeiro — ver plugin `enforce: 'pre'`. */
  plugins: [
    tizenShellDevRoute(),
    iptvDevFetchProxy(),
    iptvDevHlsProxy(),
    iptvDevVodProxy(),
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
   * App React em **`dist/`** (padrão Vite).
   * Pacote TV com **shell + iframe**: **`npm run build:tizen`** → **`tizen/out/`** (shell.js, shell.css, runtime-config.js, …).
   * Alternativa WGT só com SPA (sem shell): `node scripts/tizen-prepare.mjs` após `npm run build`.
   */
  build:
    mode === 'tizen'
      ? {
          /**
           * `target` não deve ser definido aqui quando plugin-legacy está activo —
           * o plugin gere o target internamente para os bundles modern + legacy.
           * `minify: true` usa OXC (Vite 8); esbuild é requerido pelo plugin-legacy.
           */
          minify: true,
          sourcemap: false,
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
