// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useSectionBrandVisibility } from './useSectionBrandVisibility'

function Harness({ enabled = true, onChange }: { enabled?: boolean; onChange: (visible: boolean) => void }) {
  const brandRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useSectionBrandVisibility({ brandRef, enabled, onVisibilityChange: (next) => { setVisible(next); onChange(next) } })
  return <div ref={brandRef} data-visible={visible} />
}

describe('useSectionBrandVisibility', () => {
  it('reports the initial visibility and updates the shared section state on scroll and resize', () => {
    const onChange = vi.fn()
    const view = render(<Harness onChange={onChange} />)
    const brand = view.container.firstElementChild as HTMLDivElement
    let bounds = { top: 80, bottom: 180 }
    brand.getBoundingClientRect = () => bounds as DOMRect

    fireEvent.scroll(window)
    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(brand).toHaveAttribute('data-visible', 'true')

    bounds = { top: -220, bottom: -20 }
    fireEvent.resize(window)
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(brand).toHaveAttribute('data-visible', 'false')
  })

  it('does not attach visibility behavior when disabled', () => {
    const onChange = vi.fn()
    const view = render(<Harness enabled={false} onChange={onChange} />)

    fireEvent.scroll(window)
    fireEvent.resize(window)

    expect(onChange).not.toHaveBeenCalled()
    expect(view.container.firstElementChild).toHaveAttribute('data-visible', 'false')
  })
})
