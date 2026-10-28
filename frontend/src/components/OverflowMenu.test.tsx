// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { OverflowMenu } from './OverflowMenu'

afterEach(cleanup)

describe('OverflowMenu', () => {
  it('keeps the trigger visible, closes outside, and closes after an action', async () => {
    const user = userEvent.setup()
    render(<><button type="button">fora</button><OverflowMenu label="Ações da enquete"><button type="button">não quero votar</button></OverflowMenu></>)

    const trigger = screen.getByRole('button', { name: 'Ações da enquete' })
    expect(trigger).toBeVisible()
    expect(screen.queryByRole('button', { name: 'não quero votar' })).not.toBeInTheDocument()

    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'não quero votar' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'fora' }))
    expect(screen.queryByRole('button', { name: 'não quero votar' })).not.toBeInTheDocument()

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'não quero votar' }))
    expect(screen.queryByRole('button', { name: 'não quero votar' })).not.toBeInTheDocument()
  })
})
