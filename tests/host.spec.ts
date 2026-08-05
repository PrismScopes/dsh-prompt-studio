import { Context } from 'cordis'
import { describe, expect, it } from 'vitest'
import { createScope } from '@deepseek-ai/dsh-scope'
import { Settings, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import SystemPrompt, { renderPrompt, type PromptSection } from '@deepseek-ai/dsh-system-prompt'
import {
  PROMPT_STUDIO_SETTINGS_NAMESPACE,
  apply,
  inject,
  type BuiltinSectionOverride,
  type StudioSection,
} from '../src/index.ts'

class MemorySettings extends Settings {
  constructor(ctx: Context, readonly doc: Record<string, unknown> = {}) {
    super(ctx)
  }

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = structuredClone(section)
    return Promise.resolve()
  }
}

const FIRST: StudioSection = {
  name: 'user:first',
  order: 20,
  enabled: true,
  text: 'First.',
}

const CLOSED_PERSONA: BuiltinSectionOverride = {
  name: 'deployment:persona',
  order: 0,
  enabled: false,
  text: 'Persona.',
}

async function settleWatcher(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

async function createPromptScope(
  ctx: Context,
  key: object,
  sections: readonly PromptSection[],
): Promise<ReturnType<typeof createScope>> {
  let scope!: ReturnType<typeof createScope>
  await ctx.plugin(Object.assign(
    (inner: Context) => {
      scope = createScope(inner, key)
      for (const section of sections) scope.ctx.systemPrompt.section(section)
    },
    { inject: ['systemPrompt'] },
  ))
  return scope
}

async function boot(doc: Record<string, unknown> = {}, scopedSections: readonly PromptSection[] = []) {
  const ctx = new Context()
  await ctx.plugin(MemorySettings, doc)
  await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, persona: 'Persona.' })
  const scopeKey = scopedSections.length > 0 ? {} : undefined
  const scope = scopeKey === undefined ? undefined : await createPromptScope(ctx, scopeKey, scopedSections)
  const fiber = ctx.plugin({ name: 'prompt-studio-test', inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, scope, scopeKey }
}

