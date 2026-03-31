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
const hostedUrl = (process.env.HOSTED_APP_URL ?? 'http://192.168.0.149:4173').trim()

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

function writeRuntimeConfig() {
  const file = join(outDir, 'runtime-config.js')
  const content = `window.__IPTV_SHELL_CONFIG__ = {\n  hostedAppUrl: ${JSON.stringify(hostedUrl)}\n};\n`
  writeFileSync(file, content)
}

function main() {
  ensureShellScaffold()
  ensureIcon()

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  cpSync(shellDir, outDir, { recursive: true })
  cpSync(join(tizenDir, 'config.xml'), join(outDir, 'config.xml'))
  cpSync(iconSrc, join(outDir, 'icon.png'))
  writeRuntimeConfig()

  console.log(`[tizen-shell] preparado em: ${outDir}`)
  console.log(`[tizen-shell] hosted app url: ${hostedUrl}`)
  console.log('[tizen-shell] package: cd "tizen/out" && tizen package -t wgt -s <profile> -- .')
}

main()
