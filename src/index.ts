/** Host half of Prompt Studio: reversible component activation and request-local composition. */
import type { Context } from 'cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {
  GenerateOptions,
  Message,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { SettingsNamespace, SettingsScope } from '@deepseek-ai/dsh-settings'
import type {
  AssembledSection,
  AssembleContext,
  PromptAssembly,
} from '@deepseek-ai/dsh-system-prompt'
import { studioConfigSchema } from './config.ts'
import {
  PROMPT_STUDIO_NAMESPACE,
  PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX,
  PROMPT_STUDIO_STATE_PATH,
  isNativeOverride,
  validatePromptComponents,
  type NativeOverride,
  type PromptComponent,
  type RuntimePromptCatalog,
  type StudioConfig,
} from './shared.ts'

export {
  DEFAULT_SUPPLEMENT_ORDER,
  PROMPT_STUDIO_NAMESPACE,
  PROMPT_STUDIO_STATE_PATH,
  PROMPT_STUDIO_VIEW_ORDER,
  buildDraftSystemComponents,
  isNativeOverride,
  nextOverrideId,
  nextSupplementId,
  renderSystemPreview,
  validatePromptComponents,
} from './shared.ts'
export type {
  NativeOverride,
  PromptComponent,
  PromptComponentKind,
  PromptComponentPosition,
  PromptComponentRole,
  RuntimePromptCatalog,
  StudioConfig,
} from './shared.ts'
export { studioConfigSchema } from './config.ts'

/** Branded Host settings key. */
export const PROMPT_STUDIO_SETTINGS_NAMESPACE = PROMPT_STUDIO_NAMESPACE as SettingsNamespace

/** Stable Cordis plugin name. */
export const name = 'client-ui-prompt-studio'

/** Host services required by the component and request pipelines. */
export const inject = ['settings', 'systemPrompt', 'llm']

const REQUEST_SOURCE = 'moeblack/prompt-studio'

interface HttpRequestLike {
  method?: string
}

interface HttpResponseLike {
  writeHead(status: number, headers?: Record<string, string>): unknown
  end(body?: string): void
}

interface HttpServerLike {
  register(route: {
    kind: 'exact'
    path: string
    handler: (request: HttpRequestLike, response: HttpResponseLike) => void
  }): () => void
}

declare module 'cordis' {
  interface Context {
    httpServer: HttpServerLike
  }
}

function markerName(target: string): string {
  return `${PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX}${target}`
}

function cloneComponent(component: PromptComponent): PromptComponent {
  return { ...component }
}

/** Live values contributed by currently active configuration effects. */
class RuntimeBindings {
  readonly ownedSectionNames = new Set<string>()
  readonly overridesByMarker = new Map<string, NativeOverride>()
  readonly supplements = new Map<string, PromptComponent>()

  /** Activate one component and return its composed inverse. */
  activate(ctx: Context, component: PromptComponent): () => void {
    if (component.kind === 'native') throw new TypeError(`native prompt component "${component.id}" cannot be activated from settings`)
    if (isNativeOverride(component)) {
      const snapshot = { ...component, origin: component.origin }
      const marker = markerName(snapshot.origin)
      return ctx.effect(function* (this: RuntimeBindings) {
        this.ownedSectionNames.add(marker)
        this.overridesByMarker.set(marker, snapshot)
        if (snapshot.enabled) this.supplements.set(snapshot.id, snapshot)
        yield () => {
          this.supplements.delete(snapshot.id)
          this.overridesByMarker.delete(marker)
          this.ownedSectionNames.delete(marker)
        }
        yield ctx.systemPrompt.section({
          name: marker,
          order: snapshot.order,
          text: '',
        })
      }.bind(this), `prompt-studio: override ${snapshot.origin}`)
    }
    if (!component.enabled) return ctx.effect(() => () => undefined, `prompt-studio: disabled ${component.id}`)
    const snapshot = cloneComponent(component)
    return ctx.effect(function* (this: RuntimeBindings) {
      this.supplements.set(snapshot.id, snapshot)
      yield () => { this.supplements.delete(snapshot.id) }
    }.bind(this), `prompt-studio: supplement ${component.id}`)
  }
}

/** Replaces a complete configuration by recovering and reapplying one composed effect. */
class ComponentPipeline {
  private recover: () => void = () => undefined

  constructor(
    private readonly ctx: Context,
    private readonly bindings: RuntimeBindings,
  ) {}

  replace(components: readonly PromptComponent[]): void {
    validatePromptComponents(components)
    this.recover()
    const snapshots = components.map(cloneComponent)
    this.recover = this.ctx.effect(function* (this: ComponentPipeline) {
      for (const component of snapshots) yield this.bindings.activate(this.ctx, component)
    }.bind(this), 'prompt-studio: configured component set')
  }
}

