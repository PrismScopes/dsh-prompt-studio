/** Settings namespace shared by the Host registration and browser editor. */
export const PROMPT_STUDIO_NAMESPACE = 'prompt-studio'

/** Same-origin endpoint exposing the runtime-discovered prompt inventory. */
export const PROMPT_STUDIO_STATE_PATH = '/prompt-studio/state'

/** Conversation-view placement: Chat is 0 and Trajectory is 10. */
export const PROMPT_STUDIO_VIEW_ORDER = 20

/** Initial order assigned to a newly added supplement. */
export const DEFAULT_SUPPLEMENT_ORDER = 100

/** Namespace reserved for ordered replacement markers owned by the Host half. */
export const PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX = 'prompt-studio:override-marker:'

/** Runtime provenance is the only component-kind distinction. */
export type PromptComponentKind = 'native' | 'supplement'

/** Model-facing placement of one component. */
export type PromptComponentPosition = 'after_system' | 'anchored' | 'tail'

/** Model-facing role of one component. */
export type PromptComponentRole = 'system' | 'user' | 'assistant'

/** One item in the unified prompt-composition model. */
export interface PromptComponent {
  id: string
  kind: PromptComponentKind
  role: PromptComponentRole
  position: PromptComponentPosition
  order: number
  enabled: boolean
  template: string
  /** Native target id when this supplement overrides a runtime component. */
  origin?: string
}

/** Resolved value of the prompt-studio settings namespace. */
export interface StudioConfig {
  components: PromptComponent[]
}

/** Runtime state returned by the Host inventory endpoint. */
export interface RuntimePromptCatalog {
  revision: number
  native: PromptComponent[]
  /** Effective system-section sequence from the latest real assembly. */
  assembled: PromptComponent[]
}

export type NativeOverride = PromptComponent & { kind: 'supplement'; origin: string }

const KINDS = new Set<PromptComponentKind>(['native', 'supplement'])
const POSITIONS = new Set<PromptComponentPosition>(['after_system', 'anchored', 'tail'])
const ROLES = new Set<PromptComponentRole>(['system', 'user', 'assistant'])

function validateIdentifier(value: string, label: string): void {
  if (value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${label} must be non-empty and have no surrounding whitespace`)
  }
}

/** Return whether a supplement targets one runtime-native component. */
export function isNativeOverride(component: PromptComponent): component is NativeOverride {
  return component.kind === 'supplement' && component.origin !== undefined
}

/**
 * Validate configured or runtime component rows.
 * @param components - rows to validate.
 * @param allowNative - whether runtime-only native rows are accepted.
 */
export function validatePromptComponents(
  components: readonly PromptComponent[],
  allowNative = false,
): void {
  const ids = new Set<string>()
  const overrideTargets = new Set<string>()
  for (const component of components) {
    validateIdentifier(component.id, 'prompt component ids')
    if (!KINDS.has(component.kind)) throw new TypeError(`prompt component "${component.id}" has an invalid kind`)
    if (!POSITIONS.has(component.position)) {
      throw new TypeError(`prompt component "${component.id}" has an invalid position`)
    }
    if (!ROLES.has(component.role)) throw new TypeError(`prompt component "${component.id}" has an invalid role`)
    if (!Number.isFinite(component.order)) {
      throw new TypeError(`prompt component "${component.id}" order must be a finite number`)
    }
    if (component.id.startsWith(PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX)) {
      throw new TypeError(`prompt component ids beginning with "${PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX}" are reserved`)
    }
    if (ids.has(component.id)) throw new TypeError(`prompt component "${component.id}" is listed more than once`)
    ids.add(component.id)

    if (component.kind === 'native') {
      if (!allowNative) throw new TypeError(`native prompt component "${component.id}" cannot be persisted`)
      if (component.origin !== undefined) {
        throw new TypeError(`native prompt component "${component.id}" cannot override another component`)
      }
      if (component.position !== 'after_system' || component.role !== 'system') {
        throw new TypeError(`native prompt component "${component.id}" must use the system role and system position`)
      }
      continue
    }

    if (component.origin === undefined) continue
    validateIdentifier(component.origin, `supplement "${component.id}" native target`)
    if (overrideTargets.has(component.origin)) {
      throw new TypeError(`native prompt component "${component.origin}" is overridden more than once`)
    }
    overrideTargets.add(component.origin)
  }
}

function uniqueComponentId(preferred: string, used: Set<string>): string {
  if (!used.has(preferred)) {
    used.add(preferred)
    return preferred
  }
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${preferred}-${String(suffix)}`
    if (used.has(candidate)) continue
    used.add(candidate)
    return candidate
  }
}

/** Resolve native override targets for a draft system-slot preview. */
export function buildDraftSystemComponents(
  native: readonly PromptComponent[],
  configured: readonly PromptComponent[],
): PromptComponent[] {
  validatePromptComponents(native, true)
  validatePromptComponents(configured)
  const overrides = new Map(configured
    .filter(isNativeOverride)
    .map(component => [component.origin, component]))
  return native.flatMap((component): PromptComponent[] => {
    const override = overrides.get(component.id)
    if (override === undefined) return component.enabled ? [{ ...component }] : []
    return []
  }).sort((left, right) => left.order - right.order)
}

/** Concatenate enabled system components using the Host renderer's blank-line rule. */
export function renderSystemPreview(components: readonly PromptComponent[]): string {
  return components.map(component => component.template).filter(text => text.length > 0).join('\n\n')
}

/** Allocate the first readable supplement id absent from a component draft. */
export function nextSupplementId(components: readonly PromptComponent[]): string {
  const used = new Set(components.map(component => component.id))
  return uniqueComponentId('supplement:message', used)
}

/** Allocate a readable id for a supplement overriding one native component. */
export function nextOverrideId(components: readonly PromptComponent[], target: string): string {
  const used = new Set(components.map(component => component.id))
  return uniqueComponentId(`override:${target}`, used)
}
