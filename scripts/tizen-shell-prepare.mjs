#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const tizenDir = join(root, 'tizen')
const shellDir = join(tizenDir, 'shell')
const outDir = join(tizenDir, 'out')
const iconSrc = join(tizenDir, 'icon.png')
const hostedUrlRaw = String(process.env.HOSTED_APP_URL ?? '').trim()
const shellReadyTimeoutMs = Number(process.env.SHELL_READY_TIMEOUT_MS ?? 20000)

const PLACEHOLDER_ICON_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function ensureIcon() {
  if (!existsSync(iconSrc)) {
    writeFileSync(iconSrc, Buffer.from(PLACEHOLDER_ICON_B64, 'base64'))
  }
}

function ensureShellScaffold() {
  if (!existsSync(shellDir)) {
    throw new Error('tizen/shell não existe. Crie os ficheiros do shell antes de empacotar.')
  }
}

function readConfigXml() {
  return readFileSync(join(tizenDir, 'config.xml'), 'utf8')
}

function validateConfigXml() {
  const xml = readConfigXml()
  const match = xml.match(/<tizen:application\s+id="([^"]+)"\s+package="([^"]+)"/)
  if (!match) {
    console.warn('[tizen-shell] aviso: não foi possível validar `tizen:application` em config.xml.')
    return
  }

  const [, appId, pkg] = match
  if (pkg === 'iptvsam01a' || appId === 'iptvsam01a.iptvsam01b') {
    console.warn(
      '[tizen-shell] aviso: config.xml ainda usa IDs placeholder (`iptvsam01a.*`). Ajuste antes de distribuir ou assinar com perfil final.',
    )
  }
}

function validateHostedUrl(value) {
  if (!value) {
    throw new Error(
      'HOSTED_APP_URL em falta. Exemplo: HOSTED_APP_URL=http://192.168.0.149:4173 npm run build:tizen',
    )
  }

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`HOSTED_APP_URL inválida: ${value}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('HOSTED_APP_URL deve usar http:// ou https://')
  }

  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    throw new Error(
      'HOSTED_APP_URL não pode apontar para localhost/127.0.0.1/0.0.0.0 em build de TV. Use um IP acessível pela Samsung TV.',
    )
  }

  return parsed.toString()
}

function writeRuntimeConfig(hostedUrl) {
  const file = join(outDir, 'runtime-config.js')
  const content =
    `window.__IPTV_SHELL_CONFIG__ = {\n` +
    `  hostedAppUrl: ${JSON.stringify(hostedUrl)},\n` +
    `  shellReadyTimeoutMs: ${Number.isFinite(shellReadyTimeoutMs) ? shellReadyTimeoutMs : 20000},\n` +
    `  builtAt: ${JSON.stringify(new Date().toISOString())}\n` +
    `};\n`
  writeFileSync(file, content)
}

function main() {
  ensureShellScaffold()
  ensureIcon()
  validateConfigXml()
  const hostedUrl = validateHostedUrl(hostedUrlRaw)

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  cpSync(shellDir, outDir, { recursive: true })
  cpSync(join(tizenDir, 'config.xml'), join(outDir, 'config.xml'))
  cpSync(iconSrc, join(outDir, 'icon.png'))
  writeRuntimeConfig(hostedUrl)

  console.log(`[tizen-shell] preparado em: ${outDir}`)
  console.log(`[tizen-shell] hosted app url: ${hostedUrl}`)
  console.log('[tizen-shell] package: cd "tizen/out" && tizen package -t wgt -s <profile> -- .')
}

main()
