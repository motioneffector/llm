import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'
import { ValidationError } from '../errors'
import type { Message } from '../types'

describe('client.chat(messages)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('sends messages array to API and returns response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'chatcmpl-abc123',
        model: 'anthropic/claude-sonnet-4',
        choices: [{ message: { content: 'Hello! How can I help?' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])

    expect(response).toBeDefined()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns response with content string', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Hello! How can I help?' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('Hello! How can I help?')
  })

  it('returns response with usage stats', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.usage).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    })
  })

  it('returns response with model identifier', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'anthropic/claude-sonnet-4',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.model).toBe('anthropic/claude-sonnet-4')
  })

  it('returns response with request id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-abc123',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.id).toBe('chatcmpl-abc123')
  })

  it('returns response with finishReason', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.finishReason).toBe('stop')
  })

  it('returns response with latency in milliseconds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.latency).toBeGreaterThanOrEqual(0)
    expect(typeof response.latency).toBe('number')
  })

  it('handles single user message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hi' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"messages":[{"role":"user","content":"Hi"}]'),
      })
    )
  })

  it('handles system + user messages', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([
      { role: 'system', content: 'Be helpful' },
      { role: 'user', content: 'Hi' },
    ])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"role":"system"'),
      })
    )
  })

  it('handles full conversation history', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const messages: Message[] = [
      { role: 'system', content: 'Be helpful' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
      { role: 'assistant', content: 'Great!' },
      { role: 'user', content: 'Tell me more' },
    ]

    await client.chat(messages)

    const callBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string
    expect(callBody).toContain('"role":"system"')
    expect(callBody).toContain('"role":"assistant"')
  })

  it('handles response with null usage data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: null,
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })
  })

  it('handles response with missing usage field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })
  })
})

describe('Request Format', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)
  })

  it('sends Authorization header with Bearer token', async () => {
    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      })
    )
  })

  it('sends Content-Type header as application/json', async () => {
    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('sends model in request body', async () => {
    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"model":"anthropic/claude-sonnet-4"'),
      })
    )
  })

  it('sends messages array in request body', async () => {
    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"messages"'),
      })
    )
  })

  it('sends HTTP-Referer header for OpenRouter (default baseUrl)', async () => {
    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'HTTP-Referer': expect.any(String),
        }),
      })
    )
  })

  it('sends X-Title header for OpenRouter (default baseUrl)', async () => {
    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Title': expect.any(String),
        }),
      })
    )
  })

  it('omits OpenRouter headers when baseUrl is not OpenRouter', async () => {
    const openaiClient = createLLMClient({
      apiKey: 'sk-test',
      model: 'gpt-4',
      baseUrl: 'https://api.openai.com/v1',
    })

    await openaiClient.chat([{ role: 'user', content: 'Hello' }])

    const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['HTTP-Referer']).toBeUndefined()
    expect(headers['X-Title']).toBeUndefined()
  })

  it('sends stream: false for non-streaming requests', async () => {
    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"stream":false'),
      })
    )
  })
})

