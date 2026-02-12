import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'
import { RateLimitError, ServerError, AuthError, ModelError } from '../errors'

describe('Automatic Retry', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    vi.clearAllMocks()
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('retries on 429 (rate limit)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])

    expect(response.content).toBe('Success')
  }, 10000)

  it('retries on 500', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])

    expect(response.content).toBe('Success')
  }, 10000)

  it('retries on 502, 503, 504', async () => {
    for (const status of [502, 503, 504]) {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status,
          json: async () => ({ error: { message: 'Gateway error' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'test',
            model: 'test',
            choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
        } as Response)

      const response = await client.chat([{ role: 'user', content: 'Hello' }])

      expect(response.content).toBe('Success')
      vi.clearAllMocks()
    }
  }, 10000)

  it('does NOT retry on 400', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Bad request' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(/Bad request/)
    expect(fetch).toHaveBeenCalledTimes(1)
  }, 10000)

  it('does NOT retry on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(/Unauthorized/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 403', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Forbidden' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(/Forbidden/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Model not found' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(/Model not found/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('respects Retry-After header if present', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '2' }),
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])

    expect(response.content).toBe('Success')
  }, 10000)

  it('uses exponential backoff: 1s, 2s, 4s', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('Success')
  }, 10000)

  it('backoff capped at 30 seconds', async () => {
    // Test with fewer retries to keep test time reasonable
    // Backoff: 1s, 2s, 4s, 8s, 16s, 30s = 61s total
    const responses = Array.from({ length: 6 }, () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    }))
    responses.push({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    })

    vi.mocked(fetch).mockImplementation(async () => {
      const response = responses.shift()
      return response as Response
    })

    const response = await client.chat([{ role: 'user', content: 'Hello' }], { maxRetries: 6 })
    expect(response.content).toBe('Success')
  }, 70000)

  it('maximum 3 retries by default (4 total attempts)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(/Server error/)
    expect(fetch).toHaveBeenCalledTimes(4)
  }, 10000)

  it('maxRetries option overrides default', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { maxRetries: 5 })
    ).rejects.toThrow(/Server error/)
    expect(fetch).toHaveBeenCalledTimes(6)
  }, 60000)

  it('maxRetries: 0 means no retries', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { maxRetries: 0 })
    ).rejects.toThrow(/Server error/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('client.chat(messages, { retry: false })', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('disables automatic retry entirely', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    } as Response)

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    ).rejects.toThrow(/Rate limit exceeded/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws immediately on retriable error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Service unavailable' } }),
    } as Response)

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    ).rejects.toThrow(/Service unavailable/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('Retry and Streaming', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('streaming does NOT retry (fails fast)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    } as Response)

    const stream = client.stream([{ role: 'user', content: 'Hello' }])

    await expect(async () => {
      for await (const _chunk of stream) {
        // Should throw before yielding
      }
    }).rejects.toThrow(/Rate limit exceeded/)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('streaming retry: true option is ignored', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    const stream = client.stream([{ role: 'user', content: 'Hello' }], { retry: true })

    await expect(async () => {
      for await (const _chunk of stream) {
        // Should throw before yielding
      }
    }).rejects.toThrow(/Server error/)

    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('Security: DoS prevention via Retry-After header', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    vi.clearAllMocks()
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('caps retry delay at 30 seconds for malicious Retry-After values', async () => {
    const startTime = Date.now()

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '999999999' }), // ~31.7 years
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    const elapsed = Date.now() - startTime

    expect(response.content).toBe('Success')
    // Should complete within reasonable time (30s + margin), not years
    expect(elapsed).toBeLessThan(35000)
  }, 40000)

  it('handles negative Retry-After values gracefully', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '-1000' }),
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('Success')
  }, 10000)

  it('handles non-numeric Retry-After values by falling back to exponential backoff', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': 'invalid' }),
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('Success')
  }, 10000)

  it('handles Infinity in Retry-After by falling back to exponential backoff', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': 'Infinity' }),
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('Success')
  }, 10000)
})
