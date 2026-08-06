/** Unified prompt-component editor and request-layout preview. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import {
  DEFAULT_SUPPLEMENT_ORDER,
  buildDraftSystemComponents,
  isNativeOverride,
  nextOverrideId,
  nextSupplementId,
  renderSupplementBoundary,
  renderSystemPreview,
  type PromptComponent,
  type PromptComponentKind,
  type PromptComponentPosition,
  type PromptComponentRole,
} from '../shared.ts'
import type { PromptStudioState, PromptStudioStore } from './store.ts'
import styles from './PromptStudioView.module.css'

/** Business face supplied by the slot registration. */
export interface PromptStudioViewInjected {
  controller: PromptStudioStore
  useSnapshot: SnapshotSelectorHook<PromptStudioState>
}

/** Full conversation-view props after the injected face is composed. */
export type PromptStudioViewProps = ConvViewProps & InjectFace<PromptStudioViewInjected>

interface DisplayRow {
  component: PromptComponent
  configuredIndex: number | null
}

const POSITION_ORDER: Record<PromptComponentPosition, number> = {
  after_system: 0,
  anchored: 1,
  tail: 2,
}

const KIND_LABEL: Record<PromptComponentKind, string> = {
  native: '原生',
  supplement: '补充',
}

const POSITION_LABEL: Record<PromptComponentPosition, string> = {
  after_system: '系统后',
  anchored: '最后用户输入后',
  tail: '请求尾部',
}

const ROLE_LABEL: Record<PromptComponentRole, string> = {
  system: 'system',
  user: 'user',
  assistant: 'assistant',
}

