import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('package.json', rootUrl)), 'utf8')) as {
  name: string
  main: string
  exports: Record<string, string>
  dsh: { bundle: { patch: string }; client: { platform: string; inject: string[] } }
}
const nodeBundle = readFileSync(fileURLToPath(new URL('index.mjs', rootUrl)), 'utf8')
const clientBundle = readFileSync(fileURLToPath(new URL('client.js', rootUrl)), 'utf8')

describe('bundle distribution artifacts', () => {
  it('declares the bundle patch and web client face under the dsh key', () => {
    expect(manifest).toMatchObject({
      name: 'dsh-prompt-studio',
      main: './index.mjs',
      dsh: {
        bundle: { patch: './cordis.patch.yml' },
        client: { platform: 'web' },
      },
    })
    expect(manifest.exports['./client']).toBe('./client.js')
    expect(manifest.dsh.client.inject).toEqual([
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-api-remotes',
    ])
    expect(clientBundle).toContain('window.__ModuleLoader__.load')
    expect(clientBundle).toContain('id: "dsh-prompt-studio"')
    expect(clientBundle).not.toContain('id: "@deepseek-ai/dsh-client-ui-prompt-studio"')
  })

  it('exports the Cordis Node-half surface self-contained', () => {
    expect(nodeBundle).toMatch(/export \{[^}]*apply/)
    expect(nodeBundle).toMatch(/export \{[^}]*inject/)
    expect(nodeBundle).not.toMatch(/from ["']@deepseek-ai\//)
  })
})
