/** Interactive prompt-section editor and exact template concatenation preview. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import {
  BUILTIN_SECTIONS,
  DEFAULT_USER_SECTION_ORDER,
  buildPreviewSections,
  nextSectionName,
  renderPreview,
  resolveBuiltinSections,
  type BuiltinSection,
  type BuiltinSectionOverride,
  type StudioConfig,
  type StudioSection,
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

function copyConfig(state: Pick<PromptStudioState, 'sections' | 'overrides'>): StudioConfig {
  return {
    sections: state.sections.map(section => ({ ...section })),
    overrides: state.overrides.map(override => ({ ...override })),
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function defaultBuiltin(name: string): BuiltinSection {
  const section = BUILTIN_SECTIONS.find(candidate => candidate.name === name)
  if (section === undefined) throw new Error(`unknown built-in prompt section "${name}"`)
  return section
}

function isDefaultOverride(override: BuiltinSectionOverride, section: BuiltinSection): boolean {
  return override.enabled && override.order === section.order && override.text === section.text
}

function replaceBuiltinOverride(
  overrides: readonly BuiltinSectionOverride[],
  name: string,
  patch: Partial<Omit<BuiltinSectionOverride, 'name'>>,
): BuiltinSectionOverride[] {
  const shipped = defaultBuiltin(name)
  const current = overrides.find(override => override.name === name) ?? {
    name,
    order: shipped.order,
    enabled: true,
    text: shipped.text,
  }
  const replacement = { ...current, ...patch }
  if (isDefaultOverride(replacement, shipped)) {
    return overrides.filter(override => override.name !== name)
  }
  if (overrides.some(override => override.name === name)) {
    return overrides.map(override => override.name === name ? replacement : override)
  }
  return [...overrides, replacement]
}

/** Conversation-view entry point. */
export function PromptStudioView({ controller, useSnapshot }: PromptStudioViewProps): ReactNode {
  const remote = useSnapshot(state => state)

  useEffect(() => {
    if (remote.status === 'idle') void controller.load()
  }, [controller, remote.status])

  if (remote.status === 'idle' || (remote.status === 'loading' && remote.sections.length === 0)) {
    return <div className={styles['status']}>Loading Prompt Studio…</div>
  }
  if (remote.status === 'error') {
    return (
      <div className={styles['status']}>
        <p className={styles['error']}>{remote.error}</p>
        <button type="button" className={styles['secondaryButton']} onClick={() => { void controller.load() }}>
          Retry
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
  const [draft, setDraft] = useState<StudioConfig>(() => copyConfig(remote))
  const [dirty, setDirty] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingBuiltin, setEditingBuiltin] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(copyConfig(remote))
    setDirty(false)
    setSaving(false)
    setSaveError(null)
    setEditingIndex(index => index !== null && index < remote.sections.length ? index : null)
    setEditingBuiltin(null)
  }, [remote.overrides, remote.revision, remote.sections])

  const builtins = useMemo(() => resolveBuiltinSections(draft.overrides), [draft.overrides])
  const previewRows = useMemo(
    () => buildPreviewSections(draft.sections, draft.overrides),
    [draft.overrides, draft.sections],
  )
  const preview = useMemo(
    () => renderPreview(draft.sections, draft.overrides),
    [draft.overrides, draft.sections],
  )

  const changeSection = (index: number, patch: Partial<StudioSection>): void => {
    setDraft(current => ({
      ...current,
      sections: current.sections.map((section, position) => position === index
        ? { ...section, ...patch }
        : section),
    }))
    setDirty(true)
    setSaveError(null)
  }

  const addSection = (): void => {
    setDraft((current) => {
      const sections = [...current.sections, {
        name: nextSectionName(current.sections),
        order: DEFAULT_USER_SECTION_ORDER,
        enabled: true,
        text: '',
      }]
      setEditingIndex(sections.length - 1)
      return { ...current, sections }
    })
    setDirty(true)
    setSaveError(null)
  }

  const removeSection = (index: number): void => {
    setDraft(current => ({
      ...current,
      sections: current.sections.filter((_section, position) => position !== index),
    }))
    setEditingIndex((current) => {
      if (current === null) return null
      if (current === index) return null
      return current > index ? current - 1 : current
    })
    setDirty(true)
    setSaveError(null)
  }

  const changeBuiltin = (
    name: string,
    patch: Partial<Omit<BuiltinSectionOverride, 'name'>>,
  ): void => {
    setDraft(current => ({
      ...current,
      overrides: replaceBuiltinOverride(current.overrides, name, patch),
    }))
    setDirty(true)
    setSaveError(null)
  }

  const restoreBuiltin = (name: string): void => {
    setDraft(current => ({
      ...current,
      overrides: current.overrides.filter(override => override.name !== name),
    }))
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
            Edit shipped and deployment sections, choose their assembly order, and inspect the complete prompt template before variables are resolved.
          </p>
        </div>
        <div className={styles['headerActions']}>
          <button type="button" className={styles['secondaryButton']} disabled={!remote.writable} onClick={addSection}>
            Add section
          </button>
          <button
            type="button"
            className={styles['primaryButton']}
            disabled={!dirty || saving || !remote.writable}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {!remote.writable ? <p className={styles['notice']}>The active settings provider is read-only.</p> : null}
      {remote.status === 'loading' ? <p className={styles['notice']}>Refreshing settings…</p> : null}
      {saveError !== null ? <p className={styles['error']}>{saveError}</p> : null}

      <div className={styles['columns']}>
        <section className={styles['editorColumn']} aria-label="Prompt sections">
          <div className={styles['sectionHeading']}>
            <div>
              <h2 className={styles['subtitle']}>User sections</h2>
              <p className={styles['caption']}>Enabled rows are registered immediately after a successful save.</p>
            </div>
            <span className={styles['count']}>{String(draft.sections.length)}</span>
          </div>

          {draft.sections.length === 0
            ? <p className={styles['empty']}>No user sections.</p>
            : (
              <ol className={styles['userList']}>
                {draft.sections.map((section, index) => (
                  <li key={`${String(index)}:${section.name}`} className={styles['userCard']}>
                    <div className={styles['rowHeader']}>
                      <label className={styles['enabledControl']}>
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          disabled={!remote.writable}
                          onChange={(event) => { changeSection(index, { enabled: event.target.checked }) }}
                        />
                        <span>{section.enabled ? 'Enabled' : 'Disabled'}</span>
                      </label>
                      <span className={styles['sectionName']}>{section.name || '(unnamed section)'}</span>
                      <span className={styles['orderBadge']}>Order {String(section.order)}</span>
                      <button
                        type="button"
                        className={styles['textButton']}
                        onClick={() => { setEditingIndex(editingIndex === index ? null : index) }}
                      >
                        {editingIndex === index ? 'Close' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        className={styles['dangerButton']}
                        disabled={!remote.writable}
                        onClick={() => { removeSection(index) }}
                      >
                        Remove
                      </button>
                    </div>

                    {editingIndex === index
                      ? (
                        <div className={styles['sectionEditor']}>
                          <label className={styles['field']}>
                            <span className={styles['fieldLabel']}>Name</span>
                            <input
                              className={styles['input']}
                              value={section.name}
                              disabled={!remote.writable}
                              onChange={(event) => { changeSection(index, { name: event.target.value }) }}
                            />
                          </label>
                          <label className={styles['field']}>
                            <span className={styles['fieldLabel']}>Order</span>
                            <input
                              className={styles['orderInput']}
                              type="number"
                              value={section.order}
                              disabled={!remote.writable}
                              onChange={(event) => { changeSection(index, { order: Number(event.target.value) }) }}
                            />
                          </label>
                          <label className={`${styles['field']} ${styles['textField']}`}>
                            <span className={styles['fieldLabel']}>Section text</span>
                            <textarea
                              className={styles['textarea']}
                              value={section.text}
                              disabled={!remote.writable}
                              rows={8}
                              onChange={(event) => { changeSection(index, { text: event.target.value }) }}
                            />
                          </label>
                        </div>
                      )
                      : section.text.length > 0
                        ? <p className={styles['excerpt']}>{section.text}</p>
                        : <p className={styles['emptyText']}>Empty text contributes nothing to the rendered prompt.</p>}
                  </li>
                ))}
              </ol>
            )}

          <details className={styles['builtins']}>
            <summary className={styles['builtinsSummary']}>
              Built-in sections <span className={styles['count']}>{String(BUILTIN_SECTIONS.length)}</span>
            </summary>
            <ol className={styles['builtinList']}>
              {builtins.map(section => (
                <li
                  key={section.name}
                  className={styles['builtinCard']}
                  aria-label={`Built-in section ${section.name}`}
                >
                  <div className={styles['rowHeader']}>
                    <label className={styles['enabledControl']}>
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        disabled={!remote.writable}
                        onChange={(event) => { changeBuiltin(section.name, { enabled: event.target.checked }) }}
                      />
                      <span>{section.enabled ? 'On' : 'Off'}</span>
                    </label>
                    <span className={styles['sectionName']}>{section.name}</span>
                    <span className={styles['stateBadge']}>
                      {section.enabled ? section.overridden ? 'Overridden' : 'Default' : 'Closed'}
                    </span>
                    <span className={styles['orderBadge']}>Order {String(section.order)}</span>
                    <button
                      type="button"
                      className={styles['textButton']}
                      onClick={() => { setEditingBuiltin(editingBuiltin === section.name ? null : section.name) }}
                    >
                      {editingBuiltin === section.name ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className={styles['textButton']}
                      disabled={!remote.writable || !section.overridden}
                      onClick={() => { restoreBuiltin(section.name) }}
                    >
                      Restore default
                    </button>
                  </div>
                  <p className={styles['origin']}>{section.origin}</p>
                  {editingBuiltin === section.name
                    ? (
                      <div className={styles['sectionEditor']}>
                        <label className={styles['field']}>
                          <span className={styles['fieldLabel']}>Order</span>
                          <input
                            className={styles['orderInput']}
                            type="number"
                            value={section.order}
                            disabled={!remote.writable}
                            onChange={(event) => { changeBuiltin(section.name, { order: Number(event.target.value) }) }}
                          />
                        </label>
                        <label className={`${styles['field']} ${styles['builtinTextField']}`}>
                          <span className={styles['fieldLabel']}>Section text</span>
                          <textarea
                            className={styles['textarea']}
                            value={section.text}
                            disabled={!remote.writable}
                            rows={8}
                            onChange={(event) => { changeBuiltin(section.name, { text: event.target.value }) }}
                          />
                        </label>
                      </div>
                    )
                    : <p className={styles['builtinText']}>{section.text}</p>}
                </li>
              ))}
            </ol>
          </details>
        </section>

        <section className={styles['previewColumn']} aria-label="Complete prompt preview">
          <div className={styles['sectionHeading']}>
            <div>
              <h2 className={styles['subtitle']}>Complete preview</h2>
              <p className={styles['caption']}>Raw template; variables such as {'{{model}}'} and {'{{cwd}}'} resolve per request.</p>
            </div>
            <span className={styles['count']}>{String(previewRows.length)} sections</span>
          </div>
          <div className={styles['assemblyOrder']}>
            {previewRows.map((section, index) => (
              <span key={`${section.origin}:${section.name}`} className={styles['assemblyRow']}>
                <span className={styles['assemblyIndex']}>{String(index + 1)}</span>
                <span>{section.name}</span>
                <span className={styles['assemblyOrderValue']}>{String(section.order)}</span>
              </span>
            ))}
          </div>
          <pre className={styles['preview']}>{preview}</pre>
        </section>
      </div>
    </div>
  )
}
