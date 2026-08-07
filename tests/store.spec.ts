import { afterEach, describe, expect, it, vi } from 'vitest'
import { PromptStudioStore } from '../src/client/store.ts'

const settings = {
  writable: true,
  revision: 3,
  value: { components: [] },
}

const captured = {
  id: 'captured:m1',
  kind: 'captured',
  role: 'user',
  order: 1,
  enabled: true,
  template: 'Instructions',
  messageId: 'm1',
  sourceKind: 'workspace-instructions',
  producer: 'workspace-instructions',
  form: 'instructions',
  source: { kind: 'workspace-instructions', form: 'instructions', changes: [] },
  resources: [],
}

const catalog = {
  revision: 4,
  native: [],
  assembled: [],
  sessionId: 'session-a',
  captured: [captured],
  layout: { messageCount: 2, userAnchor: 0 },
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('PromptStudioStore', () => {
  it('loads settings and the session-specific automatic capture catalog', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const path = String(input)
      requests.push(path)
      return Promise.resolve(path.startsWith('/prompt-studio/settings') ? json(settings) : json(catalog))
    }))
    const controller = new PromptStudioStore('session-a')
    await controller.load()
    expect(requests).toContain('/prompt-studio/state?sessionId=session-a')
    expect(controller.store.getSnapshot()).toMatchObject({
      status: 'ready',
      writable: true,
      revision: 3,
      capturedSessionId: 'session-a',
      captured: [{ producer: 'workspace-instructions', form: 'instructions' }],
      messageCount: 2,
      userAnchor: 0,
    })
  })

  it('routes captured file reads and writes through the resource endpoint', async () => {
    const bodies: unknown[] = []
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const path = String(input)
      if (path.startsWith('/prompt-studio/settings')) return Promise.resolve(json(settings))
      if (path.startsWith('/prompt-studio/state')) return Promise.resolve(json(catalog))
      if (init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)) as unknown)
        return Promise.resolve(json({ path: 'AGENTS.md', content: 'after', digest: 'new' }))
      }
      return Promise.resolve(json({ path: 'AGENTS.md', content: 'before', digest: 'old' }))
    }))
    const controller = new PromptStudioStore('session-a')
    await controller.load()
    expect(await controller.loadResource('captured:m1', 'resource:0')).toMatchObject({ content: 'before' })
    await controller.saveResource('captured:m1', 'resource:0', 'after', 'old')
    expect(bodies).toEqual([{
      sessionId: 'session-a',
      componentId: 'captured:m1',
      resourceId: 'resource:0',
      content: 'after',
      expectedDigest: 'old',
    }])
  })

  it('surfaces endpoint errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ error: 'stale editor' }, 409))))
    const controller = new PromptStudioStore('session-a')
    await controller.load()
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'error', error: 'stale editor' })
  })
})
