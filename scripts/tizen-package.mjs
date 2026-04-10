#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const outDir = join(root, 'tizen', 'out')
const signingProfile = String(process.env.TIZEN_SIGNING_PROFILE ?? '').trim()

function fail(message) {
  console.error(`[tizen-package] ${message}`)
  process.exit(1)
}

if (!existsSync(outDir)) {
  fail('`tizen/out` não existe. Execute primeiro `npm run build:tizen`.')
}

if (!signingProfile) {
  fail(
    'Defina `TIZEN_SIGNING_PROFILE` antes de empacotar. Exemplo: TIZEN_SIGNING_PROFILE=minha-tv npm run package:tizen',
  )
}

const packageResult = spawnSync(
  'tizen',
  ['package', '-t', 'wgt', '-s', signingProfile, '--', '.'],
  {
    cwd: outDir,
    stdio: 'inherit',
  },
)

if (packageResult.error) {
  fail(`falha ao executar \`tizen\`: ${packageResult.error.message}`)
}

if (packageResult.status !== 0) {
  process.exit(packageResult.status ?? 1)
}

const generated = readdirSync(outDir).filter((file) => file.endsWith('.wgt')).sort()
if (generated.length === 0) {
  console.warn('[tizen-package] pacote concluído, mas nenhum `.wgt` foi encontrado em `tizen/out`.')
  process.exit(0)
}

for (const file of generated) {
  console.log(`[tizen-package] gerado: ${join(outDir, file)}`)
}
