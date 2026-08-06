/** Browser controller for the prompt-studio settings and runtime inventory. */
import type {
  IApiClient,
  SettingsNamespaceView,
} from '@deepseek-ai/dsh-client-connection/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  PROMPT_STUDIO_NAMESPACE,
  PROMPT_STUDIO_STATE_PATH,
  validatePromptComponents,
  type PromptComponent,
  type PromptComponentKind,
  type PromptComponentPosition,
  type PromptComponentRole,
  type RuntimePromptCatalog,
  type StudioConfig,
} from '../shared.ts'

/** Remote state consumed by the conversation view. */
export interface PromptStudioState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  writable: boolean
  revision: number
  components: readonly PromptComponent[]
  native: readonly PromptComponent[]
  assembled: readonly PromptComponent[]
  catalogRevision: number
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function objectRow(value: unknown, label: string, index: number): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`prompt-studio ${label} row ${String(index + 1)} is not an object`)
  }
  return value as Record<string, unknown>
}

const KINDS = new Set<PromptComponentKind>(['native', 'supplement'])
const POSITIONS = new Set<PromptComponentPosition>(['after_system', 'anchored', 'tail'])
const ROLES = new Set<PromptComponentRole>(['system', 'user', 'assistant'])

function decodeComponents(value: unknown, label: string, allowNative: boolean): PromptComponent[] {
  if (!Array.isArray(value)) throw new TypeError(`prompt-studio ${label} is not an array`)
  const components = value.map((entry, index): PromptComponent => {
    const candidate = objectRow(entry, label, index)
    const kind = candidate['kind']
    const position = candidate['position']
    const role = candidate['role']
    if (
      typeof candidate['id'] !== 'string'
      || typeof kind !== 'string' || !KINDS.has(kind as PromptComponentKind)
      || typeof role !== 'string' || !ROLES.has(role as PromptComponentRole)
      || (role === 'system'
        ? position !== undefined && position !== 'after_system'
        : typeof position !== 'string' || !POSITIONS.has(position as PromptComponentPosition))
      || typeof candidate['order'] !== 'number'
      || typeof candidate['enabled'] !== 'boolean'
      || typeof candidate['template'] !== 'string'
      || (candidate['origin'] !== undefined && typeof candidate['origin'] !== 'string')
    ) {
      throw new TypeError(`prompt-studio ${label} row ${String(index + 1)} has an invalid shape`)
    }
    const component: PromptComponent = {
      id: candidate['id'],
      kind: kind as PromptComponentKind,
      role: role as PromptComponentRole,
      order: candidate['order'],
      enabled: candidate['enabled'],
      template: candidate['template'],
      ...candidate['origin'] === undefined ? {} : { origin: candidate['origin'] as string },
    }
    if (component.role !== 'system') component.position = position as PromptComponentPosition
    return component
  })
  validatePromptComponents(components, allowNative)
  return components
}

function decodeConfig(value: unknown): StudioConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('prompt-studio settings value is not an object')
  }
  const candidate = value as { components?: unknown }
  return { components: decodeComponents(candidate.components, 'components', false) }
}

function namespaceFrom(response: SettingsNamespaceView): StudioConfig {
  return decodeConfig(response.value)
}

function decodeCatalog(value: unknown): RuntimePromptCatalog {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('prompt-studio runtime catalog is not an object')
  }
  const candidate = value as { revision?: unknown; native?: unknown; assembled?: unknown }
  if (typeof candidate.revision !== 'number' || !Number.isSafeInteger(candidate.revision)) {
    throw new TypeError('prompt-studio runtime catalog has an invalid revision')
  }
  return {
    revision: candidate.revision,
    native: decodeComponents(candidate.native, 'native catalog', true),
    assembled: decodeComponents(candidate.assembled, 'assembled catalog', true),
  }
}

async function loadCatalog(): Promise<RuntimePromptCatalog> {
  const response = await fetch(PROMPT_STUDIO_STATE_PATH, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`prompt-studio runtime catalog returned HTTP ${String(response.status)}`)
  return decodeCatalog(await response.json())
}

/** One browser-side controller, shared by every session-scoped mount of the view. */
export class PromptStudioStore {
  /** Observable remote namespace state consumed by every mounted Prompt Studio view. */
  readonly store: SnapshotStore<PromptStudioState> = createSnapshotStore<PromptStudioState>({
    status: 'idle',
    error: null,
    writable: false,
    revision: 0,
    components: [],
    native: [],
    assembled: [],
    catalogRevision: 0,
  })

  private generation = 0

  constructor(private readonly api: Pick<IApiClient, 'settings'>) {}

  /** Refetch the namespace descriptor and runtime registry; newest request wins. */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((state) => {
      state.status = 'loading'
      state.error = null
    })
    try {
      const [response, catalog] = await Promise.all([
        this.api.settings.describe({}),
        loadCatalog(),
      ])
      if (!response.result.ok) throw new Error(response.result.error.message)
      const namespace = response.result.value.namespaces.find(row => row.ns === PROMPT_STUDIO_NAMESPACE)
      if (namespace === undefined) throw new Error('prompt-studio settings namespace is not registered')
      const config = namespaceFrom(namespace)
      if (generation !== this.generation) return
      this.accept(namespace, response.result.value.writable, config, catalog)
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((state) => {
        state.status = 'error'
        state.error = messageOf(error)
      })
    }
  }

  /** Persist one unified component draft with stale-editor protection. */
  async save(components: readonly PromptComponent[], expectedRevision: number): Promise<void> {
    validatePromptComponents(components)
    const generation = ++this.generation
    const response = await this.api.settings.mutate({
      ns: PROMPT_STUDIO_NAMESPACE,
      ops: [
        {
          op: 'set',
          path: ['components'],
          value: components.map(component => ({ ...component })),
        },
      ],
      expectedRevision,
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    const catalog = await loadCatalog()
    if (generation !== this.generation) return
    this.accept(
      response.result.value,
      this.store.getSnapshot().writable,
      namespaceFrom(response.result.value),
      catalog,
    )
  }

  private accept(
    namespace: SettingsNamespaceView,
    writable: boolean,
    config: StudioConfig,
    catalog: RuntimePromptCatalog,
  ): void {
    this.store.update((state) => {
      state.status = 'ready'
      state.error = null
      state.writable = writable
      state.revision = namespace.revision
      state.components = config.components
      state.native = catalog.native
      state.assembled = catalog.assembled
      state.catalogRevision = catalog.revision
    })
  }
}

/** Refresh only after the user has opened the view once. */
export function refreshIfLoaded(controller: PromptStudioStore): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
