// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PromptStudioView, type PromptStudioViewProps } from '../src/client/PromptStudioView.tsx'
import type { PromptStudioState, PromptStudioStore } from '../src/client/store.ts'

afterEach(cleanup)

function renderStudio() {
  const remote: PromptStudioState = {
    status: 'ready',
    error: null,
    writable: true,
    revision: 7,
    sections: [],
    overrides: [],
  }
  const controller = {
    load: vi.fn(() => Promise.resolve()),
    save: vi.fn(() => Promise.resolve()),
  } as unknown as PromptStudioStore
  const useSnapshot = (<T,>(selector: (state: PromptStudioState) => T): T => selector(remote))
  render(<PromptStudioView {...({ controller, useSnapshot } as unknown as PromptStudioViewProps)} />)
  return { controller }
}

function builtinCard(name: string): HTMLElement {
  return screen.getByLabelText(`Built-in section ${name}`)
}

function previewText(): string {
  return screen.getByLabelText('Complete prompt preview').querySelector('pre')?.textContent ?? ''
}

describe('PromptStudioView built-in overrides', () => {
  it('closes a built-in, marks it, and removes it from the complete preview', () => {
    renderStudio()
    const card = builtinCard('tool:grep')
    expect(previewText()).toContain('Use the grep tool')
    fireEvent.click(within(card).getByRole('checkbox'))
    expect(within(card).getByText('Closed')).toBeTruthy()
    expect(previewText()).not.toContain('Use the grep tool')
  })

  it('edits and restores a built-in override, then saves both settings arrays', async () => {
    const { controller } = renderStudio()
    const card = builtinCard('tool:grep')
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(card).getByLabelText('Order'), { target: { value: '12' } })
    fireEvent.change(within(card).getByLabelText('Section text'), { target: { value: 'Custom grep text.' } })
    expect(within(card).getByText('Overridden')).toBeTruthy()
    expect(previewText()).toContain('Custom grep text.')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      expect(controller.save).toHaveBeenCalledWith({
        sections: [],
        overrides: [{
          name: 'tool:grep',
          order: 12,
          enabled: true,
          text: 'Custom grep text.',
        }],
      }, 7)
    })

    fireEvent.click(within(card).getByRole('button', { name: 'Restore default' }))
    expect(within(card).getByText('Default')).toBeTruthy()
    expect(previewText()).toContain('Use the grep tool')
    expect(previewText()).not.toContain('Custom grep text.')
  })
})
