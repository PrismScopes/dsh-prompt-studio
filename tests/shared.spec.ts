import { describe, expect, it } from 'vitest'
import {
  BUILTIN_SECTIONS,
  buildPreviewSections,
  nextSectionName,
  renderPreview,
  resolveBuiltinSections,
  validateBuiltinOverrides,
  validateStudioSections,
  type BuiltinSectionOverride,
  type StudioSection,
} from '../src/shared.ts'

const section = (overrides: Partial<StudioSection> = {}): StudioSection => ({
  name: 'user:instructions',
  order: 60,
  enabled: true,
  text: 'User instructions.',
  ...overrides,
})

const builtinOverride = (overrides: Partial<BuiltinSectionOverride> = {}): BuiltinSectionOverride => ({
  name: 'tool:grep',
  order: 104,
  enabled: true,
  text: 'Overridden grep guidance.',
  ...overrides,
})

describe('prompt-studio shared contract', () => {
  it('interleaves enabled user sections with stable built-in order', () => {
    const rows = buildPreviewSections([
      section({ name: 'user:before', order: -99.5, text: 'Before.' }),
      section({ name: 'user:disabled', order: -200, enabled: false }),
      section({ name: 'user:after', order: 300, text: 'After.' }),
    ])
    expect(rows[0]?.name).toBe('harness:identity')
    expect(rows[1]?.name).toBe('user:before')
    expect(rows.at(-1)?.name).toBe('user:after')
    expect(rows.some(row => row.name === 'user:disabled')).toBe(false)
  })

  it('renders the exact blank-line concatenation and drops empty text', () => {
    const builtins = BUILTIN_SECTIONS.map(row => row.text).filter(Boolean).join('\n\n')
    expect(renderPreview([
      section({ order: 300, text: 'Tail.' }),
      section({ name: 'user:empty', order: 301, text: '' }),
    ])).toBe(`${builtins}\n\nTail.`)
  })

  it('closes and replaces built-in rows before assembling the preview', () => {
    const rows = buildPreviewSections([], [
      builtinOverride({ enabled: false }),
      builtinOverride({ name: 'tool:read', order: 400, text: 'Read exactly this way.' }),
    ])
    expect(rows.some(row => row.name === 'tool:grep')).toBe(false)
    expect(rows.at(-1)).toMatchObject({
      name: 'tool:read',
      order: 400,
      text: 'Read exactly this way.',
      origin: 'builtin',
    })
    expect(renderPreview([], [builtinOverride({ enabled: false })]))
      .not.toContain('Use the grep tool')
  })

  it('resolves default, overridden, and closed built-in editor states', () => {
    const rows = resolveBuiltinSections([
      builtinOverride({ enabled: false }),
      builtinOverride({ name: 'tool:read', order: 7, text: 'Replacement.' }),
    ])
    expect(rows.find(row => row.name === 'harness:identity')).toMatchObject({
      enabled: true,
      overridden: false,
    })
    expect(rows.find(row => row.name === 'tool:grep')).toMatchObject({
      enabled: false,
      overridden: true,
    })
    expect(rows.find(row => row.name === 'tool:read')).toMatchObject({
      enabled: true,
      overridden: true,
      order: 7,
      text: 'Replacement.',
    })
  })

  it('rejects duplicate, reserved, malformed, and non-finite user rows', () => {
    expect(() => { validateStudioSections([section(), section()]) }).toThrow('listed more than once')
    expect(() => { validateStudioSections([section({ name: 'deployment:persona' })]) }).toThrow('built in')
    expect(() => { validateStudioSections([section({ name: 'prompt-studio:override-marker:tool:grep' })]) })
      .toThrow('reserved by Prompt Studio')
    expect(() => { validateStudioSections([section({ name: ' user:space' })]) }).toThrow('surrounding whitespace')
    expect(() => { validateStudioSections([section({ order: Number.NaN })]) }).toThrow('finite number')
  })

  it('accepts only one finite override for each shipped built-in', () => {
    expect(() => { validateBuiltinOverrides([builtinOverride(), builtinOverride()]) })
      .toThrow('listed more than once')
    expect(() => { validateBuiltinOverrides([builtinOverride({ name: 'user:not-built-in' })]) })
      .toThrow('is not a built-in prompt section')
    expect(() => { validateBuiltinOverrides([builtinOverride({ order: Number.POSITIVE_INFINITY })]) })
      .toThrow('finite number')
    expect(() => { validateBuiltinOverrides([builtinOverride()]) }).not.toThrow()
  })

  it('allocates readable names without colliding with the draft', () => {
    expect(nextSectionName([])).toBe('user:section')
    expect(nextSectionName([
      section({ name: 'user:section' }),
      section({ name: 'user:section-2' }),
    ])).toBe('user:section-3')
  })
})