describe('Input Validation', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('throws ValidationError for empty messages array', async () => {
    await expect(client.chat([])).rejects.toThrow(ValidationError)
    await expect(client.chat([])).rejects.toThrow(/messages array cannot be empty/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws ValidationError for invalid role', async () => {
    await expect(
      client.chat([
        // @ts-expect-error - Testing runtime validation
        { role: 'admin', content: 'Hi' },
      ])
    ).rejects.toThrow(ValidationError)
    await expect(
      client.chat([
        // @ts-expect-error - Testing runtime validation
        { role: 'admin', content: 'Hi' },
      ])
    ).rejects.toThrow(/role/)
  })

  it('throws TypeError for null content', async () => {
    await expect(
      client.chat([
        // @ts-expect-error - Testing runtime validation
        { role: 'user', content: null },
      ])
    ).rejects.toThrow(TypeError)
    await expect(
      client.chat([
        // @ts-expect-error - Testing runtime validation
        { role: 'user', content: null },
      ])
    ).rejects.toThrow(/content/)
  })

  it('throws TypeError for undefined content', async () => {
    await expect(
      client.chat([
        // @ts-expect-error - Testing runtime validation
        { role: 'user', content: undefined },
      ])
    ).rejects.toThrow(TypeError)
  })

  it('throws TypeError for non-string content', async () => {
    await expect(
      client.chat([
        // @ts-expect-error - Testing runtime validation
        { role: 'user', content: 123 },
      ])
    ).rejects.toThrow(TypeError)
  })

  it('allows empty string content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: '' }])
    expect(response.content).toBe('Response')
    expect(response.usage).toBeDefined()
  })

  it('allows whitespace-only content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: '   ' }])
    expect(response.content).toBe('Response')
    expect(response.usage).toBeDefined()
  })

  it('validates all messages in array, not just first', async () => {
    await expect(
      client.chat([
        { role: 'user', content: 'Hi' },
        // @ts-expect-error - Testing runtime validation
        { role: 'invalid', content: 'x' },
      ])
    ).rejects.toThrow(ValidationError)
  })

  it('handles messages with unicode and emoji', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: '你好 👋 مرحبا' }])

    const callBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string
    expect(callBody).toContain('你好 👋 مرحبا')
  })

  it('handles messages with newlines', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Line 1\nLine 2\n\nLine 4' }])

    const callBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string
    expect(callBody).toContain('Line 1\\nLine 2\\n\\nLine 4')
  })

  it('does not validate message length (let API handle)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const longContent = 'x'.repeat(100000)
    const response = await client.chat([{ role: 'user', content: longContent }])
    expect(response.content).toBe('Response')
    expect(response.usage).toBeDefined()
    expect(fetch).toHaveBeenCalled()
  })
})

describe('client.chat(messages, options)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)
  })

  it('temperature option is sent to API', async () => {
    await client.chat([{ role: 'user', content: 'Hi' }], { temperature: 0.5 })

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"temperature":0.5'),
      })
    )
  })

  it('temperature must be between 0 and 2', async () => {
    await expect(
      client.chat([{ role: 'user', content: 'Hi' }], { temperature: 2.5 })
    ).rejects.toThrow(ValidationError)
  })

  it('maxTokens option is sent as max_tokens', async () => {
    await client.chat([{ role: 'user', content: 'Hi' }], { maxTokens: 500 })

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"max_tokens":500'),
      })
    )
  })

  it('topP option is sent as top_p', async () => {
    await client.chat([{ role: 'user', content: 'Hi' }], { topP: 0.9 })

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"top_p":0.9'),
      })
    )
  })

  it('model option overrides default model', async () => {
    await client.chat([{ role: 'user', content: 'Hi' }], { model: 'openai/gpt-4' })

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"model":"openai/gpt-4"'),
      })
    )
  })

  it('stop option sends stop sequences', async () => {
    await client.chat([{ role: 'user', content: 'Hi' }], { stop: ['END', '###'] })

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"stop":["END","###"]'),
      })
    )
  })

  it('options override defaultParams from client creation', async () => {
    const clientWithDefaults = createLLMClient({
      apiKey: 'sk-test',
      model: 'test',
      defaultParams: { temperature: 0.7 },
    })

    await clientWithDefaults.chat([{ role: 'user', content: 'Hi' }], { temperature: 0.2 })

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"temperature":0.2'),
      })
    )
  })

  it('options merge with defaultParams (non-conflicting)', async () => {
    const clientWithDefaults = createLLMClient({
      apiKey: 'sk-test',
      model: 'test',
      defaultParams: { temperature: 0.7 },
    })

    await clientWithDefaults.chat([{ role: 'user', content: 'Hi' }], { maxTokens: 100 })

    const callBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string
    expect(callBody).toContain('"temperature":0.7')
    expect(callBody).toContain('"max_tokens":100')
  })

  it('undefined options do not override defaultParams', async () => {
    const clientWithDefaults = createLLMClient({
      apiKey: 'sk-test',
      model: 'test',
      defaultParams: { temperature: 0.7 },
    })

    await clientWithDefaults.chat([{ role: 'user', content: 'Hi' }], { temperature: undefined })

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"temperature":0.7'),
      })
    )
  })
})
