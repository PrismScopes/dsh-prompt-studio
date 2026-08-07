/** Host half of Prompt Studio: reversible component activation and request-local composition. */
import type { Context } from 'cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {
  ContentBlock,
  GenerateOptions,
  Message,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { SettingsNamespace, SettingsScope } from '@deepseek-ai/dsh-settings'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {
  AssembledSection,
  AssembleContext,
  PromptAssembly,
} from '@deepseek-ai/dsh-system-prompt'
import { studioConfigSchema } from './config.ts'
import { captureInjectedMessages, requestLayout } from './capture.ts'
import {
  CapturedResourceConflictError,
  CapturedResourceNotFoundError,
  loadCapturedResource,
  saveCapturedResource,
} from './resource.ts'
import {
  PROMPT_STUDIO_MESSAGE_SOURCE,
  PROMPT_STUDIO_NAMESPACE,
  PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX,
  PROMPT_STUDIO_RESOURCE_PATH,
  PROMPT_STUDIO_SETTINGS_PATH,
  PROMPT_STUDIO_STATE_PATH,
  isNativeOverride,
  renderSupplementBoundary,
  validatePromptComponents,
  type CapturedPromptComponent,
  type NativeOverride,
  type PromptComponent,
  type PromptStudioSettingsSnapshot,
  type RuntimePromptCatalog,
  type StudioConfig,
} from './shared.ts'

export {
  DEFAULT_SUPPLEMENT_ORDER,
  PROMPT_STUDIO_NAMESPACE,
  PROMPT_STUDIO_RESOURCE_PATH,
  PROMPT_STUDIO_SETTINGS_PATH,
  PROMPT_STUDIO_STATE_PATH,
  PROMPT_STUDIO_VIEW_ORDER,
  buildDraftSystemComponents,
  isNativeOverride,
  nextOverrideId,
  nextSupplementId,
  renderSystemPreview,
  renderSupplementBoundary,
  validatePromptComponents,
} from './shared.ts'
export type {
  CapturedContextResource,
  CapturedPromptComponent,
  CapturedResourceSnapshot,
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
export const inject = ['settings', 'systemPrompt', 'llm', 'sessions']

const SYSTEM_SECTION_PREFIX = 'prompt-studio:supplement-section:'

interface HttpRequestLike {
  method?: string
  url?: string
  on(event: 'data', listener: (chunk: Uint8Array | string) => void): this
  on(event: 'end', listener: () => void): this
  on(event: 'error', listener: (error: unknown) => void): this
}

interface HttpResponseLike {
  writeHead(status: number, headers?: Record<string, string>): unknown
  end(body?: string): void
}

interface HttpServerLike {
  register(route: {
    kind: 'exact'
    path: string
    handler: (request: HttpRequestLike, response: HttpResponseLike) => void | Promise<void>
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

function systemSectionName(id: string): string {
  return `${SYSTEM_SECTION_PREFIX}${id}`
}

function cloneComponent(component: PromptComponent): PromptComponent {
  return { ...component }
}

/** Live values contributed by currently active configuration effects. */
class RuntimeBindings {
  readonly ownedSectionNames = new Set<string>()
  readonly overridesByMarker = new Map<string, NativeOverride>()
  readonly systemBySection = new Map<string, PromptComponent>()
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
        if (snapshot.enabled && snapshot.role === 'system') {
          this.systemBySection.set(marker, snapshot)
        } else if (snapshot.enabled) {
          this.supplements.set(snapshot.id, snapshot)
        }
        yield () => {
          this.supplements.delete(snapshot.id)
          this.systemBySection.delete(marker)
          this.overridesByMarker.delete(marker)
          this.ownedSectionNames.delete(marker)
        }
        yield ctx.systemPrompt.section({
          name: marker,
          order: snapshot.order,
          text: snapshot.enabled && snapshot.role === 'system'
            ? renderSupplementBoundary(snapshot.id, snapshot.template)
            : '',
        })
      }.bind(this), `prompt-studio: override ${snapshot.origin}`)
    }
    if (!component.enabled) return ctx.effect(() => () => undefined, `prompt-studio: disabled ${component.id}`)
    const snapshot = cloneComponent(component)
    if (snapshot.role === 'system') {
      const sectionName = systemSectionName(snapshot.id)
      return ctx.effect(function* (this: RuntimeBindings) {
        this.ownedSectionNames.add(sectionName)
        this.systemBySection.set(sectionName, snapshot)
        yield () => {
          this.systemBySection.delete(sectionName)
          this.ownedSectionNames.delete(sectionName)
        }
        yield ctx.systemPrompt.section({
          name: sectionName,
          order: snapshot.order,
          text: renderSupplementBoundary(snapshot.id, snapshot.template),
        })
      }.bind(this), `prompt-studio: system supplement ${component.id}`)
    }
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
  const matchedMarkers = new Set<string>()
  const replacedTargets = new Set<string>()
  for (const [marker, override] of overridesByMarker) {
    if (!presentNames.has(marker) || !presentNames.has(override.origin)) continue
    matchedMarkers.add(marker)
    replacedTargets.add(override.origin)
    matchedOverrideIds.add(override.id)
  }
  assembly.sections = assembly.sections.flatMap((section) => {
    const override = overridesByMarker.get(section.name)
    if (override !== undefined) {
      return matchedMarkers.has(section.name) && override.enabled && override.role === 'system'
        ? [section]
        : []
    }
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
      role: 'system',
      order,
      enabled: true,
      template: section.text,
    }))
}

