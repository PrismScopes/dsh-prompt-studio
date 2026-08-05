import { describe, expect, it } from 'vitest'
import type {
  RpcResponse,
  SettingsNamespaceView,
} from '@deepseek-ai/dsh-client-connection/client'
import { PromptStudioStore } from '../src/client/store.ts'
import type { BuiltinSectionOverride, StudioSection } from '../src/shared.ts'

let rpcId = 0
function ok<T>(value: T): RpcResponse<T> {
  return { rpcId: `prompt-${String(rpcId++)}` as never, result: { ok: true, value } }
}

function fail<T>(message: string): RpcResponse<T> {
  return {
    rpcId: `prompt-${String(rpcId++)}` as never,
    result: { ok: false, error: { code: 'settings-rejected', message, details: { ns: 'prompt-studio' } } },
  }
}

const USER_SECTION: StudioSection = {
  name: 'user:instructions',
  order: 200,
  enabled: true,
  text: 'Be concise.',
}

const BUILTIN_OVERRIDE: BuiltinSectionOverride = {
  name: 'tool:grep',
  order: 104,
  enabled: false,
  text: 'Use the grep tool — not shell grep or rg — to search file contents. Use read on a matched file when you need surrounding context.',
}

function namespace(
  sections: StudioSection[],
  overrides: BuiltinSectionOverride[] = [],
  revision = 3,
): SettingsNamespaceView {
  return {
    ns: 'prompt-studio',
    schema: {},
    value: { sections, overrides },
    applies: 'live',
    secrets: [],
    revision,
  }
}

describe('PromptStudioStore', () => {
  it('loads the registered namespace and provider writability', async () => {
    const api = {
      settings: {
        describe: () => Promise.resolve(ok({ writable: true, hasDocument: true, namespaces: [namespace([USER_SECTION], [BUILTIN_OVERRIDE])] })),
      },
    }
    const controller = new PromptStudioStore(api as never)
    await controller.load()
    expect(controller.store.getSnapshot()).toEqual({
      status: 'ready',
      error: null,
      writable: true,
      revision: 3,
      sections: [USER_SECTION],
      overrides: [BUILTIN_OVERRIDE],
    })
  })

  it('writes user sections and built-in overrides atomically with the descriptor revision', async () => {
    const requests: unknown[] = []
    const changed = { ...USER_SECTION, text: 'Be exact.' }
    const api = {
      settings: {
        describe: () => Promise.resolve(ok({ writable: true, hasDocument: false, namespaces: [namespace([USER_SECTION])] })),
        mutate: (request: unknown) => {
          requests.push(request)
          return Promise.resolve(ok(namespace([changed], [BUILTIN_OVERRIDE], 4)))
        },
      },
    }
    const controller = new PromptStudioStore(api as never)
    await controller.load()
    await controller.save({ sections: [changed], overrides: [BUILTIN_OVERRIDE] }, 3)
    expect(requests).toEqual([{
      ns: 'prompt-studio',
      ops: [
        { op: 'set', path: ['sections'], value: [changed] },
        { op: 'set', path: ['overrides'], value: [BUILTIN_OVERRIDE] },
      ],
      expectedRevision: 3,
    }])
    expect(controller.store.getSnapshot()).toMatchObject({
      revision: 4,
      sections: [changed],
      overrides: [BUILTIN_OVERRIDE],
    })
  })

  it('loads an older namespace with no overrides field as an empty override list', async () => {
    const legacy = { ...namespace([USER_SECTION]), value: { sections: [USER_SECTION] } }
    const controller = new PromptStudioStore({
      settings: {
        describe: () => Promise.resolve(ok({ writable: true, hasDocument: true, namespaces: [legacy] })),
      },
    } as never)
    await controller.load()
    expect(controller.store.getSnapshot().overrides).toEqual([])
  })

  it('surfaces missing namespaces and rejected writes', async () => {
    const missing = new PromptStudioStore({
      settings: {
        describe: () => Promise.resolve(ok({ writable: true, hasDocument: false, namespaces: [] })),
      },
    } as never)
    await missing.load()
    expect(missing.store.getSnapshot()).toMatchObject({
      status: 'error',
      error: 'prompt-studio settings namespace is not registered',
    })

    const rejected = new PromptStudioStore({
      settings: {
        describe: () => Promise.resolve(ok({ writable: true, hasDocument: false, namespaces: [namespace([])] })),
        mutate: () => Promise.resolve(fail('stale editor')),
      },
    } as never)
    await rejected.load()
    await expect(rejected.save({ sections: [USER_SECTION], overrides: [] }, 3)).rejects.toThrow('stale editor')
  })
})
