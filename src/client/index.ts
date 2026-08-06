/** Prompt Studio browser half: one live conversation-view contribution. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  PROMPT_STUDIO_NAMESPACE,
  PROMPT_STUDIO_VIEW_ORDER,
} from '../shared.ts'
import { PromptStudioStore, refreshIfLoaded } from './store.ts'
import {
  PromptStudioSettingsSection,
  PromptStudioView,
  type PromptStudioViewInjected,
} from './PromptStudioView.tsx'

export type { PromptStudioState } from './store.ts'
export type { PromptStudioViewInjected, PromptStudioViewProps } from './PromptStudioView.tsx'

/** Slot registry, declaration-order edge, and settings transport. */
export const inject = ['slots', 'conversation', 'connection']

/** Register the tab, its shared controller, and pushed invalidations. */
export function apply(ctx: ClientContext): void {
  const controller = new PromptStudioStore()
  const useSnapshot = bindSnapshotSelector(controller.store)
  const injected = (): PromptStudioViewInjected => ({ controller, useSnapshot })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.on('settings/changed', (namespace) => {
        if (namespace === PROMPT_STUDIO_NAMESPACE) refresh()
      }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-prompt-studio: pushed invalidations')

  ctx.slots.register({
    name: 'conversation.view',
    id: 'prompt-studio',
    order: PROMPT_STUDIO_VIEW_ORDER,
    label: 'Prompt Studio',
    inject: injected,
  }, PromptStudioView)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'prompt-studio',
    order: PROMPT_STUDIO_VIEW_ORDER,
    label: 'Prompt Studio',
    inject: injected,
  }, PromptStudioSettingsSection))
}
