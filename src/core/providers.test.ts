import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'

describe('OpenRouter Specifics', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('handles OpenRouter-specific response format', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'anthropic/claude-sonnet-4',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        provider: 'Anthropic',
        extra_field: 'should be ignored',
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('Response')
  })

  it('includes required OpenRouter headers (default baseUrl)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'HTTP-Referer': expect.any(String),
          'X-Title': expect.any(String),
        }),
      })
    )
  })

  it('parses OpenRouter error messages', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'Invalid request',
          code: 'invalid_request',
        },
      }),
    } as Response)

    try {
      await client.chat([{ role: 'user', content: 'Hello' }])
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('Invalid request')
    }
  })
})

describe('Base URL Override', () => {
  it('custom baseUrl sends requests to that endpoint', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'gpt-4',
      baseUrl: 'https://api.openai.com/v1',
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
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
      expect.any(Object)
    )
  })

  it('works with OpenAI-compatible APIs', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'llama3',
      baseUrl: 'http://localhost:11434/v1',
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'llama3',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('Response')
  })

  it('omits OpenRouter-specific headers for non-OpenRouter URLs', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'gpt-4',
      baseUrl: 'https://api.openai.com/v1',
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'gpt-4',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const headers = fetchCall[1]?.headers as Record<string, string>

    expect(headers['HTTP-Referer']).toBeUndefined()
    expect(headers['X-Title']).toBeUndefined()
  })

  it('includes OpenRouter headers if URL contains openrouter', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'test',
      baseUrl: 'https://custom.openrouter.ai/v1',
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'HTTP-Referer': expect.any(String),
          'X-Title': expect.any(String),
        }),
      })
    )
  })

  it('appends /chat/completions to baseUrl', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'test',
      baseUrl: 'https://api.example.com/v1',
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.any(Object)
    )
  })

  it('handles baseUrl with trailing slash', async () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'test',
      baseUrl: 'https://api.example.com/v1/',
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    await client.chat([{ role: 'user', content: 'Hello' }])

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const url = fetchCall[0] as string

    expect(url).not.toContain('v1//chat/completions')
    expect(url).toContain('v1/chat/completions')
  })
})
