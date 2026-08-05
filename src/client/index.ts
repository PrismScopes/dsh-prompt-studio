/** Prompt Studio browser half: one live conversation-view contribution. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  PROMPT_STUDIO_NAMESPACE,
  PROMPT_STUDIO_VIEW_ORDER,
} from '../shared.ts'
import { PromptStudioStore, refreshIfLoaded } from './store.ts'
import { PromptStudioView, type PromptStudioViewInjected } from './PromptStudioView.tsx'

export type { PromptStudioState } from './store.ts'
export type { PromptStudioViewInjected, PromptStudioViewProps } from './PromptStudioView.tsx'

/** Slot registry, declaration-order edge, and settings transport. */
export const inject = ['slots', 'conversation', 'connection']

/** Register the tab, its shared controller, and pushed invalidations. */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new PromptStudioStore(connection.api)
  const useSnapshot = bindSnapshotSelector(controller.store)

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
    inject: (): PromptStudioViewInjected => ({ controller, useSnapshot }),
  }, PromptStudioView)
}
