// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { DarkListbox, type DarkListboxOption } from './DarkListbox'

afterEach(() => {
  cleanup()
})

const OPTIONS: DarkListboxOption[] = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
]

function Controlled({ initial = 'a' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <DarkListbox value={value} onChange={setValue} options={OPTIONS} ariaLabel="Test listbox" />
}

describe('DarkListbox', () => {
  it('renders the label for the currently selected value, not the raw value', () => {
    render(<Controlled initial="b" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Option B')
  })

  it('opens the option list on trigger click and shows every option', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('selects an option on click and closes the list', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Option C' }))
    expect(screen.getByRole('combobox')).toHaveTextContent('Option C')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes on outside click without changing the selection', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <Controlled />
        <button>outside</button>
      </div>
    )
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Option A')
  })

  it('supports keyboard navigation: ArrowDown then Enter selects the next option', async () => {
    const user = userEvent.setup()
    render(<Controlled initial="a" />)
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(trigger).toHaveTextContent('Option B')
  })

  it('closes on Escape without changing the selection', async () => {
    const user = userEvent.setup()
    render(<Controlled initial="a" />)
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveTextContent('Option A')
  })

  it('calls onChange with the option value, not its label', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DarkListbox value="a" onChange={onChange} options={OPTIONS} ariaLabel="Test listbox" />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Option B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
