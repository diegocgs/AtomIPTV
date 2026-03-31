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

### Desenvolvimento híbrido (recomendado)

```bash
npm run dev:hybrid
```

Isto inicia:
- frontend Vite (`http://localhost:5173`)
- API híbrida local (`http://localhost:8787`)

A UI passa a consumir `GET /api/live/catalog` (proxy `/api` no Vite).

Para TV real, use arquitectura híbrida:
- **WGT Shell local** (leve, instalado na TV)
- **Hosted App** (UI principal)
- **Backend híbrido** (catálogo/provider)

---

## Build de produção (web)

```bash
npm run build
```

Saída em **`dist/`** — **app React** (HTML + `assets/`) para servir na rede (hosted). O `base` do Vite está em `./`.

**Pasta da imagem (WGT shell):** **`tizen/out/`** — gera-se com **`npm run build:tizen`** (`shell.js`, `shell.css`, `runtime-config.js`, `index.html`, `config.xml`, `icon.png`). **Não** é a mesma que `dist/`.

**Dois artefactos:** **`dist/`** = UI React (URL no iframe). **`tizen/out/`** = pacote do **shell Tizen** (`shell.js`, `shell.css`, `runtime-config.js`, `index.html`, `icon.png`, `config.xml`), gerado por `npm run build:tizen` — pasta correcta para o Tizen CLI.

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
| `npm run build:hosted` | Build da app principal hospedada (`dist/`). |
| `npm run build:tizen` | Prepara o WGT Shell em **`tizen/out/`**. |
| `HOSTED_APP_URL=http://IP:PORT npm run build:tizen` | Define URL da app hosted no `runtime-config.js` do shell. |
| `npm run package:tizen` | Igual a `build:tizen` (artefacto final `.wgt` exige **Tizen CLI** no PC, ver abaixo). |

### Gerar a pasta do pacote (passo obrigatório antes do .wgt)

```bash
npm run build:tizen
```

Resultado: pasta **`tizen/out/`** com shell local (`index.html`, `shell.js`, `shell.css`, `runtime-config.js`, `config.xml`, `icon.png`).

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
cd tizen/out
tizen package -t wgt -s <nome-do-perfil-de-assinatura> -- .
```

O ficheiro **`.wgt`** é gerado no diretório actual (ou conforme a saída indicada pelo CLI).

**Nota:** O `config.xml` usa `com.iptvsamsung` / `com.iptvsamsung.app` como identificadores de exemplo. Antes de submeter à loja ou de usar certificados da equipa, alinhe **package** / **application id** com o que o gestor de certificados Tizen exige.

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
