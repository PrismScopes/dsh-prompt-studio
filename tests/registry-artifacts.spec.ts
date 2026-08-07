import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('dsh.plugin.json', rootUrl)), 'utf8')) as {
  id: string
  main: string
  client: { main: string }
}
const nodeBundle = readFileSync(fileURLToPath(new URL('index.mjs', rootUrl)), 'utf8')
const clientBundle = readFileSync(fileURLToPath(new URL('client.js', rootUrl)), 'utf8')

describe('registry distribution artifacts', () => {
  it('keeps the registry manifest id and Cordis bundle loader id explicit', () => {
    expect(manifest).toMatchObject({
      id: 'moeblack/prompt-studio',
      main: './index.mjs',
      client: { main: './client.js' },
    })
    expect(clientBundle).toContain('window.__ModuleLoader__.load')
    expect(clientBundle).toContain('id: "dsh-prompt-studio"')
    expect(clientBundle).not.toContain('id: "@deepseek-ai/dsh-client-ui-prompt-studio"')
  })

  it('exports the Cordis Node-half surface', () => {
    expect(nodeBundle).toMatch(/export \{[^}]*apply/)
    expect(nodeBundle).toMatch(/export \{[^}]*inject/)
    expect(nodeBundle).not.toMatch(/from ["'](?:@deepseek-ai\/|schemastery)/)
  })
})
