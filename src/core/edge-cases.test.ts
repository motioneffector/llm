import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'
import { NetworkError } from '../errors'

describe('Request Edge Cases', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('handles rapid successive requests', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response

    vi.mocked(fetch).mockResolvedValue(mockResponse)

    await client.chat([{ role: 'user', content: 'First' }])
    await client.chat([{ role: 'user', content: 'Second' }])
    await client.chat([{ role: 'user', content: 'Third' }])

    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('handles concurrent requests (different calls)', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response

    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const results = await Promise.all([
      client.chat([{ role: 'user', content: 'A' }]),
      client.chat([{ role: 'user', content: 'B' }]),
      client.chat([{ role: 'user', content: 'C' }]),
    ])

    expect(results).toHaveLength(3)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('handles very long messages (sends to API, may fail)', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response

    vi.mocked(fetch).mockResolvedValueOnce(mockResponse)

    const longContent = 'x'.repeat(1000000)
    await client.chat([{ role: 'user', content: longContent }])

    expect(fetch).toHaveBeenCalled()
  })

  it('handles special characters in content', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response

    vi.mocked(fetch).mockResolvedValueOnce(mockResponse)

    const specialContent = 'Test with "quotes" and \\backslashes\\ and \nnewlines'
    await client.chat([{ role: 'user', content: specialContent }])

    expect(fetch).toHaveBeenCalled()
    const body = JSON.parse((fetch as any).mock.calls[0][1].body)
    expect(body.messages[0].content).toBe(specialContent)
  })
})

describe('Response Edge Cases', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('handles response with empty content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: '' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('')
  })

  it('handles response with null content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('')
  })

  it('handles unexpected extra fields in response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        extra_field: 'ignored',
        another_field: { nested: 'data' },
      }),
    } as Response)

    const response = await client.chat([{ role: 'user', content: 'Hello' }])
    expect(response.content).toBe('Response')
  })
})

describe('Conversation Edge Cases', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('conversation works after clear()', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response

    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const conversation = client.createConversation()

    await conversation.send('First message')
    expect(conversation.history.length).toBeGreaterThan(0)

    conversation.clear()

    await conversation.send('Second message')
    expect(conversation.history.length).toBe(2)
  })

  it('conversation works after error', async () => {
    const conversation = client.createConversation()

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    try {
      await conversation.send('First message')
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError)
    }

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

    const response = await conversation.send('Second message')
    expect(response).toBe('Response')
  })

  it('history not corrupted after failed request', async () => {
    const conversation = client.createConversation()

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const historyBefore = conversation.history.length

    try {
      await conversation.send('Hello')
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError)
    }

    const historyAfter = conversation.history
    expect(Array.isArray(historyAfter)).toBe(true)
    expect(historyAfter.length).toBeGreaterThanOrEqual(historyBefore)
  })
})