function effectiveAssembly(
  sections: readonly AssembledSection[],
  systemBySection: ReadonlyMap<string, PromptComponent>,
): PromptComponent[] {
  return sections.map((section, order) => {
    const supplement = systemBySection.get(section.name)
    if (supplement !== undefined) {
      const snapshot = { ...supplement, template: section.text }
      delete snapshot.position
      return snapshot
    }
    return {
      id: section.name,
      kind: 'native',
      role: 'system',
      order,
      enabled: true,
      template: section.text,
    }
  })
}

/** Latest value-level snapshot of the runtime registry. */
class RuntimeCatalogStore {
  private revision = 0
  private native: PromptComponent[] = []
  private assembled: PromptComponent[] = []
  private readonly requests = new Map<string, {
    captured: CapturedPromptComponent[]
    layout: RuntimePromptCatalog['layout']
  }>()
  private latestSessionId: string | undefined

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

  commitRequest(sessionId: string, messages: readonly Message[]): void {
    const next = {
      captured: captureInjectedMessages(messages),
      layout: requestLayout(messages),
    }
    const previous = this.requests.get(sessionId)
    this.latestSessionId = sessionId
    if (previous !== undefined && JSON.stringify(previous) === JSON.stringify(next)) return
    this.requests.set(sessionId, structuredClone(next))
    this.revision += 1
  }

  snapshot(requestedSessionId?: string): RuntimePromptCatalog {
    const sessionId = requestedSessionId ?? this.latestSessionId
    const request = sessionId === undefined ? undefined : this.requests.get(sessionId)
    return {
      revision: this.revision,
      native: this.native.map(cloneComponent),
      assembled: this.assembled.map(cloneComponent),
      ...sessionId === undefined ? {} : { sessionId },
      captured: request === undefined ? [] : structuredClone(request.captured),
      layout: request === undefined
        ? { messageCount: 0, userAnchor: null }
        : { ...request.layout },
    }
  }

  capturedResource(
    sessionId: string,
    componentId: string,
    resourceId: string,
  ): CapturedPromptComponent['resources'][number] | undefined {
    const component = this.requests.get(sessionId)?.captured.find(item => item.id === componentId)
    const resource = component?.resources.find(item => item.id === resourceId)
    return resource === undefined ? undefined : { ...resource }
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
  position: NonNullable<PromptComponent['position']>
  role: Exclude<PromptComponent['role'], 'system'>
  order: number
  text: string
  blockType: NonNullable<PromptComponent['blockType']>
  declaration: number
}

/** Request-owned supplementary plans materialized during the matching assembly. */
class SupplementPlans {
  private readonly bySession = new Map<string, PlannedSupplement[]>()

