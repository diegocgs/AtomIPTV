#!/usr/bin/env node
/**
 * Copia a build Vite (`dist/`) + manifest Tizen para `tizen/out/`, pronto para
 * `tizen package -t wgt` ou empacotamento no Tizen Studio.
 */
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')
const tizenDir = join(root, 'tizen')
const out = join(tizenDir, 'out')
const iconSrc = join(tizenDir, 'icon.png')

/** PNG 1×1 mínimo (substitua por ícone 512×512 antes de publicar). */
const PLACEHOLDER_ICON_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function ensureIcon() {
  if (!existsSync(iconSrc)) {
    writeFileSync(iconSrc, Buffer.from(PLACEHOLDER_ICON_B64, 'base64'))
    console.warn('[tizen-prepare] Criado tizen/icon.png placeholder (1×1). Substitua por ícone TV (≥512×512) antes da loja.')
  }
}

function main() {
  if (!existsSync(dist)) {
    console.error('Pasta dist/ não existe. Execute primeiro: npm run build')
    process.exit(1)
  }

  ensureIcon()

  rmSync(out, { recursive: true, force: true })
  cpSync(dist, out, { recursive: true })
  cpSync(join(tizenDir, 'config.xml'), join(out, 'config.xml'))
  cpSync(iconSrc, join(out, 'icon.png'))

  console.log(`[tizen-prepare] Pacote preparado em: ${out}`)
  console.log('[tizen-prepare] Próximo passo (Tizen CLI): tizen package -t wgt -s <signing-profile> -- .')
  console.log(`[tizen-prepare] Com cwd: cd "${out}" && tizen package -t wgt -s <profile> -- .`)
}

main()
