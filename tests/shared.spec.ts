import { describe, expect, it } from 'vitest'
import {
  buildDraftSystemComponents,
  nextOverrideId,
  nextSupplementId,
  renderSupplementBoundary,
  renderSystemPreview,
  validatePromptComponents,
  type PromptComponent,
} from '../src/shared.ts'

const native = (id: string, order: number, template: string): PromptComponent => ({
  id, kind: 'native', role: 'system', order, enabled: true, template,
})

const supplement = (overrides: Partial<PromptComponent> = {}): PromptComponent => ({
  id: 'supplement:message',
  kind: 'supplement',
  role: 'user',
  position: 'tail',
  order: 100,
  enabled: true,
  template: 'Extra.',
  ...overrides,
})

describe('prompt-studio shared contract', () => {
  it('resolves system overrides and supplements without persisting native rows', () => {
    const rows = buildDraftSystemComponents([
      native('identity', -100, 'Identity.'),
      native('persona', 0, 'Persona.'),
    ], [
      supplement({ id: 'override:persona', role: 'system', position: undefined, order: 20, origin: 'persona', template: 'Changed.' }),
      supplement({ id: 'supplement:system', role: 'system', position: undefined, order: 10, template: 'Middle.' }),
    ])
    expect(rows.map(row => row.id)).toEqual(['identity', 'supplement:system', 'override:persona'])
    expect(renderSystemPreview(rows)).toBe('Identity.\n\nMiddle.\n\nChanged.')
  })

  it('validates role/position, runtime provenance, block type, and unique override targets', () => {
    expect(() => { validatePromptComponents([supplement({ position: undefined })]) }).toThrow('invalid position')
    expect(() => { validatePromptComponents([supplement({ blockType: 'reasoning' })]) }).toThrow('assistant')
    expect(() => { validatePromptComponents([native('n', 0, 'N')]) }).toThrow('cannot be persisted')
    expect(() => {
      validatePromptComponents([
        supplement({ id: 'one', role: 'system', position: undefined, origin: 'persona' }),
        supplement({ id: 'two', role: 'system', position: undefined, origin: 'persona' }),
      ])
    }).toThrow('overridden more than once')
  })

  it('renders supplements as plain content without wrapper markup', () => {
    expect(renderSupplementBoundary('a"<&', 'Body.')).toBe('Body.')
  })

  it('allocates readable supplement and override ids', () => {
    const rows = [supplement(), supplement({ id: 'supplement:message-2' })]
    expect(nextSupplementId(rows)).toBe('supplement:message-3')
    expect(nextOverrideId(rows, 'persona')).toBe('override:persona')
  })
})
