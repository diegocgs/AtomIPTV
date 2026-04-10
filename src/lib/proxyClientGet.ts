import { getBackendApiBase } from '@/lib/backendApi';

/** True when the request targets our Node proxy (same base as `VITE_BACKEND_API`). */
export function isBackendProxyRequestUrl(url: string): boolean {
  const b = getBackendApiBase();
  return Boolean(b && url.startsWith(b));
}

/**
 * Chromium Private Network Access: pedidos de contexto seguro (file://, https, localhost)
 * para IP privado precisam de preflight com `Access-Control-Allow-Private-Network`. Um GET
 * “simples” pode ser bloqueado com XHR status 0 **sem** chegar ao servidor. Um header
 * customizado força preflight OPTIONS primeiro.
 */
const PNA_TRIGGER_HEADERS: Record<string, string> = { 'X-Nexus-Lan': '1' };

/**
 * TV / Tizen WebViews: `fetch` to a LAN IP sometimes fails (mixed content, PNA, WebView quirks).
 * Try XHR first (no custom headers), then `fetch`.
 */
export async function proxyClientGet(url: string, init?: { signal?: AbortSignal }): Promise<Response> {
  const signal = init?.signal;

  /** App servida em http://mesmo-host:8787 que o proxy → sem CORS/PNA (ex.: `npm run serve:lan`). */
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(url);
      if (u.origin === window.location.origin) {
        return fetch(url, { method: 'GET', signal, cache: 'no-store', credentials: 'omit' });
      }
    } catch {
      /* continua */
    }
  }

  const pnaHeaders = isBackendProxyRequestUrl(url) ? PNA_TRIGGER_HEADERS : undefined;

  if (typeof XMLHttpRequest !== 'undefined') {
    try {
      const res = await xhrGetPlain(url, signal, pnaHeaders);
      return res;
    } catch {
      /* fall through to fetch */
    }
  }

  return fetch(url, {
    method: 'GET',
    signal,
    cache: 'no-store',
    credentials: 'omit',
    mode: 'cors',
    headers: pnaHeaders,
  });
}

/** Use XHR-first for backend proxy URLs; otherwise normal `fetch`. */
export async function smartHttpGet(url: string, init?: RequestInit): Promise<Response> {
  if (isBackendProxyRequestUrl(url)) {
    const signal = init?.signal ?? undefined;
    return proxyClientGet(url, { signal });
  }
  return fetch(url, { ...init, method: init?.method ?? 'GET' });
}

const fetchCorsNoStore: RequestInit = {
  method: 'GET',
  cache: 'no-store',
  credentials: 'omit',
  mode: 'cors',
};

export type ProbeLanHttpOptions = {
  signal?: AbortSignal;
  /** Logs por tentativa (TV / file:// — útil para ver XHR vs fetch vs no-cors). */
  log?: (line: string) => void;
};

/**
 * Tizen/.wgt em `file://` bloqueia muitas vezes XHR/fetch a `http://LAN`, mas `<img>` ainda pode carregar.
 * Confirma alcance ao proxy sem CORS no corpo da resposta.
 */
export function probeProxyViaImage(
  proxyOrigin: string,
  log: (line: string) => void,
  signal?: AbortSignal
): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof Image === 'undefined') {
      resolve(false);
      return;
    }
    const img = new Image();
    const src = `${proxyOrigin.replace(/\/+$/, '')}/health.gif?_=${Date.now()}`;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const timer = window.setTimeout(() => {
      log('health.gif: timeout (8s)');
      finish(false);
    }, 8000);
    const onAbort = () => {
      log('health.gif: abort');
      finish(false);
    };
    if (signal) {
      if (signal.aborted) {
        window.clearTimeout(timer);
        resolve(false);
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    img.onload = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      log('health.gif: onload — rede até ao proxy (WebView file://)');
      finish(true);
    };
    img.onerror = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      log('health.gif: onerror — não carregou (bloqueio ou rede)');
      finish(false);
    };
    img.src = src;
  });
}

/**
 * TV WebViews: o mesmo URL pode falhar com XHR→fetch e funcionar com fetch→XHR (ou o inverso).
 * Em `file://`, tenta primeiro `/health.gif` por `<img>`.
 */