describe('Prompt Studio Host half', () => {
  it('registers the namespace and applies initial stored sections', async () => {
    const { ctx } = await boot({ 'prompt-studio': { sections: [FIRST] } })
    const descriptor = ctx.settings.describe().find(row => row.ns === PROMPT_STUDIO_SETTINGS_NAMESPACE)
    expect(descriptor).toMatchObject({ applies: 'live', value: { sections: [FIRST], overrides: [] } })
    expect((await ctx.systemPrompt.assemble()).sections).toEqual([
      { name: 'deployment:persona', text: 'Persona.' },
      { name: 'user:first', text: 'First.' },
    ])
  })

  it('replaces, disables, and removes live registrations after a commit', async () => {
    const { ctx } = await boot({ 'prompt-studio': { sections: [FIRST] } })
    await ctx.settings.update(PROMPT_STUDIO_SETTINGS_NAMESPACE, {
      sections: [
        { ...FIRST, text: 'Changed.' },
        { name: 'user:disabled', order: 30, enabled: false, text: 'Hidden.' },
      ],
    })
    await settleWatcher()
    expect((await ctx.systemPrompt.assemble()).sections).toEqual([
      { name: 'deployment:persona', text: 'Persona.' },
      { name: 'user:first', text: 'Changed.' },
    ])

    await ctx.settings.update(PROMPT_STUDIO_SETTINGS_NAMESPACE, { sections: [] })
    await settleWatcher()
    expect((await ctx.systemPrompt.assemble()).sections.map(row => row.name)).toEqual(['deployment:persona'])
  })

  it('removes its prompt registrations with its fiber', async () => {
    const { ctx, fiber } = await boot({ 'prompt-studio': { sections: [FIRST] } })
    await fiber.dispose()
    expect((await ctx.systemPrompt.assemble()).sections.map(row => row.name)).toEqual(['deployment:persona'])
    expect(ctx.settings.get(PROMPT_STUDIO_SETTINGS_NAMESPACE)).toBeUndefined()
  })

  it('rejects duplicate names at the settings validation boundary', async () => {
    const { ctx } = await boot()
    await expect(ctx.settings.update(PROMPT_STUDIO_SETTINGS_NAMESPACE, {
      sections: [FIRST, { ...FIRST }],
    })).rejects.toThrow('listed more than once')
  })

  it('fails initial composition when a user row attempts to replace a built-in', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings, {
      'prompt-studio': {
        sections: [{ ...FIRST, name: 'deployment:persona' }],
      },
    })
    await ctx.plugin(SystemPrompt, { persona: 'Persona.' })
    expect(() => { apply(ctx) }).toThrow('built in and cannot be replaced')
  })

  it('applies built-in overrides across global and scoped assemblies, then replaces them live', async () => {
    const { ctx, scope, scopeKey } = await boot({
      'prompt-studio': { sections: [], overrides: [CLOSED_PERSONA] },
    }, [{ name: 'deployment:persona', order: 0, text: 'Child persona.' }])
    const futureKey = {}
    const future = await createPromptScope(ctx, futureKey, [
      { name: 'deployment:persona', order: 0, text: 'Future child persona.' },
    ])
    if (scope === undefined || scopeKey === undefined) throw new Error('scoped test setup failed')

    expect(renderPrompt(await ctx.systemPrompt.assemble({ scope: scopeKey }))).toBe('')
    expect(renderPrompt(await ctx.systemPrompt.assemble({ scope: futureKey }))).toBe('')
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe('')

    const changed: BuiltinSectionOverride = {
      ...CLOSED_PERSONA,
      order: 25,
      enabled: true,
      text: 'Changed persona.',
    }
    await ctx.settings.update(PROMPT_STUDIO_SETTINGS_NAMESPACE, {
      sections: [],
      overrides: [changed],
    })
    await settleWatcher()
    expect(renderPrompt(await ctx.systemPrompt.assemble({ scope: scopeKey }))).toBe('Changed persona.')
    expect(renderPrompt(await ctx.systemPrompt.assemble({ scope: futureKey }))).toBe('Changed persona.')
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toBe('Changed persona.')

    await future.dispose()
    await scope.dispose()
  })

  it('restores built-in defaults when an override is removed or the plugin unloads', async () => {
    const { ctx, fiber, scope, scopeKey } = await boot({
      'prompt-studio': { sections: [], overrides: [CLOSED_PERSONA] },
    }, [{ name: 'deployment:persona', order: 0, text: 'Child persona.' }])
    if (scope === undefined || scopeKey === undefined) throw new Error('scoped test setup failed')
    expect(renderPrompt(await ctx.systemPrompt.assemble({ scope: scopeKey }))).toBe('')

    await ctx.settings.update(PROMPT_STUDIO_SETTINGS_NAMESPACE, { sections: [], overrides: [] })
    await settleWatcher()
    expect(renderPrompt(await ctx.systemPrompt.assemble({ scope: scopeKey }))).toBe('Child persona.')

    await ctx.settings.update(PROMPT_STUDIO_SETTINGS_NAMESPACE, {
      sections: [],
      overrides: [CLOSED_PERSONA],
    })
    await settleWatcher()
    expect(renderPrompt(await ctx.systemPrompt.assemble({ scope: scopeKey }))).toBe('')
    await fiber.dispose()
    expect(renderPrompt(await ctx.systemPrompt.assemble({ scope: scopeKey }))).toBe('Child persona.')
    await scope.dispose()
  })

  it('uses the marker position for an overridden order without colliding with a scoped target', async () => {
    const changed = { ...CLOSED_PERSONA, order: 20, enabled: true, text: 'Moved persona.' }
    const { ctx, scope, scopeKey } = await boot({
      'prompt-studio': { sections: [], overrides: [changed] },
    }, [
      { name: 'deployment:persona', order: 0, text: 'Child persona.' },
      { name: 'scope:before', order: 10, text: 'Before.' },
      { name: 'scope:after', order: 30, text: 'After.' },
    ])
    if (scope === undefined || scopeKey === undefined) throw new Error('scoped test setup failed')

    expect((await ctx.systemPrompt.assemble({ scope: scopeKey })).sections).toEqual([
      { name: 'scope:before', text: 'Before.' },
      { name: 'deployment:persona', text: 'Moved persona.' },
      { name: 'scope:after', text: 'After.' },
    ])
    await scope.dispose()
  })

  it('does not synthesize an override whose owning plugin is not mounted', async () => {
    const grepOverride: BuiltinSectionOverride = {
      name: 'tool:grep',
      order: 104,
      enabled: true,
      text: 'Replacement grep guidance.',
    }
    const { ctx } = await boot({
      'prompt-studio': { sections: [], overrides: [grepOverride] },
    })
    expect((await ctx.systemPrompt.assemble()).sections).toEqual([
      { name: 'deployment:persona', text: 'Persona.' },
    ])
  })
})
