/** Host half of Prompt Studio: settings ownership and live prompt registrations. */
import type { Context } from 'cordis'
import type { SettingsNamespace, SettingsScope } from '@deepseek-ai/dsh-settings'
import type { PromptAssembly, PromptSection, SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import { studioConfigSchema } from './config.ts'
import {
  PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX,
  PROMPT_STUDIO_NAMESPACE,
  validateBuiltinOverrides,
  validateStudioSections,
  type BuiltinSectionOverride,
  type StudioConfig,
  type StudioSection,
} from './shared.ts'

export {
  BUILTIN_SECTIONS,
  DEFAULT_USER_SECTION_ORDER,
  PROMPT_STUDIO_NAMESPACE,
  PROMPT_STUDIO_VIEW_ORDER,
  buildPreviewSections,
  nextSectionName,
  renderPreview,
  resolveBuiltinSections,
  validateBuiltinOverrides,
  validateStudioSections,
} from './shared.ts'
export type {
  BuiltinSection,
  BuiltinSectionOverride,
  PreviewSection,
  ResolvedBuiltinSection,
  StudioConfig,
  StudioSection,
} from './shared.ts'
export { studioConfigSchema } from './config.ts'

/** Branded Host settings key. */
export const PROMPT_STUDIO_SETTINGS_NAMESPACE = PROMPT_STUDIO_NAMESPACE as SettingsNamespace

/** Stable Cordis plugin name. */
export const name = 'client-ui-prompt-studio'

/** Host services required before the namespace and sections can be installed. */
export const inject = ['settings', 'systemPrompt']

interface ActiveSection {
  section: PromptSection
  dispose: () => void
}

function sameSection(left: PromptSection, right: StudioSection): boolean {
  return left.name === right.name && left.order === right.order && left.text === right.text
}

/** Maintains the exact enabled settings set in the system-prompt registry. */
class PromptSectionBindings {
  private readonly active = new Map<string, ActiveSection>()

  constructor(private readonly registry: Pick<SystemPrompt, 'section'>) {}

  replace(sections: readonly StudioSection[]): void {
    const next = new Map(sections.filter(section => section.enabled).map(section => [section.name, section]))
    const staged = this.stageAdditions(next)

    for (const [sectionName, active] of [...this.active]) {
      const replacement = next.get(sectionName)
      if (replacement === undefined) {
        active.dispose()
        this.active.delete(sectionName)
        continue
      }
      if (sameSection(active.section, replacement)) continue
      active.dispose()
      this.active.set(sectionName, this.install(replacement))
    }

    for (const [sectionName, active] of staged) this.active.set(sectionName, active)
  }

  dispose(): void {
    for (const active of this.active.values()) active.dispose()
    this.active.clear()
  }

  private stageAdditions(next: ReadonlyMap<string, StudioSection>): Map<string, ActiveSection> {
    const staged = new Map<string, ActiveSection>()
    try {
      for (const [sectionName, section] of next) {
        if (!this.active.has(sectionName)) staged.set(sectionName, this.install(section))
      }
      return staged
    } catch (error) {
      for (const active of staged.values()) active.dispose()
      throw error
    }
  }

  private install(section: StudioSection): ActiveSection {
    const promptSection: PromptSection = {
      name: section.name,
      order: section.order,
      text: section.text,
    }
    return { section: promptSection, dispose: this.registry.section(promptSection) }
  }
}

function markerName(sectionName: string): string {
  return `${PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX}${sectionName}`
}

function materializeOverrideMarkers(overrides: readonly BuiltinSectionOverride[]): StudioSection[] {
  return overrides.map(override => ({
    name: markerName(override.name),
    order: override.order,
    enabled: true,
    text: override.enabled ? override.text : '',
  }))
}

/**
 * Carries override order through the registry without colliding with an
 * existing same-scope section such as a subagent persona. The assembly seam
 * replaces each marker with its target, or removes both when the row is closed.
 */
class BuiltinOverrideBindings {
  private readonly markers: PromptSectionBindings
  private overridesByMarker = new Map<string, BuiltinSectionOverride>()

  constructor(registry: Pick<SystemPrompt, 'section'>) {
    this.markers = new PromptSectionBindings(registry)
  }

  replace(overrides: readonly BuiltinSectionOverride[]): void {
    validateBuiltinOverrides(overrides)
    const next = overrides.map(override => ({ ...override }))
    this.markers.replace(materializeOverrideMarkers(next))
    this.overridesByMarker = new Map(next.map(override => [markerName(override.name), override]))
  }

  apply(assembly: PromptAssembly): void {
    if (this.overridesByMarker.size === 0) return
    const presentNames = new Set(assembly.sections.map(section => section.name))
    const replacedTargets = new Set<string>()
    for (const [name, override] of this.overridesByMarker) {
      if (presentNames.has(name)) replacedTargets.add(override.name)
    }

    assembly.sections = assembly.sections.flatMap((section) => {
      const override = this.overridesByMarker.get(section.name)
      if (override !== undefined) {
        if (!presentNames.has(override.name) || !override.enabled) return []
        return [{ name: override.name, text: section.text }]
      }
      return replacedTargets.has(section.name) ? [] : [section]
    })
  }

  dispose(): void {
    this.markers.dispose()
    this.overridesByMarker.clear()
  }
}

/** Register the live namespace and mirror its user rows and built-in replacements. */
export function apply(ctx: Context): void {
  const scope: SettingsScope<StudioConfig> = ctx.settings.register(
    PROMPT_STUDIO_SETTINGS_NAMESPACE,
    studioConfigSchema,
    { applies: 'live' },
  )
  const userBindings = new PromptSectionBindings(ctx.systemPrompt)
  const overrideBindings = new BuiltinOverrideBindings(ctx.systemPrompt)
  const initial = scope.get()
  validateStudioSections(initial.sections)
  userBindings.replace(initial.sections)
  overrideBindings.replace(initial.overrides)

  const stopOverriding = ctx.on('system-prompt/assemble', (assembly, _context, next) => {
    overrideBindings.apply(assembly)
    return next()
  }, { prepend: true })

  const stopWatching = scope.watch((next) => {
    validateStudioSections(next.sections)
    userBindings.replace(next.sections)
    overrideBindings.replace(next.overrides)
  })
  ctx.effect(() => () => {
    stopWatching()
    stopOverriding()
    overrideBindings.dispose()
    userBindings.dispose()
  }, 'ui-prompt-studio: live prompt sections')
}