  prepare(agent: Agent | undefined, components: readonly PromptComponent[]): void {
    if (agent === undefined) return
    const plan = components.flatMap((component, declaration): PlannedSupplement[] => {
      if (component.role === 'system' || component.position === undefined) return []
      return [{
        id: component.id,
        position: component.position,
        role: component.role,
        order: component.order,
        text: renderComponentTemplate(component, agent),
        blockType: component.blockType ?? 'text',
        declaration,
      }]
    })
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

function supplementBlock(supplement: PlannedSupplement): ContentBlock {
  const text = renderSupplementBoundary(supplement.id, supplement.text)
  return Object.freeze(supplement.blockType === 'reasoning'
    ? { type: 'reasoning' as const, text }
    : { type: 'text' as const, text })
}

function supplementalMessage(supplement: PlannedSupplement): Message {
  return Object.freeze({
    id: crypto.randomUUID(),
    role: supplement.role,
    content: Object.freeze([supplementBlock(supplement)]),
    source: Object.freeze({ kind: 'plugin' as const, plugin: PROMPT_STUDIO_MESSAGE_SOURCE }),
  }) as Message
}

function supplementsAt(
  plan: readonly PlannedSupplement[],
  position: PlannedSupplement['position'],
): PlannedSupplement[] {
  return plan
    .filter(item => item.position === position)
    .sort((left, right) => left.order - right.order || left.declaration - right.declaration)
}

function mergeSupplementAfter(message: Message, supplement: PlannedSupplement): Message {
  const block = supplementBlock(supplement)
  const text = (block as { text?: string }).text ?? ''
  const withBoundary = block.type === 'reasoning'
    ? block
    : Object.freeze({ type: 'text' as const, text: `\n\n${text}` })
  return Object.freeze({
    ...message,
    content: Object.freeze([...message.content, withBoundary]),
  }) as Message
}

function supplementalGroups(plan: readonly PlannedSupplement[]): Message[] {
  const groups: Message[] = []
  for (const supplement of plan) {
    const previous = groups.at(-1)
    if (previous?.role === supplement.role) {
      groups[groups.length - 1] = mergeSupplementAfter(previous, supplement)
    } else {
      groups.push(supplementalMessage(supplement))
    }
  }
  return groups
}

function groupText(message: Message): string {
  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

function mergeGroup(
  native: Message,
  group: Message,
  placement: 'before' | 'after',
): Message {
  const text = groupText(group)
  const boundaryBlock = Object.freeze({
    type: 'text' as const,
    text: placement === 'before' ? `${text}\n\n` : `\n\n${text}`,
  })
  const content = placement === 'before'
    ? [boundaryBlock, ...native.content]
    : [...native.content, boundaryBlock]
  return Object.freeze({
    ...native,
    content: Object.freeze(content),
  }) as Message
}

function insertGap(
  leftMessages: readonly Message[],
  rightMessages: readonly Message[],
  supplements: readonly PlannedSupplement[],
): Message[] {
  const left = [...leftMessages]
  const right = [...rightMessages]
  const groups = supplementalGroups(supplements)
  const leftNeighbor = left.at(-1)
  const firstGroup = groups[0]
  if (leftNeighbor !== undefined && firstGroup?.role === leftNeighbor.role) {
    left[left.length - 1] = mergeGroup(leftNeighbor, firstGroup, 'after')
    groups.shift()
  }
  const rightNeighbor = right[0]
  const lastGroup = groups.at(-1)
  if (rightNeighbor !== undefined && lastGroup?.role === rightNeighbor.role) {
    right[0] = mergeGroup(rightNeighbor, lastGroup, 'before')
    groups.pop()
  }
  return [...left, ...groups, ...right]
}

function insertSupplements(
  nativeMessages: readonly Message[],
  plan: readonly PlannedSupplement[],
): Message[] {
  const afterSystem = supplementsAt(plan, 'after_system')
  const anchored = supplementsAt(plan, 'anchored')
  const tail = supplementsAt(plan, 'tail')
  let anchor = -1
  for (let index = nativeMessages.length - 1; index >= 0; index -= 1) {
    const message = nativeMessages[index]
    if (message?.role === 'user' && message.source.kind === 'user') {
      anchor = index
      break
    }
  }
  const anchoredMessages = anchor < 0
    ? [...nativeMessages]
    : insertGap(
        nativeMessages.slice(0, anchor + 1),
        nativeMessages.slice(anchor + 1),
        anchored,
      )
  const withAfterSystem = insertGap([], anchoredMessages, afterSystem)
  return insertGap(withAfterSystem, [], tail)
}

function rewriteRequest(
  ctx: Context,
  plans: SupplementPlans,
  catalog: RuntimeCatalogStore,
  options: GenerateOptions,
  next: () => AsyncIterable<StreamChunk>,
): AsyncIterable<StreamChunk> {
  const loopRequest = options.sessionId !== undefined
    && options.purpose === undefined
    && Object.isFrozen(options)
    && Object.isFrozen(options.messages)
  if (!loopRequest || options.sessionId === undefined) return next()
  catalog.commitRequest(String(options.sessionId), options.messages)
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

function respondJson(response: HttpResponseLike, status: number, value: unknown, head = false): void {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(head ? undefined : body)
}

function requestJson(request: HttpRequestLike): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder()
    let text = ''
    request.on('data', (chunk) => {
      text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
    })
    request.on('end', () => {
      try {
        text += decoder.decode()
        resolve(JSON.parse(text) as unknown)
      } catch (error: unknown) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function requestUrl(request: HttpRequestLike): URL {
  return new URL(request.url ?? '/', 'http://prompt-studio.local')
}

interface CapturedResourceSelection {
  sessionId: string
  componentId: string
  resourceId: string
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} 必须是非空字符串。`)
  return value
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new TypeError(`${name} 必须是字符串。`)
  return value
}

function resourceSelectionFromUrl(request: HttpRequestLike): CapturedResourceSelection {
  const params = requestUrl(request).searchParams
  return {
    sessionId: requiredString(params.get('sessionId'), 'sessionId'),
    componentId: requiredString(params.get('componentId'), 'componentId'),
    resourceId: requiredString(params.get('resourceId'), 'resourceId'),
  }
}

function resourceUpdate(value: unknown): CapturedResourceSelection & { content: string; expectedDigest: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('请求体必须是 JSON 对象。')
  }
  const record = value as Record<string, unknown>
  return {
    sessionId: requiredString(record['sessionId'], 'sessionId'),
    componentId: requiredString(record['componentId'], 'componentId'),
    resourceId: requiredString(record['resourceId'], 'resourceId'),
    content: requiredText(record['content'], 'content'),
    expectedDigest: requiredString(record['expectedDigest'], 'expectedDigest'),
  }
}

function selectedResource(
  ctx: Context,
  catalog: RuntimeCatalogStore,
  selection: CapturedResourceSelection,
): { cwd: string; resource: CapturedPromptComponent['resources'][number] } {
  const session = ctx.sessions.get(selection.sessionId as SessionId)
  if (session === undefined) {
    throw new CapturedResourceNotFoundError(`会话不存在：${selection.sessionId}`)
  }
  const resource = catalog.capturedResource(
    selection.sessionId,
    selection.componentId,
    selection.resourceId,
  )
  if (resource === undefined || !resource.editable) {
    throw new CapturedResourceNotFoundError('捕获项没有可编辑的文件资源。')
  }
  return { cwd: session.header.cwd ?? '.', resource }
}

function resourceErrorStatus(error: unknown): number {
  if (error instanceof TypeError) return 400
  if (error instanceof CapturedResourceNotFoundError) return 404
  if (error instanceof CapturedResourceConflictError) return 409
  return 500
}

function settingsSnapshot(ctx: Context): PromptStudioSettingsSnapshot {
  const descriptor = ctx.settings.describe().find(row => row.ns === PROMPT_STUDIO_SETTINGS_NAMESPACE)
  if (descriptor === undefined) throw new Error('prompt-studio settings namespace is not registered')
  const value = descriptor.value as StudioConfig
  return {
    writable: ctx.settings.writable,
    revision: descriptor.revision,
    value: { components: value.components.map(cloneComponent) },
  }
}

function settingsUpdate(value: unknown): { components: PromptComponent[]; expectedRevision: number } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('请求体必须是 JSON 对象。')
  }
  const record = value as Record<string, unknown>
  if (!Number.isSafeInteger(record['expectedRevision']) || (record['expectedRevision'] as number) < 0) {
    throw new TypeError('expectedRevision 必须是非负安全整数。')
  }
  if (!Array.isArray(record['components'])) throw new TypeError('components 必须是数组。')
  const components = structuredClone(record['components']) as PromptComponent[]
  validatePromptComponents(components)
  return { components, expectedRevision: record['expectedRevision'] as number }
}

function installRoutes(ctx: Context, catalog: RuntimeCatalogStore): void {
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
        const sessionId = requestUrl(request).searchParams.get('sessionId') ?? undefined
        respondJson(response, 200, catalog.snapshot(sessionId), request.method === 'HEAD')
      },
    }), 'prompt-studio: runtime catalog route')
    routeCtx.effect(() => routeCtx.httpServer.register({
      kind: 'exact',
      path: PROMPT_STUDIO_SETTINGS_PATH,
      handler: async (request, response) => {
        try {
          if (request.method === 'GET' || request.method === 'HEAD') {
            respondJson(response, 200, settingsSnapshot(routeCtx), request.method === 'HEAD')
            return
          }
          if (request.method === 'POST') {
            const update = settingsUpdate(await requestJson(request))
            await routeCtx.settings.replace(
              PROMPT_STUDIO_SETTINGS_NAMESPACE,
              { components: update.components },
              update.expectedRevision,
            )
            respondJson(response, 200, settingsSnapshot(routeCtx))
            return
          }
          response.writeHead(405)
          response.end()
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          respondJson(response, error instanceof TypeError ? 400 : 409, { error: message })
        }
      },
    }), 'prompt-studio: settings route')
    routeCtx.effect(() => routeCtx.httpServer.register({
      kind: 'exact',
      path: PROMPT_STUDIO_RESOURCE_PATH,
      handler: async (request, response) => {
        try {
          if (request.method === 'GET' || request.method === 'HEAD') {
            const selected = selectedResource(routeCtx, catalog, resourceSelectionFromUrl(request))
            const snapshot = await loadCapturedResource(selected.cwd, selected.resource)
            respondJson(response, 200, snapshot, request.method === 'HEAD')
            return
          }
          if (request.method === 'POST') {
            const update = resourceUpdate(await requestJson(request))
            const selected = selectedResource(routeCtx, catalog, update)
            const snapshot = await saveCapturedResource(
              selected.cwd,
              selected.resource,
              update.content,
              update.expectedDigest,
            )
            respondJson(response, 200, snapshot)
            return
          }
          response.writeHead(405)
          response.end()
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          respondJson(response, resourceErrorStatus(error), { error: message })
        }
      },
    }), 'prompt-studio: captured resource route')
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
    catalog.commit(native, effectiveAssembly(resolved.sections, bindings.systemBySection))
    plans.prepare(context.agent, [...bindings.supplements.values()].filter(component => (
      component.role !== 'system'
      && (!isNativeOverride(component) || matchedOverrideIds.has(component.id))
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
  ctx.on('llm/stream', (options, next) => rewriteRequest(ctx, plans, catalog, options, next))
  ctx.effect(() => () => { plans.clear() }, 'prompt-studio: supplementary request plans')
  installRoutes(ctx, catalog)

  const initial = scope.get()
  validatePromptComponents(initial.components)
  pipeline.replace(initial.components)
  ctx.effect(() => scope.watch((next) => {
    validatePromptComponents(next.components)
    pipeline.replace(next.components)
  }), 'prompt-studio: settings component source')

  await ctx.systemPrompt.assemble()
}
