/** Browser controller for the prompt-studio settings namespace. */
import type {
  IApiClient,
  SettingsNamespaceView,
} from '@deepseek-ai/dsh-client-connection/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  PROMPT_STUDIO_NAMESPACE,
  validateBuiltinOverrides,
  validateStudioSections,
  type BuiltinSectionOverride,
  type StudioConfig,
  type StudioSection,
} from '../shared.ts'

/** Remote state consumed by the conversation view. */
export interface PromptStudioState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  writable: boolean
  revision: number
  sections: readonly StudioSection[]
  overrides: readonly BuiltinSectionOverride[]
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function decodeRows(value: unknown, label: string): StudioSection[] {
  if (!Array.isArray(value)) throw new TypeError(`prompt-studio settings has no ${label} array`)
  return value.map((entry, index): StudioSection => {
    if (typeof entry !== 'object' || entry === null) {
      throw new TypeError(`prompt-studio ${label} row ${String(index + 1)} is not an object`)
    }
    const candidate = entry as Partial<StudioSection>
    if (
      typeof candidate.name !== 'string'
      || typeof candidate.order !== 'number'
      || typeof candidate.enabled !== 'boolean'
      || typeof candidate.text !== 'string'
    ) {
      throw new TypeError(`prompt-studio ${label} row ${String(index + 1)} has an invalid shape`)
    }
    return {
      name: candidate.name,
      order: candidate.order,
      enabled: candidate.enabled,
      text: candidate.text,
    }
  })
}

function decodeConfig(value: unknown): StudioConfig {
  if (typeof value !== 'object' || value === null) throw new TypeError('prompt-studio settings value is not an object')
  const candidate = value as { sections?: unknown; overrides?: unknown }
  const sections = decodeRows(candidate.sections, 'sections')
  const overrides = candidate.overrides === undefined
    ? []
    : decodeRows(candidate.overrides, 'overrides') as BuiltinSectionOverride[]
  validateStudioSections(sections)
  validateBuiltinOverrides(overrides)
  return { sections, overrides }
}

function namespaceFrom(response: SettingsNamespaceView): StudioConfig {
  return decodeConfig(response.value)
}

/** One browser-side controller, shared by every session-scoped mount of the view. */
export class PromptStudioStore {
  /** Observable remote namespace state consumed by every mounted Prompt Studio view. */
  readonly store: SnapshotStore<PromptStudioState> = createSnapshotStore<PromptStudioState>({
    status: 'idle',
    error: null,
    writable: false,
    revision: 0,
    sections: [],
    overrides: [],
  })

  private generation = 0

  constructor(private readonly api: Pick<IApiClient, 'settings'>) {}

  /** Refetch the namespace descriptor; newest request wins. */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((state) => {
      state.status = 'loading'
      state.error = null
    })
    try {
      const response = await this.api.settings.describe({})
      if (!response.result.ok) throw new Error(response.result.error.message)
      const namespace = response.result.value.namespaces.find(row => row.ns === PROMPT_STUDIO_NAMESPACE)
      if (namespace === undefined) throw new Error('prompt-studio settings namespace is not registered')
      const config = namespaceFrom(namespace)
      if (generation !== this.generation) return
      this.accept(namespace, response.result.value.writable, config)
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((state) => {
        state.status = 'error'
        state.error = messageOf(error)
      })
    }
  }

  /**
   * Persist user rows and built-in replacements atomically with stale-editor protection.
   * @param config - complete Prompt Studio draft to commit.
   * @param expectedRevision - namespace revision the draft was based on.
   */
  async save(config: StudioConfig, expectedRevision: number): Promise<void> {
    validateStudioSections(config.sections)
    validateBuiltinOverrides(config.overrides)
    const generation = ++this.generation
    const response = await this.api.settings.mutate({
      ns: PROMPT_STUDIO_NAMESPACE,
      ops: [
        {
          op: 'set',
          path: ['sections'],
          value: config.sections.map(section => ({ ...section })),
        },
        {
          op: 'set',
          path: ['overrides'],
          value: config.overrides.map(override => ({ ...override })),
        },
      ],
      expectedRevision,
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    if (generation !== this.generation) return
    this.accept(response.result.value, this.store.getSnapshot().writable, namespaceFrom(response.result.value))
  }

  private accept(namespace: SettingsNamespaceView, writable: boolean, config: StudioConfig): void {
    this.store.update((state) => {
      state.status = 'ready'
      state.error = null
      state.writable = writable
      state.revision = namespace.revision
      state.sections = config.sections
      state.overrides = config.overrides
    })
  }
}

/**
 * Refresh only after the user has opened the view once.
 * @param controller - shared Prompt Studio browser controller.
 */
export function refreshIfLoaded(controller: PromptStudioStore): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
