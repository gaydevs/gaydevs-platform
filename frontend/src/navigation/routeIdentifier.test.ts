import { expect, test } from 'vitest'
import { trimRouteIdentifier } from './routeIdentifier'

test.each([
  ['', null],
  ['/', null],
  ['////', null],
  ['ana', 'ana'],
  ['/ana', 'ana'],
  ['ana/', 'ana'],
  ['///ana///', 'ana'],
  ['//qual-jogo//', 'qual-jogo'],
  ['/new/', 'new'],
  ['/ana//silva/', 'ana//silva'],
  ['/a%2Fb/', 'a%2Fb'],
  ['/ gdev /', ' gdev '],
] as const)('normalizes only boundary slashes in %j', (input, expected) => {
  expect(trimRouteIdentifier(input)).toBe(expected)
})

test('handles long slash sequences without backtracking', () => {
  const slashes = '/'.repeat(100_000)
  expect(trimRouteIdentifier(slashes)).toBeNull()
  expect(trimRouteIdentifier(slashes + 'ana' + slashes)).toBe('ana')
  expect(trimRouteIdentifier('ana' + slashes + 'silva')).toBe('ana' + slashes + 'silva')
})