function copyComponents(components: readonly PromptComponent[]): PromptComponent[] {
  return components.map(component => ({ ...component }))
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function compareRows(left: DisplayRow, right: DisplayRow): number {
  const leftPlacement = left.component.role === 'system'
    ? -1
    : POSITION_ORDER[left.component.position ?? 'tail']
  const rightPlacement = right.component.role === 'system'
    ? -1
    : POSITION_ORDER[right.component.position ?? 'tail']
  return leftPlacement - rightPlacement
    || left.component.order - right.component.order
}

function previewText(systemText: string, supplements: readonly PromptComponent[]): string {
  const blocks: string[] = []
  if (systemText.length > 0) blocks.push(systemText)
  const sortedSupplements = supplements
    .map((component, declaration) => ({ component, declaration }))
    .sort((left, right) => POSITION_ORDER[left.component.position ?? 'tail'] - POSITION_ORDER[right.component.position ?? 'tail']
      || left.component.order - right.component.order
      || left.declaration - right.declaration)
  for (const { component } of sortedSupplements) {
    blocks.push(renderSupplementBoundary(component.id, component.template))
  }
  return blocks.join('\n\n')
}

/** Conversation-view entry point. */
export function PromptStudioView({ controller, useSnapshot }: PromptStudioViewProps): ReactNode {
  const remote = useSnapshot(state => state)

  useEffect(() => {
    if (remote.status === 'idle') void controller.load()
  }, [controller, remote.status])

  if (remote.status === 'idle' || (remote.status === 'loading' && remote.native.length === 0)) {
    return <div className={styles['status']}>正在载入 Prompt Studio…</div>
  }
  if (remote.status === 'error') {
    return (
      <div className={styles['status']}>
        <p className={styles['error']}>{remote.error}</p>
        <button type="button" className={styles['secondaryButton']} onClick={() => { void controller.load() }}>
          重试
        </button>
      </div>
    )
  }
  return <PromptStudioEditor controller={controller} remote={remote} />
}

function PromptStudioEditor({
  controller,
  remote,
}: {
  controller: PromptStudioStore
  remote: PromptStudioState
}): ReactNode {
  const [draft, setDraft] = useState<PromptComponent[]>(() => copyComponents(remote.components))
  const [dirty, setDirty] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(copyComponents(remote.components))
    setDirty(false)
    setSaving(false)
    setSaveError(null)
    setEditingIndex(index => index !== null && index < remote.components.length ? index : null)
  }, [remote.catalogRevision, remote.components, remote.revision])

  const rows = useMemo<DisplayRow[]>(() => [
    ...remote.native.map(component => ({ component, configuredIndex: null })),
    ...draft.map((component, configuredIndex) => ({ component, configuredIndex })),
  ].sort(compareRows), [draft, remote.native])

  const draftSystem = useMemo(
    () => dirty ? buildDraftSystemComponents(remote.native, draft) : copyComponents(remote.assembled),
    [dirty, draft, remote.assembled, remote.native],
  )
  const requestSupplements = useMemo(() => {
    const nativeIds = new Set(remote.native.map(component => component.id))
    return draft.filter(component => component.enabled
      && component.role !== 'system'
      && (!isNativeOverride(component) || nativeIds.has(component.origin)))
  }, [draft, remote.native])
  const orderedRequestSupplements = useMemo(() => requestSupplements
    .map((component, declaration) => ({ component, declaration }))
    .sort((left, right) => POSITION_ORDER[left.component.position ?? 'tail'] - POSITION_ORDER[right.component.position ?? 'tail']
      || left.component.order - right.component.order
      || left.declaration - right.declaration)
    .map(entry => entry.component), [requestSupplements])
  const systemContent = useMemo(() => renderSystemPreview(draftSystem), [draftSystem])
  const preview = useMemo(
    () => previewText(systemContent, orderedRequestSupplements),
    [orderedRequestSupplements, systemContent],
  )

  const changeComponent = (index: number, patch: Partial<PromptComponent>): void => {
    setDraft(current => current.map((component, position) => position === index
      ? { ...component, ...patch }
      : component))
    setDirty(true)
    setSaveError(null)
  }

  const changeOrigin = (index: number, origin: string): void => {
    setDraft(current => current.map((component, position) => {
      if (position !== index) return component
      const next = { ...component }
      if (origin.length === 0) delete next.origin
      else next.origin = origin
      return next
    }))
    setDirty(true)
    setSaveError(null)
  }

  const changeRole = (index: number, role: PromptComponentRole): void => {
    setDraft(current => current.map((component, position) => {
      if (position !== index) return component
      const next: PromptComponent = { ...component, role }
      if (role === 'system') delete next.position
      else next.position ??= 'after_system'
      return next
    }))
    setDirty(true)
    setSaveError(null)
  }

  const addSupplement = (): void => {
    setDraft((current) => {
      const next = [...current, {
        id: nextSupplementId(current),
        kind: 'supplement' as const,
        position: 'tail' as const,
        role: 'user' as const,
        order: DEFAULT_SUPPLEMENT_ORDER,
        enabled: true,
        template: '',
      }]
      setEditingIndex(next.length - 1)
      return next
    })
    setDirty(true)
    setSaveError(null)
  }

  const addOverride = (native: PromptComponent): void => {
    const existing = draft.findIndex(component => isNativeOverride(component) && component.origin === native.id)
    if (existing >= 0) {
      setEditingIndex(existing)
      return
    }
    setDraft((current) => {
      const next = [...current, {
        id: nextOverrideId(current, native.id),
        kind: 'supplement' as const,
        role: 'system' as const,
        order: native.order,
        enabled: true,
        template: native.template,
        origin: native.id,
      }]
      setEditingIndex(next.length - 1)
      return next
    })
    setDirty(true)
    setSaveError(null)
  }

  const removeComponent = (index: number): void => {
    setDraft(current => current.filter((_component, position) => position !== index))
    setEditingIndex((current) => {
      if (current === null || current === index) return null
      return current > index ? current - 1 : current
    })
    setDirty(true)
    setSaveError(null)
  }

  const save = (): void => {
    if (!dirty || saving || !remote.writable) return
    setSaving(true)
    setSaveError(null)
    void controller.save(draft, remote.revision)
      .catch((error: unknown) => { setSaveError(messageOf(error)) })
      .finally(() => { setSaving(false) })
  }

  return (
    <div className={styles['root']}>
      <div className={styles['pageHeader']}>
        <div>
          <h1 className={styles['title']}>Prompt Studio</h1>
          <p className={styles['intro']}>
            角色决定内容归宿；system 合并进唯一系统区，user/assistant 再由位置决定消息间隙。
          </p>
        </div>
        <div className={styles['headerActions']}>
          <button type="button" className={styles['secondaryButton']} disabled={!remote.writable} onClick={addSupplement}>
            新增补充
          </button>
          <button
            type="button"
            className={styles['primaryButton']}
            disabled={!dirty || saving || !remote.writable}
            onClick={save}
          >
            {saving ? '正在保存…' : '保存更改'}
          </button>
        </div>
      </div>

      {!remote.writable ? <p className={styles['notice']}>当前设置提供方为只读。</p> : null}
      {remote.status === 'loading' ? <p className={styles['notice']}>正在刷新运行时组件…</p> : null}
      {saveError !== null ? <p className={styles['error']}>{saveError}</p> : null}

      <div className={styles['columns']}>
        <section className={styles['editorColumn']} aria-label="统一提示词组件">
          <div className={styles['sectionHeading']}>
            <div>
              <h2 className={styles['subtitle']}>组件</h2>
              <p className={styles['caption']}>原生组件来自运行时组装快照；补充组件保存后由统一效果管线撤销并重施加。</p>
            </div>
            <span className={styles['count']}>{String(rows.length)}</span>
          </div>

          <ol className={styles['componentList']}>
            {rows.map(({ component, configuredIndex }) => {
              const isNative = configuredIndex === null
              const editing = configuredIndex !== null && editingIndex === configuredIndex
              const override = isNativeOverride(component)
              const overrideExists = isNative && draft.some(item => isNativeOverride(item) && item.origin === component.id)
              return (
                <li key={`${component.kind}:${component.id}:${String(configuredIndex)}`} className={styles['componentCard']}>
                  <div className={styles['rowHeader']}>
                    {isNative
                      ? <span className={styles['stateBadge']}>运行时</span>
                      : (
                        <label className={styles['enabledControl']}>
                          <input
                            type="checkbox"
                            checked={component.enabled}
                            disabled={!remote.writable}
                            onChange={(event) => { changeComponent(configuredIndex, { enabled: event.target.checked }) }}
                          />
                          <span>{component.enabled ? '启用' : override ? '关闭原生' : '停用'}</span>
                        </label>
                      )}
                    <span className={styles['kindBadge']}>{KIND_LABEL[component.kind]}</span>
                    <span className={styles['sectionName']}>{component.id}</span>
                    {component.position === undefined
                      ? null
                      : <span className={styles['positionBadge']}>{POSITION_LABEL[component.position]}</span>}
                    <span className={styles['roleBadge']}>{component.role}</span>
                    <span className={styles['orderBadge']}>
                      {component.role === 'system' ? '层级' : '间隙内顺序'} {String(component.order)}
                    </span>
                    {isNative
                      ? (
                        <button
                          type="button"
                          className={styles['textButton']}
                          disabled={!remote.writable}
                          onClick={() => { addOverride(component) }}
                        >
                          {overrideExists ? '编辑覆盖' : '创建覆盖'}
                        </button>
                      )
                      : (
                        <>
                          <button
                            type="button"
                            className={styles['textButton']}
                            onClick={() => { setEditingIndex(editing ? null : configuredIndex) }}
                          >
                            {editing ? '收起' : '编辑'}
                          </button>
                          <button
                            type="button"
                            className={styles['dangerButton']}
                            disabled={!remote.writable}
                            onClick={() => { removeComponent(configuredIndex) }}
                          >
                            {override ? '恢复原生' : '删除'}
                          </button>
                        </>
                      )}
                  </div>

                  {component.origin !== undefined
                    ? <p className={styles['origin']}>覆盖目标：{component.origin}</p>
                    : null}

                  {editing && configuredIndex !== null
                    ? (
                      <div className={styles['componentEditor']}>
                        <label className={styles['field']}>
                          <span className={styles['fieldLabel']}>标识</span>
                          <input
                            className={styles['input']}
                            value={component.id}
                            disabled={!remote.writable}
                            onChange={(event) => { changeComponent(configuredIndex, { id: event.target.value }) }}
                          />
                        </label>
                        <label className={styles['field']}>
                          <span className={styles['fieldLabel']}>
                            {component.role === 'system' ? '系统层级' : '间隙内顺序'}
                          </span>
                          <input
                            className={styles['orderInput']}
                            type="number"
                            value={component.order}
                            disabled={!remote.writable}
                            onChange={(event) => { changeComponent(configuredIndex, { order: Number(event.target.value) }) }}
                          />
                        </label>
                        {component.role === 'system'
                          ? null
                          : (
                            <label className={styles['field']}>
                              <span className={styles['fieldLabel']}>消息间隙</span>
                              <select
                                className={styles['select']}
                                value={component.position}
                                disabled={!remote.writable}
                                onChange={(event) => { changeComponent(configuredIndex, { position: event.target.value as PromptComponentPosition }) }}
                              >
                                {Object.entries(POSITION_LABEL).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </label>
                          )}
                        <label className={styles['field']}>
                          <span className={styles['fieldLabel']}>角色</span>
                          <select
                            className={styles['select']}
                            value={component.role}
                            disabled={!remote.writable}
                            onChange={(event) => { changeRole(configuredIndex, event.target.value as PromptComponentRole) }}
                          >
                            {Object.entries(ROLE_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className={styles['field']}>
                          <span className={styles['fieldLabel']}>覆盖目标</span>
                          <select
                            className={styles['select']}
                            value={component.origin ?? ''}
                            disabled={!remote.writable}
                            onChange={(event) => { changeOrigin(configuredIndex, event.target.value) }}
                          >
                            <option value="">不覆盖原生</option>
                            {remote.native.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
                          </select>
                        </label>
                        <label className={`${styles['field']} ${styles['templateField']}`}>
                          <span className={styles['fieldLabel']}>模板</span>
                          <textarea
                            className={styles['textarea']}
                            value={component.template}
                            disabled={!remote.writable}
                            rows={8}
                            onChange={(event) => { changeComponent(configuredIndex, { template: event.target.value }) }}
                          />
                        </label>
                      </div>
                    )
                    : <p className={styles['excerpt']}>{component.template || '（空模板）'}</p>}
                </li>
              )
            })}
          </ol>
        </section>

        <section className={styles['previewColumn']} aria-label="完整请求预览">
          <div className={styles['sectionHeading']}>
            <div>
              <h2 className={styles['subtitle']}>完整预览</h2>
              <p className={styles['caption']}>
                下方仅显示模型可见内容，不加入位置、角色或标识标签；模板变量在每次组装时读取当前会话。
              </p>
            </div>
            <span className={styles['count']}>
              {String((systemContent.length > 0 ? 1 : 0) + orderedRequestSupplements.length)} 段
            </span>
          </div>
          <div className={styles['assemblyOrder']}>
            {systemContent.length > 0
              ? (
                <span className={styles['assemblyRow']}>
                  <span className={styles['assemblyIndex']}>1</span>
                  <span>system</span>
                  <span className={styles['assemblyOrderValue']}>{String(draftSystem.length)} 个 section 合并</span>
                </span>
              )
              : null}
            {orderedRequestSupplements.map((component, index) => (
              <span key={`supplement:${component.id}`} className={styles['assemblyRow']}>
                <span className={styles['assemblyIndex']}>
                  {String(index + (systemContent.length > 0 ? 2 : 1))}
                </span>
                <span>{component.role}</span>
                <span className={styles['assemblyOrderValue']}>
                  {component.position === undefined ? '' : POSITION_LABEL[component.position]}
                </span>
              </span>
            ))}
          </div>
          <pre className={styles['preview']}>{preview}</pre>
        </section>
      </div>
    </div>
  )
}
