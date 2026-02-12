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
    expect(() => client.setModel('')).toThrow(/model/)
  })

  it('does not validate model exists (API will reject invalid)', () => {
    expect(() => client.setModel('nonexistent/model')).not.toThrow()
    expect(client.getModel()).toBe('nonexistent/model')
  })
})

describe('getModelInfo(modelId)', () => {
  it('returns model context length', () => {
    const info = getModelInfo('anthropic/claude-sonnet-4')
    expect(info).toEqual({
      contextLength: 200000,
      pricing: { prompt: 3.0, completion: 15.0 },
    })
  })

  it('returns model pricing info', () => {
    const info = getModelInfo('anthropic/claude-sonnet-4')
    expect(info?.pricing.prompt).toBe(3.0)
    expect(info?.pricing.completion).toBe(15.0)
  })

  it('returns undefined for unknown model', () => {
    const info = getModelInfo('unknown/model')
    expect(info).toBe(undefined)
  })

  it('includes common models', () => {
    const models = [
      { id: 'anthropic/claude-sonnet-4', ctx: 200000 },
      { id: 'anthropic/claude-3-opus', ctx: 200000 },
      { id: 'openai/gpt-4o', ctx: 128000 },
      { id: 'openai/gpt-4-turbo', ctx: 128000 },
      { id: 'meta-llama/llama-3.1-405b', ctx: 128000 },
    ]

    for (const { id, ctx } of models) {
      const info = getModelInfo(id)
      expect(info?.contextLength).toBe(ctx)
    }
  })
})

describe('Security: prototype pollution prevention', () => {
  it('rejects __proto__ as model identifier', () => {
    const info = getModelInfo('__proto__')
    expect(info).toBe(undefined)
  })

  it('rejects constructor as model identifier', () => {
    const info = getModelInfo('constructor')
    expect(info).toBe(undefined)
  })

  it('rejects prototype as model identifier', () => {
    const info = getModelInfo('prototype')
    expect(info).toBe(undefined)
  })

  it('does not leak prototype properties', () => {
    // Attempt to access Object.prototype properties
    const info = getModelInfo('toString')
    expect(info).toBe(undefined)
  })

  it('only returns own properties from MODEL_DATABASE', () => {
    // Valid model should work
    const info = getModelInfo('anthropic/claude-sonnet-4')
    expect(info).toEqual({
      contextLength: 200000,
      pricing: { prompt: 3.0, completion: 15.0 },
    })

    // Inherited properties should not be accessible
    expect(getModelInfo('hasOwnProperty')).toBe(undefined)
    expect(getModelInfo('valueOf')).toBe(undefined)
  })
})
