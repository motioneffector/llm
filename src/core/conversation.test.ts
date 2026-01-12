import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'
import { ValidationError, ConcurrencyError } from '../errors'
import type { Message } from '../types'

describe('client.createConversation(options?)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('creates conversation object', () => {
    const conversation = client.createConversation()
    expect(conversation).toBeDefined()
    expect(conversation.send).toBeDefined()
    expect(conversation.sendStream).toBeDefined()
    expect(conversation.history).toBeDefined()
    expect(conversation.clear).toBeDefined()
  })

  it('accepts optional system prompt', () => {
    const conversation = client.createConversation({ system: 'You are helpful' })
    expect(conversation.history).toEqual([{ role: 'system', content: 'You are helpful' }])
  })

  it('accepts optional initial messages', () => {
    const conversation = client.createConversation({
      initialMessages: [{ role: 'user', content: 'Hi' }],
    })
    expect(conversation.history).toEqual([{ role: 'user', content: 'Hi' }])
  })

  it('allows system message in initialMessages', () => {
    const conversation = client.createConversation({
      initialMessages: [{ role: 'system', content: 'Be brief' }],
    })
    expect(conversation.history).toEqual([{ role: 'system', content: 'Be brief' }])
  })

  it('allows both system and initialMessages with system', () => {
    const conversation = client.createConversation({
      system: 'X',
      initialMessages: [{ role: 'system', content: 'Y' }],
    })
    // system option takes precedence, initialMessages system is kept in history
    expect(conversation.history).toEqual([
      { role: 'system', content: 'X' },
      { role: 'system', content: 'Y' },
    ])
  })

  it('allows empty initialMessages array', () => {
    const conversation = client.createConversation({ initialMessages: [] })
    expect(conversation.history).toEqual([])
  })

  it('allows non-alternating messages in initialMessages', () => {
    const conversation = client.createConversation({
      initialMessages: [
        { role: 'user', content: 'A' },
        { role: 'user', content: 'B' },
        { role: 'assistant', content: 'C' },
      ],
    })
    expect(conversation.history).toEqual([
      { role: 'user', content: 'A' },
      { role: 'user', content: 'B' },
      { role: 'assistant', content: 'C' },
    ])
  })

  it('starts with empty history if no options', () => {
    const conversation = client.createConversation()
    expect(conversation.history).toEqual([])
  })
})

describe('conversation.send(content)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Hi there! How can I help?' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)
  })

  it('sends user message and returns assistant response string', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Hi there! How can I help?' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const conversation = client.createConversation()
    const response = await conversation.send('Hello')

    expect(response).toBe('Hi there! How can I help?')
  })

  it('adds user message to history before request', async () => {
    const conversation = client.createConversation()
    await conversation.send('Hello')

    const history = conversation.history
    expect(history).toContainEqual({ role: 'user', content: 'Hello' })
  })

  it('adds assistant response to history after completion', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Hi there!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const conversation = client.createConversation()
    await conversation.send('Hello')

    const history = conversation.history
    expect(history).toContainEqual({ role: 'assistant', content: 'Hi there!' })
  })

  it('subsequent send() includes full history', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'I am great!' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
        }),
      } as Response)

    const conversation = client.createConversation()
    await conversation.send('Hello')
    await conversation.send('How are you?')

    const callBody = vi.mocked(fetch).mock.calls[1]?.[1]?.body as string
    expect(callBody).toContain('Hello')
    expect(callBody).toContain('Hi')
    expect(callBody).toContain('How are you?')
  })

  it('system prompt is included first in every request', async () => {
    const conversation = client.createConversation({ system: 'Be helpful' })
    await conversation.send('Hello')

    const callBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string
    const body = JSON.parse(callBody)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Be helpful' })
  })

  it('throws ConcurrencyError if called while previous send is pending', async () => {
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  id: 'test',
                  model: 'test',
                  choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
                  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                }),
              } as Response),
            100
          )
        )
    )

    const conversation = client.createConversation()
    const first = conversation.send('First')

    await expect(conversation.send('Second')).rejects.toThrow(ConcurrencyError)

    await first
  })
})

describe('conversation.sendStream(content)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('sends user message and returns async iterable', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const conversation = client.createConversation()
    const stream = conversation.sendStream('Hello')

    expect(stream[Symbol.asyncIterator]).toBeDefined()

    const chunks: string[] = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('adds user message to history immediately (before streaming)', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const conversation = client.createConversation()
    const stream = conversation.sendStream('Hello')
    const iterator = stream[Symbol.asyncIterator]()
    await iterator.next()

    const history = conversation.history
    expect(history).toContainEqual({ role: 'user', content: 'Hello' })
  })

  it('adds complete assistant response to history after stream ends', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" there"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const conversation = client.createConversation()
    const chunks: string[] = []
    for await (const chunk of conversation.sendStream('Hello')) {
      chunks.push(chunk)
    }

    const history = conversation.history
    expect(history).toContainEqual({ role: 'assistant', content: 'Hi there' })
  })

  it('does NOT add partial response to history if stream errors', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
        controller.error(new Error('Network error'))
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const conversation = client.createConversation()

    try {
      for await (const chunk of conversation.sendStream('Hello')) {
        // consume chunks
      }
    } catch (e) {
      // Expected error
    }

    const history = conversation.history
    const assistantMessages = history.filter(m => m.role === 'assistant')
    expect(assistantMessages).toHaveLength(0)
  })

  it('does NOT add response to history if stream is aborted', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
        setTimeout(() => {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":" there"}}]}\n\n')
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }, 100)
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const conversation = client.createConversation()
    const controller = new AbortController()

    try {
      let count = 0
      for await (const chunk of conversation.sendStream('Hello')) {
        count++
        if (count === 1) {
          controller.abort()
          break
        }
      }
    } catch (e) {
      // Expected abort
    }

    const history = conversation.history
    const assistantMessages = history.filter(m => m.role === 'assistant')
    expect(assistantMessages).toHaveLength(0)
  })

  it('throws ConcurrencyError if called while previous request is pending', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        setTimeout(() => {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }, 100)
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const conversation = client.createConversation()
    const firstStream = conversation.sendStream('First')
    const iterator = firstStream[Symbol.asyncIterator]()
    iterator.next()

    expect(() => conversation.sendStream('Second')).toThrow(ConcurrencyError)
  })
})