export async function probeLanHttp(url: string, init?: ProbeLanHttpOptions): Promise<Response> {
  const signal = init?.signal;
  const log = init?.log ?? (() => {});

  if (typeof window !== 'undefined') {
    try {
      const u = new URL(url);
      if (u.origin === window.location.origin) {
        log('Mesma origem que a página — GET directo (sem CORS/PNA entre origens).');
        return await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', signal });
      }
    } catch {
      /* continua */
    }
  }

  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    try {
      const u = new URL(url);
      log('file:// — teste por imagem /health.gif (XHR/fetch ao LAN costuma falhar no .wgt)…');
      const ok = await probeProxyViaImage(u.origin, log, signal);
      if (ok) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Nexus-Connectivity': 'image-probe',
          },
        });
      }
      log('Imagem não confirmou — a tentar XHR/fetch…');
    } catch (e) {
      log(`file:// imagem: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const pnaHeaders = isBackendProxyRequestUrl(url) ? PNA_TRIGGER_HEADERS : undefined;

  const fetchOnce = (label: string) => async () => {
    try {
      const res = await fetch(url, { ...fetchCorsNoStore, signal, headers: pnaHeaders });
      log(`${label}: HTTP ${res.status} ${res.statusText} (type=${res.type})`);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`${label}: falhou — ${msg}`);
      throw e;
    }
  };

  const xhrOnce = (label: string) => async () => {
    try {
      const res = await xhrGetPlain(url, signal, pnaHeaders);
      log(`${label}: HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`${label}: falhou — ${msg}`);
      throw e;
    }
  };

  const orders = [
    ['1: xhr→fetch', xhrOnce('xhr'), fetchOnce('fetch')] as const,
    ['2: fetch→xhr', fetchOnce('fetch'), xhrOnce('xhr')] as const,
  ];

  let lastErr: unknown;
  for (const [orderName, a, b] of orders) {
    log(`— Ordem ${orderName} —`);
    for (const run of [a, b]) {
      try {
        return await run();
      } catch (e) {
        lastErr = e;
      }
    }
  }

  log('— Diagnóstico no-cors (não lê JSON; só indica se o browser enviou algum pedido) —');
  try {
    const r = await fetch(url, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      signal,
    });
    log(`no-cors: response.type=${r.type} status=${r.status} ok=${r.ok}`);
    if (r.type === 'opaque') {
      log(
        'no-cors opaco: o pedido pode ter chegado ao servidor; se o modo CORS falhar, verifica CORS/PNA no proxy e logs do Mac.'
      );
    }
  } catch (e) {
    log(`no-cors: excepção — ${e instanceof Error ? e.message : String(e)}`);
  }

  throw lastErr instanceof Error ? lastErr : new TypeError('Pedido falhou após 4 tentativas CORS + diagnóstico no-cors');
}

/** Cabeçalhos expostos pelo browser em respostas CORS (útil para o Manifest Debug Lab). */
function xhrHeadersFromXhr(xhr: XMLHttpRequest): Headers {
  const h = new Headers();
  const raw = xhr.getAllResponseHeaders();
  if (!raw?.trim()) return h;
  for (const block of raw.trim().split(/[\r\n]+/)) {
    const i = block.indexOf(':');
    if (i === -1) continue;
    const name = block.slice(0, i).trim();
    const value = block.slice(i + 1).trim();
    if (name) h.append(name, value);
  }
  return h;
}

function xhrGetPlain(
  url: string,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onAbort = () => {
      xhr.abort();
      finish(() => reject(new DOMException('Aborted', 'AbortError')));
    };

    xhr.open('GET', url, true);
    xhr.withCredentials = false;
    xhr.timeout = 600_000;
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        xhr.setRequestHeader(k, v);
      }
    }

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort);
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      const status = xhr.status || 0;
      if (status <= 0) {
        finish(() =>
          reject(
            new TypeError(
              `XHR status=0 readyState=DONE (CORS, rede inacessível, firewall ou bloqueio PNA à rede privada). URL=${url}`
            )
          )
        );
        return;
      }
      finish(() =>
        resolve(
          new Response(xhr.responseText, {
            status,
            statusText: xhr.statusText || 'OK',
            headers: xhrHeadersFromXhr(xhr),
          })
        )
      );
    };
    xhr.onerror = () => {
      finish(() =>
        reject(
          new TypeError(
            `XHR onerror (antes ou sem status HTTP). URL=${url} — verifica IP, proxy no Mac e firewall.`
          )
        )
      );
    };
    xhr.ontimeout = () => {
      finish(() => reject(new TypeError('XHR timeout')));
    };
    xhr.send();
  });
}
