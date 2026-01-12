import { describe, it, expect, beforeEach } from 'vitest'
import { estimateTokens } from './tokens'
import { createLLMClient } from '../core/client'

describe('estimateTokens(text)', () => {
  it('returns estimated token count for string', () => {
    const result = estimateTokens('Hello world')
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(10)
  })

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('uses simple heuristic: characters / 4', () => {
    const text = 'Hello'
    const result = estimateTokens(text)
    const expected = Math.ceil(text.length / 4)
    expect(result).toBeCloseTo(expected, 0)
  })

  it('handles unicode correctly', () => {
    const result = estimateTokens('你好世界')
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
  })

  it('rounds to nearest integer', () => {
    const result = estimateTokens('Hello')
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('client.estimateChat(messages)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('estimates tokens for full message array', () => {
    const result = client.estimateChat([{ role: 'user', content: 'Hello' }])
    expect(result).toHaveProperty('prompt')
    expect(typeof result.prompt).toBe('number')
    expect(result.prompt).toBeGreaterThan(0)
  })

  it('accounts for message structure overhead', () => {
    const content = 'Hi'
    const messages = [{ role: 'user' as const, content }]
    const estimate = client.estimateChat(messages)
    const contentOnly = estimateTokens(content)

    expect(estimate.prompt).toBeGreaterThan(contentOnly)
  })

  it('sums all message contents', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there' },
      { role: 'user' as const, content: 'How are you?' },
    ]
    const result = client.estimateChat(messages)

    expect(result.prompt).toBeGreaterThan(0)
  })

  it('returns available tokens based on model context', () => {
    const result = client.estimateChat([{ role: 'user', content: 'Hello' }])
    expect(result).toHaveProperty('available')
    expect(typeof result.available).toBe('number')
    expect(result.available).toBeGreaterThan(0)
  })

  it('uses default context limit if model unknown', () => {
    const client = createLLMClient({ apiKey: 'sk-test', model: 'unknown/model' })
    const result = client.estimateChat([{ role: 'user', content: 'Hello' }])

    expect(result.available).toBeGreaterThan(0)
    expect(result.available).toBeLessThan(200000)
  })
})
