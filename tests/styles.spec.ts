import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/PromptStudioView.module.css', import.meta.url)), 'utf8')
const tokens = readFileSync(
  fileURLToPath(new URL('../.dsh/packages/client/ui-theme/src/styles/design-platform.css', import.meta.url)),
  'utf8',
)

describe('Prompt Studio theme styles', () => {
  it('uses only declared design-platform color tokens', () => {
    const named = [...css.matchAll(/var\((--dsw-[a-z0-9-]+)/g)].map(match => match[1])
    const undeclared = [...new Set(named)].filter(name => !tokens.includes(`  ${String(name)}:`))
    expect(undeclared).toEqual([])
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i)
  })
})