function applyOverrides(
  assembly: PromptAssembly,
  overridesByMarker: ReadonlyMap<string, NativeOverride>,
): Set<string> {
  const matchedOverrideIds = new Set<string>()
  if (overridesByMarker.size === 0) return matchedOverrideIds
  const presentNames = new Set(assembly.sections.map(section => section.name))
  const replacedTargets = new Set<string>()
  for (const [marker, override] of overridesByMarker) {
    if (!presentNames.has(marker) || !presentNames.has(override.origin)) continue
    replacedTargets.add(override.origin)
    matchedOverrideIds.add(override.id)
  }
  assembly.sections = assembly.sections.flatMap((section) => {
    const override = overridesByMarker.get(section.name)
    if (override !== undefined) return []
    return replacedTargets.has(section.name) ? [] : [section]
  })
  return matchedOverrideIds
}

function runtimeNative(
  sections: readonly AssembledSection[],
  ownedSectionNames: ReadonlySet<string>,
): PromptComponent[] {
  return sections
    .filter(section => !ownedSectionNames.has(section.name))
    .map((section, order) => ({
      id: section.name,
      kind: 'native',
      position: 'after_system',
      role: 'system',
      order,
      enabled: true,
      template: section.text,
    }))
}

function effectiveAssembly(
  sections: readonly AssembledSection[],
): PromptComponent[] {
  return sections.map((section, order) => ({
    id: section.name,
    kind: 'native',
    position: 'after_system',
    role: 'system',
    order,
    enabled: true,
    template: section.text,
  }))
}

/** Latest value-level snapshot of the runtime registry. */
class RuntimeCatalogStore {
  private revision = 0
  private native: PromptComponent[] = []
  private assembled: PromptComponent[] = []

  commit(native: readonly PromptComponent[], assembled: readonly PromptComponent[]): void {
    const nextNative = native.map(cloneComponent)
    const nextAssembled = assembled.map(cloneComponent)
    if (
      JSON.stringify(nextNative) === JSON.stringify(this.native)
      && JSON.stringify(nextAssembled) === JSON.stringify(this.assembled)
    ) return
    this.native = nextNative
    this.assembled = nextAssembled
    this.revision += 1
  }

  snapshot(): RuntimePromptCatalog {
    return {
      revision: this.revision,
      native: this.native.map(cloneComponent),
      assembled: this.assembled.map(cloneComponent),
    }
  }
}

function latestUserInput(agent: Agent): string | undefined {
  for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
    const event = agent.session.events[index]
    if (event?.type !== 'user/message') continue
    return event.data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
  }
  return undefined
}

function liveVariables(agent: Agent): Record<string, string | undefined> {
  return {
    user_input: latestUserInput(agent),
    model: agent.options.model,
    cwd: agent.session.header.cwd,
  }
}

function renderComponentTemplate(component: PromptComponent, agent: Agent): string {
  const variables = liveVariables(agent)
  return component.template.replace(/\{\{([^{}]*)\}\}/g, (reference, name: string) => {
    if (!Object.hasOwn(variables, name)) {
      throw new Error(`unknown prompt variable "${reference}" in component "${component.id}"`)
    }
    const value = variables[name]
    if (value === undefined) {
      throw new Error(`prompt variable "${reference}" has no value in component "${component.id}"`)
    }
    return value
  })
}

interface PlannedSupplement {
  id: string
  position: PromptComponent['position']
  role: PromptComponent['role']
  order: number
  text: string
  declaration: number
}

/** Request-owned supplementary plans materialized during the matching assembly. */
class SupplementPlans {
  private readonly bySession = new Map<string, PlannedSupplement[]>()

  prepare(agent: Agent | undefined, components: readonly PromptComponent[]): void {
    if (agent === undefined) return
    const plan = components.map((component, declaration): PlannedSupplement => ({
      id: component.id,
      position: component.position,
      role: component.role,
      order: component.order,
      text: renderComponentTemplate(component, agent),
      declaration,
    })).sort((left, right) => left.order - right.order || left.declaration - right.declaration)
    if (plan.length === 0) {
      this.bySession.delete(String(agent.session.id))
      return
    }
    this.bySession.set(String(agent.session.id), plan)
  }

  take(sessionId: string): PlannedSupplement[] | undefined {
    const plan = this.bySession.get(sessionId)
    this.bySession.delete(sessionId)
    return plan
  }

  clear(): void {
    this.bySession.clear()
  }
}

function supplementalMessage(supplement: PlannedSupplement): Message {
  return Object.freeze({
    id: crypto.randomUUID(),
    role: supplement.role,
    content: Object.freeze([Object.freeze({ type: 'text' as const, text: supplement.text })]),
    source: Object.freeze({ kind: 'plugin' as const, plugin: REQUEST_SOURCE }),
  }) as Message
}