describe('conversation.history', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('returns full message history array', () => {
    const conversation = client.createConversation({
      initialMessages: [{ role: 'user', content: 'Hi' }],
    })
    const history = conversation.history
    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBeGreaterThan(0)
  })

  it('includes system message if set (as first element)', () => {
    const conversation = client.createConversation({ system: 'Be helpful' })
    const history = conversation.history
    expect(history[0]).toEqual({ role: 'system', content: 'Be helpful' })
  })

  it("returns defensive copy (mutations don't affect internal state)", () => {
    const conversation = client.createConversation({
      initialMessages: [{ role: 'user', content: 'Original' }],
    })

    const h = conversation.history
    h.push({ role: 'user', content: 'X' })

    const newHistory = conversation.history
    expect(newHistory).not.toContainEqual({ role: 'user', content: 'X' })
  })

  it('returns empty array for new conversation without initialMessages', () => {
    const conversation = client.createConversation()
    expect(conversation.history.length).toBe(0)
  })
})

describe('conversation.addMessage(role, content)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('manually adds message to history', () => {
    const conversation = client.createConversation()
    conversation.addMessage('user', 'Injected')

    const history = conversation.history
    expect(history).toContainEqual({ role: 'user', content: 'Injected' })
  })

  it("accepts 'user' role", () => {
    const conversation = client.createConversation()
    expect(() => conversation.addMessage('user', 'Hello')).not.toThrow()
  })

  it("accepts 'assistant' role", () => {
    const conversation = client.createConversation()
    expect(() => conversation.addMessage('assistant', 'Hi')).not.toThrow()
  })

  it("throws ValidationError for 'system' role", () => {
    const conversation = client.createConversation()
    expect(() =>
      conversation.addMessage(
        // @ts-expect-error - Testing runtime validation
        'system',
        'X'
      )
    ).toThrow(ValidationError)
    expect(() =>
      conversation.addMessage(
        // @ts-expect-error - Testing runtime validation
        'system',
        'X'
      )
    ).toThrow(/use constructor for system prompt/)
  })

  it('throws ValidationError for invalid role', () => {
    const conversation = client.createConversation()
    expect(() =>
      conversation.addMessage(
        // @ts-expect-error - Testing runtime validation
        'admin',
        'X'
      )
    ).toThrow(ValidationError)
  })

  it('throws TypeError for non-string content', () => {
    const conversation = client.createConversation()
    expect(() =>
      conversation.addMessage(
        'user',
        // @ts-expect-error - Testing runtime validation
        null
      )
    ).toThrow(TypeError)
  })

  it('throws ConcurrencyError if called during pending request', async () => {
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  id: 'test',
                  model: 'test',
                  choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
                  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                }),
              } as Response),
            100
          )
        )
    )

    const conversation = client.createConversation()
    const promise = conversation.send('Hello')

    expect(() => conversation.addMessage('user', 'X')).toThrow(ConcurrencyError)

    await promise
  })
})

describe('conversation.clear()', () => {
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

  it('clears all messages except system prompt', async () => {
    const conversation = client.createConversation({ system: 'Be helpful' })
    await conversation.send('Hello')

    conversation.clear()

    const history = conversation.history
    expect(history.length).toBe(1)
    expect(history[0]).toEqual({ role: 'system', content: 'Be helpful' })
  })

  it('system prompt retained if originally set', async () => {
    const conversation = client.createConversation({ system: 'Be helpful' })
    await conversation.send('Hello')

    conversation.clear()

    expect(conversation.history).toEqual([{ role: 'system', content: 'Be helpful' }])
  })

  it('results in empty history if no system prompt', async () => {
    const conversation = client.createConversation()
    await conversation.send('Hello')

    conversation.clear()

    expect(conversation.history).toEqual([])
  })

  it('throws ConcurrencyError if called during pending request', async () => {
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  id: 'test',
                  model: 'test',
                  choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
                  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                }),
              } as Response),
            100
          )
        )
    )

    const conversation = client.createConversation()
    const promise = conversation.send('Hello')

    expect(() => conversation.clear()).toThrow(ConcurrencyError)

    await promise
  })
})

describe('conversation.clearAll()', () => {
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

  it('clears all messages including system prompt', async () => {
    const conversation = client.createConversation({ system: 'Be helpful' })
    await conversation.send('Hello')

    conversation.clearAll()

    expect(conversation.history).toEqual([])
  })

  it('throws ConcurrencyError if called during pending request', async () => {
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  id: 'test',
                  model: 'test',
                  choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
                  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                }),
              } as Response),
            100
          )
        )
    )

    const conversation = client.createConversation()
    const promise = conversation.send('Hello')

    expect(() => conversation.clearAll()).toThrow(ConcurrencyError)

    await promise
  })
})
