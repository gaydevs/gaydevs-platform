// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { listPolls } from './pollsApi'

describe('pollsApi SSR compatibility', () => {
  it('can be imported without a browser window', () => {
    expect(typeof window).toBe('undefined')
    expect(listPolls).toBeTypeOf('function')
  })
})