function insertSupplements(
  nativeMessages: readonly Message[],
  plan: readonly PlannedSupplement[],
): Message[] {
  const afterSystem = plan.filter(item => item.position === 'after_system').map(supplementalMessage)
  const anchored = plan.filter(item => item.position === 'anchored').map(supplementalMessage)
  const tail = plan.filter(item => item.position === 'tail').map(supplementalMessage)
  let anchor = -1
  for (let index = nativeMessages.length - 1; index >= 0; index -= 1) {
    const message = nativeMessages[index]
    if (message?.role === 'user' && message.source.kind === 'user') {
      anchor = index
      break
    }
  }
  const result = [...afterSystem]
  for (let index = 0; index < nativeMessages.length; index += 1) {
    const message = nativeMessages[index]
    if (message !== undefined) result.push(message)
    if (index === anchor) result.push(...anchored)
  }
  result.push(...tail)
  return result
}

function rewriteRequest(
  ctx: Context,
  plans: SupplementPlans,
  options: GenerateOptions,
  next: () => AsyncIterable<StreamChunk>,
): AsyncIterable<StreamChunk> {
  const loopRequest = options.sessionId !== undefined
    && options.purpose === undefined
    && Object.isFrozen(options)
    && Object.isFrozen(options.messages)
  if (!loopRequest || options.sessionId === undefined) return next()
  const plan = plans.take(String(options.sessionId))
  if (plan === undefined) return next()
  const messages = insertSupplements(options.messages, plan)
  Object.freeze(messages)
  const rewritten: GenerateOptions = Object.freeze({
    ...options,
    messages,
  })
  // A new one-shot request intentionally lacks the loop marker, so this listener delegates it unchanged.
  return ctx.llm.stream(rewritten)
}

function installCatalogRoute(ctx: Context, catalog: RuntimeCatalogStore): void {
  ctx.inject(['httpServer'], (routeCtx) => {
    routeCtx.effect(() => routeCtx.httpServer.register({
      kind: 'exact',
      path: PROMPT_STUDIO_STATE_PATH,
      handler: (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.writeHead(405)
          response.end()
          return
        }
        const body = JSON.stringify(catalog.snapshot())
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        response.end(request.method === 'HEAD' ? undefined : body)
      },
    }), 'prompt-studio: runtime catalog route')
  })
}

/** Register the live namespace and unified component pipeline. */
export async function apply(ctx: Context): Promise<void> {
  const scope: SettingsScope<StudioConfig> = ctx.settings.register(
    PROMPT_STUDIO_SETTINGS_NAMESPACE,
    studioConfigSchema,
    { applies: 'live' },
  )
  const bindings = new RuntimeBindings()
  const pipeline = new ComponentPipeline(ctx, bindings)
  const catalog = new RuntimeCatalogStore()
  const plans = new SupplementPlans()

  ctx.systemPrompt.variable('user_input', context => context.agent === undefined
    ? undefined
    : latestUserInput(context.agent))

  ctx.on('system-prompt/assemble', async (assembly, context: AssembleContext, next) => {
    const native = runtimeNative(assembly.sections, bindings.ownedSectionNames)
    const matchedOverrideIds = applyOverrides(assembly, bindings.overridesByMarker)
    const resolved = await next()
    catalog.commit(native, effectiveAssembly(resolved.sections))
    plans.prepare(context.agent, [...bindings.supplements.values()].filter(component => (
      !isNativeOverride(component) || matchedOverrideIds.has(component.id)
    )))
    return resolved
  }, { prepend: true })

  let refreshRequested = false
  let refreshTask: Promise<void> | undefined
  const requestRefresh = (): void => {
    refreshRequested = true
    if (refreshTask !== undefined) return
    refreshTask = (async () => {
      while (refreshRequested) {
        refreshRequested = false
        await ctx.systemPrompt.assemble()
      }
    })().catch((error: unknown) => {
      ctx.logger.warn('prompt-studio: runtime prompt discovery failed')
      ctx.logger.warn(error)
    }).finally(() => {
      refreshTask = undefined
      if (refreshRequested) requestRefresh()
    })
  }

  ctx.on('system-prompt/change', requestRefresh)
  ctx.on('llm/stream', (options, next) => rewriteRequest(ctx, plans, options, next))
  ctx.effect(() => () => { plans.clear() }, 'prompt-studio: supplementary request plans')
  installCatalogRoute(ctx, catalog)

  const initial = scope.get()
  validatePromptComponents(initial.components)
  pipeline.replace(initial.components)
  ctx.effect(() => scope.watch((next) => {
    validatePromptComponents(next.components)
    pipeline.replace(next.components)
  }), 'prompt-studio: settings component source')

  await ctx.systemPrompt.assemble()
}
