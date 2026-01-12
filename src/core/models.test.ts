import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'
import { getModelInfo } from './models'
import { ValidationError } from '../errors'

describe('client.getModel()', () => {
  it('returns current default model', () => {
    const client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    expect(client.getModel()).toBe('anthropic/claude-sonnet-4')
  })
})

describe('client.setModel(model)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('changes default model', () => {
    client.setModel('openai/gpt-4')
    expect(client.getModel()).toBe('openai/gpt-4')
  })

  it('affects subsequent requests', async () => {
    client.setModel('openai/gpt-4')

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'openai/gpt-4',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('openai/gpt-4'),
      })
    )
  })

  it('throws ValidationError for empty model', () => {
    expect(() => client.setModel('')).toThrow(ValidationError)
  })

  it('does not validate model exists (API will reject invalid)', () => {
    expect(() => client.setModel('nonexistent/model')).not.toThrow()
    expect(client.getModel()).toBe('nonexistent/model')
  })
})

describe('getModelInfo(modelId)', () => {
  it('returns model context length', () => {
    const info = getModelInfo('anthropic/claude-sonnet-4')
    expect(info).toBeDefined()
    expect(info).toHaveProperty('contextLength')
    expect(typeof info?.contextLength).toBe('number')
    expect(info?.contextLength).toBeGreaterThan(0)
  })

  it('returns model pricing info', () => {
    const info = getModelInfo('anthropic/claude-sonnet-4')
    expect(info).toBeDefined()
    expect(info).toHaveProperty('pricing')
    expect(info?.pricing).toHaveProperty('prompt')
    expect(info?.pricing).toHaveProperty('completion')
    expect(typeof info?.pricing.prompt).toBe('number')
    expect(typeof info?.pricing.completion).toBe('number')
  })

  it('returns undefined for unknown model', () => {
    const info = getModelInfo('unknown/model')
    expect(info).toBeUndefined()
  })

  it('includes common models', () => {
    const models = [
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3-opus',
      'openai/gpt-4o',
      'openai/gpt-4-turbo',
      'meta-llama/llama-3.1-405b',
    ]

    for (const model of models) {
      const info = getModelInfo(model)
      expect(info).toBeDefined()
      expect(info).toHaveProperty('contextLength')
      expect(info).toHaveProperty('pricing')
    }
  })
})
