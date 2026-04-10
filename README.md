# IPTV Samsung

Aplicação **nova e independente**, pensada **TV first** para Samsung Smart TV (Tizen), em paralelo ao projeto principal. Esta fase prioriza **navegação com comando**, **performance**, **layout de TV** e **arquitetura limpa**.

## Stack

- React 19
- TypeScript (modo estrito)
- Vite 8
- React Router 7
- **Motor de playback:** Samsung **AVPlay** em Tizen (`window.webapis.avplay`); **HTML5** no browser de desenvolvimento

## Como executar localmente (browser)

```bash
cd IPTV_Samsung
npm install
npm run dev
```

Abre o URL indicado no terminal (por defeito `http://localhost:5173`).

Para testar o **shell** (igual ao `tizen/shell`, iframe da SPA): `npm run dev:shell` e abra **`http://localhost:5173/tizen-shell/`** (ver secção abaixo).

### Desenvolvimento híbrido (recomendado)

```bash
npm run dev:hybrid
```

Isto inicia:
- frontend Vite (`http://localhost:5173`)
- API híbrida local (`http://localhost:8787`)

A UI passa a consumir `GET /api/live/catalog` (proxy `/api` no Vite).

### Nota de manutenção — playback VOD no dev

- O playback de **Live** continua no fluxo habitual do player.
- O playback de **VOD progressivo** (`.mp4`, etc.) no browser de desenvolvimento usa o middleware local **`/api/vod-proxy`** do Vite para evitar `403`/bloqueios do provider ao pedir o ficheiro directamente.
- A lógica ficou concentrada em:
  - `src/features/player/hooks/usePlayerController.ts`
  - `vite.config.ts`
- Se algum rollback for necessário, reverta apenas:
  - a resolução condicional de URL progressiva no `usePlayerController`
  - o plugin/middleware `iptvDevVodProxy()` no `vite.config.ts`

Para TV real, use arquitectura híbrida:
- **WGT Shell local** (leve, instalado na TV)
- **Hosted App** (UI principal)
- **Backend híbrido** (catálogo/provider)

---

## Shell + app no dev (porta 5173)

O Vite serve o **mesmo** `tizen/shell` em **`http://localhost:5173/tizen-shell/`** (iframe com a SPA na raiz da mesma origem).

```bash
npm run dev:shell
```

Abra **`http://localhost:5173/tizen-shell/`** no browser. A API híbrida continua acessível via proxy (`/api` → 8787); use `npm run dev:hybrid` se precisar do backend ao mesmo tempo.

---

## Build de produção (web)

```bash
npm run build
```

Saída em **`dist/`** — **app React** (HTML + `assets/`) para servir na rede (hosted). O `base` do Vite está em `./`.

**Pacote Tizen com shell (iframe):** após a app estar acessível por URL, **`HOSTED_APP_URL=http://IP:PORT npm run build:tizen`** gera **`tizen/out/`** com `shell.js`, `shell.css`, `runtime-config.js`, `index.html` do shell, `config.xml`, `icon.png`.

**WGT só com a SPA (sem shell):** `npm run build` e depois **`node scripts/tizen-prepare.mjs`** — copia `dist/` para `tizen/out/` + manifesto.

Para testar a build localmente como na TV (mesma origem que `vite preview`):

```bash
npm run dev:server
npm run preview
```

O `vite preview` (porta por defeito **4173**) agora faz **proxy de `/api`** para o backend em **8787**, tal como o `npm run dev`. Sem isso, `fetch('/api/live/catalog')` falhava com **Failed to fetch**. Se a app e a API estiverem em máquinas/portas diferentes na rede, faça build com `VITE_HYBRID_API_BASE_URL=http://<IP_DO_PC>:8787` para o browser apontar a API directamente.

---

## Samsung Smart TV — WGT Shell + Hosted App

### O que foi preparado no repositório

| Item | Descrição |
|------|-----------|
| `tizen/config.xml` | Manifesto W3C Widget + extensões Tizen (perfil TV, privilégios **internet**, **AVPlay**, **tv.inputdevice**, CSP para streams remotos). |
| `tizen/shell/` | WGT shell local: splash/loading, iframe da hosted app, fallback de erro/retry. |
| `scripts/tizen-shell-prepare.mjs` | Gera **`tizen/out/`** com shell + `runtime-config.js` + `config.xml` + `icon.png`. |
| `tizen/icon.png` | Gerado automaticamente (1×1 placeholder) na primeira preparação — **substituir** por ícone adequado (≥ 512×512) antes de publicar. |

### Scripts npm

| Comando | Efeito |
|---------|--------|
| `npm run dev:server` | Sobe só a API híbrida local (`/api/live/catalog`). |
| `npm run dev:hybrid` | Sobe frontend + API híbrida em paralelo. |
| `npm run build:hosted` | Build da app hospedada em **`dist/`** (igual a `npm run build`). |
| `HOSTED_APP_URL=http://IP:PORT npm run build:tizen` | Prepara o WGT Shell em **`tizen/out/`**. |
| `npm run prepare:tizen:spa` | Prepara **`tizen/out/`** com a SPA embutida, sem shell/iframe. |
| `TIZEN_SIGNING_PROFILE=<perfil> HOSTED_APP_URL=http://IP:PORT npm run package:tizen` | Faz build shell + gera o ficheiro `.wgt` com o Tizen CLI. |

