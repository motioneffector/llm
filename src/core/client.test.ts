import { describe, it, expect, vi } from 'vitest'
import { createLLMClient } from './client'
import { ValidationError } from '../errors'

describe('createLLMClient(options)', () => {
  it('creates client with apiKey and model', () => {
    const client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    expect(client.getModel()).toBe('anthropic/claude-sonnet-4')
  })

  it('throws ValidationError if apiKey is missing', () => {
    expect(() =>
      // @ts-expect-error - Testing runtime validation
      createLLMClient({ model: 'anthropic/claude-sonnet-4' })
    ).toThrow(/apiKey/)
  })

  it('throws ValidationError if apiKey is empty string', () => {
    expect(() => createLLMClient({ apiKey: '', model: 'anthropic/claude-sonnet-4' })).toThrow(
      /apiKey/
    )
  })

  it('throws ValidationError if model is missing', () => {
    expect(() =>
      // @ts-expect-error - Testing runtime validation
      createLLMClient({ apiKey: 'sk-test' })
    ).toThrow(/model/)
  })

  it('throws ValidationError if model is empty string', () => {
    expect(() => createLLMClient({ apiKey: 'sk-test', model: '' })).toThrow(/model/)
  })

  it('accepts custom baseUrl', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'gpt-4',
      baseUrl: 'https://api.openai.com/v1',
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'gpt-4',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.anything()
    )
  })

  it('defaults baseUrl to OpenRouter', async () => {
    const client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'anthropic/claude-sonnet-4',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.anything()
    )
  })

  it('accepts defaultParams for generation settings', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'x',
      defaultParams: { temperature: 0.7, maxTokens: 1000 },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'x',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"temperature":0.7'),
      })
    )
    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"max_tokens":1000'),
      })
    )
  })

  it('accepts referer option for OpenRouter header', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'x',
      referer: 'https://myapp.com',
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'x',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'HTTP-Referer': 'https://myapp.com',
        }),
      })
    )
  })

  it('accepts title option for OpenRouter header', async () => {
    const client = createLLMClient({ apiKey: 'sk-test', model: 'x', title: 'My Application' })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'x',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Title': 'My Application',
        }),
      })
    )
  })

  it('does not make any network requests on creation', () => {
    createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
