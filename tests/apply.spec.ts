import { Context } from 'cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotsService } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { PromptStudioView } from '../src/client/PromptStudioView.tsx'
import type { PromptStudioViewInjected } from '../src/client/PromptStudioView.tsx'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotsService).await()
  ctx.provide('conversation', {} as never)
  ctx.provide('connection', { api: { settings: {} } } as never)
  const slots = ctx.get('slots') as SlotsService
  slots.register({
    name: 'root',
    children: { 'conversation.view': { kind: 'list', scope: 'session' } },
  } as never, () => null)
  return { ctx, slots }
}

describe('Prompt Studio browser apply', () => {
  it('declares the services it consumes', () => {
    expect(inject).toEqual(['slots', 'conversation', 'connection'])
  })

  it('registers the Prompt Studio conversation tab and disposes it with the fiber', async () => {
    const { ctx, slots } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const entry = slots.entries('conversation.view')[0]!
    expect(entry.component).toBe(PromptStudioView)
    expect(entry.options).toMatchObject({
      id: 'prompt-studio',
      order: 20,
      label: 'Prompt Studio',
    })
    const injected = (entry.inject as unknown as () => PromptStudioViewInjected)()
    expect(typeof injected.controller.load).toBe('function')
    expect(typeof injected.useSnapshot).toBe('function')

    await fiber.dispose()
    expect(slots.entries('conversation.view')).toHaveLength(0)
  })

  it('refreshes a loaded controller only for relevant pushed invalidations', async () => {
    const { ctx, slots } = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    const injected = (slots.entries('conversation.view')[0]!.inject as unknown as () => PromptStudioViewInjected)()
    injected.controller.store.update((state) => { state.status = 'ready' })
    const load = vi.spyOn(injected.controller, 'load').mockResolvedValue()

    ctx.emit('settings/changed', 'llm-deepseek')
    expect(load).not.toHaveBeenCalled()
    ctx.emit('settings/changed', 'prompt-studio')
    ctx.emit('connection/reset')
    expect(load).toHaveBeenCalledTimes(2)
  })
})