### Gerar a pasta do pacote (passo obrigatório antes do .wgt)

```bash
HOSTED_APP_URL=http://192.168.0.149:4173 npm run build:tizen
```

Resultado: pasta **`tizen/out/`** com shell local (`index.html`, `shell.js`, `shell.css`, `runtime-config.js`, `config.xml`, `icon.png`).

Regras práticas:
- `HOSTED_APP_URL` é obrigatória no build Tizen.
- Não use `localhost`, `127.0.0.1` ou `0.0.0.0` no `HOSTED_APP_URL`; a TV precisa alcançar esse endereço pela rede.
- O shell só considera a app pronta quando a SPA hospedada envia confirmação de arranque. Isso evita “falso sucesso” só porque o iframe abriu.

### Fluxo recomendado de deploy híbrido

1. Build e publicar a hosted app:

```bash
npm run build:hosted
```

2. Subir backend híbrido em rede local (ou servidor):

```bash
npm run dev:server:lan
```

3. Gerar o WGT shell apontando para a hosted app:

```bash
HOSTED_APP_URL=http://192.168.0.149:4173 npm run build:tizen
```

### Gerar o ficheiro .wgt (máquina de desenvolvimento)

1. Instalar **Tizen Studio** (ou o pacote **Tizen CLI** + extensão **Samsung TV**) no macOS/Windows/Linux.
2. Criar um **certificado de autor** (Certificate Manager) e um **perfil de assinatura** compatível com TV Samsung.
3. A partir da pasta do pacote:

```bash
TIZEN_SIGNING_PROFILE=<nome-do-perfil> HOSTED_APP_URL=http://192.168.0.149:4173 npm run package:tizen
```

O ficheiro **`.wgt`** é gerado em **`tizen/out/`**.

**Nota:** O `config.xml` ainda usa IDs placeholder (`iptvsam01a.iptvsam01b`). Antes de submeter à loja ou de usar certificados finais, alinhe **package** / **application id** com o perfil de assinatura Samsung/Tizen.

### Instalar na TV (desenvolvimento)

1. Ligar a TV em **modo desenvolvedor** (Developer Mode) e anotar o **IP** da TV.
2. No PC, com **sdb** (Smart Development Bridge) ligado à TV:

```bash
sdb connect <IP_DA_TV>
tizen install -n com.iptvsamsung.app -s <device-id> -- tizen/out/<ficheiro>.wgt
```

Os comandos exactos podem variar com a versão do CLI; no Tizen Studio pode usar **Run** / **Install** com o dispositivo seleccionado.

3. Abrir a app no menu de aplicações da TV.
   - O shell local abre instantaneamente (splash/loading local)
   - carrega a hosted app no iframe
   - mostra fallback com retry se rede/app hosted indisponível

### Testar AVPlay

- Em **Tizen Web App** real, `resolvePlaybackEngineKind()` escolhe **avplay** quando `window.webapis.avplay` existe.
- No **Chrome** no PC, o motor é **html5** (sem `webapis`).
- Se o stream falhar, verifique rede, URL do canal, e se o painel não bloqueia o user-agent / região (independente do empacotamento).

### O que pode precisar de ajuste no hardware real

- **Certificados e IDs** no `config.xml` alinhados com o perfil Samsung.
- **Ícone** substituir o placeholder por PNG 512×512 (ou o tamanho exigido pela loja).
- **CSP** em `config.xml` (metadata `app-csp`): se algum script ou stream for bloqueado, rever a string (menos permissiva em produção quando possível).
- **Rotas:** usa-se `BrowserRouter`. Se numa versão antiga de runtime o histórico falhar, avaliar `HashRouter` (mudança de código — só se necessário).
- **Rede TV -> hosted app/backend:** a TV precisa alcançar os IPs/portas na LAN.
- **Fetch / CORS:** a hosted app comunica com backend híbrido; valide CORS e firewall.
- **Tamanho do chunk JS:** aviso do Vite (>500 kB); opcionalmente `dynamic import()` para reduzir memória na TV.

---

## Navegação (comando / teclado)

- **Setas**: mover foco entre itens (sidebar, filas, grelhas, botões).
- **Enter**: ativar o elemento focado (equivalente a “OK” no remoto).
- **Escape** ou **Backspace**: “voltar” lógico — nos detalhes regressa à lista anterior; noutras páginas do shell volta ao **Início** (`/home`).

## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/` | Splash → redireciona para `/home` |
| `/home` | Hub (Live, filmes, séries, playlists, definições) |
| `/live` | Live TV (playlist activa) |
| `/player` | Player fullscreen (AVPlay / HTML5) |
| … | Ver `src/app/AppRoutes.tsx` |

## Arquitectura base

- **`lib/tvFocus`**: foco TV, `FocusPlan`, `TVFocusable`.
- **`features/player`**: motores **AVPlay** e **HTML5**, `usePlayerController`.
- **`features/catalog`**: catálogo Live (M3U / Xtream).

## Nota sobre imagens

Os mocks ou posters podem usar URLs remotas; em produção convém assets em `public/` ou CDN.
