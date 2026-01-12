import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'

describe('client.chat(messages, { signal })', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('accepts AbortSignal option', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response)

    const controller = new AbortController()
    await client.chat([{ role: 'user', content: 'Hello' }], { signal: controller.signal })

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        signal: controller.signal,
      })
    )
  })

  it('aborts in-flight request when signal fires', async () => {
    const controller = new AbortController()

    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          }, 50)
        })
    )

    setTimeout(() => controller.abort(), 25)

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { signal: controller.signal })
    ).rejects.toThrow()
  })

  it('throws AbortError when cancelled', async () => {
    const controller = new AbortController()

    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          }, 50)
        })
    )

    setTimeout(() => controller.abort(), 10)

    try {
      await client.chat([{ role: 'user', content: 'Hello' }], { signal: controller.signal })
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException)
      if (error instanceof DOMException) {
        expect(error.name).toBe('AbortError')
      }
    }
  })

  it('throws AbortError immediately for pre-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { signal: controller.signal })
    ).rejects.toThrow()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('AbortError includes abort reason if provided', async () => {
    const controller = new AbortController()
    const reason = new Error('User cancelled')

    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            const error = new DOMException('The operation was aborted', 'AbortError')
            // @ts-expect-error - Adding cause property
            error.cause = reason
            reject(error)
          }, 50)
        })
    )

    setTimeout(() => controller.abort(reason), 10)

    try {
      await client.chat([{ role: 'user', content: 'Hello' }], { signal: controller.signal })
      expect.fail('Should have thrown')
    } catch (error) {
      if (error instanceof DOMException) {
        // @ts-expect-error - Checking cause property
        expect(error.cause).toBe(reason)
      }
    }
  })
})

describe('client.stream(messages, { signal })', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('accepts AbortSignal option', async () => {
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

    const controller = new AbortController()
    const streamIterable = client.stream([{ role: 'user', content: 'Hello' }], {
      signal: controller.signal,
    })

    const iterator = streamIterable[Symbol.asyncIterator]()
    await iterator.next()

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        signal: controller.signal,
      })
    )
  })

  it('stops stream iteration when signal fires', async () => {
    const controller = new AbortController()
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(streamController) {
        streamController.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
        )
        setTimeout(() => {
          streamController.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n')
          )
          streamController.enqueue(encoder.encode('data: [DONE]\n\n'))
          streamController.close()
        }, 100)
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const chunks: string[] = []
    setTimeout(() => controller.abort(), 50)

    try {
      for await (const chunk of client.stream([{ role: 'user', content: 'Test' }], {
        signal: controller.signal,
      })) {
        chunks.push(chunk)
      }
    } catch (e) {
      // Expected abort error
    }

    expect(chunks.length).toBeGreaterThan(0)
  })

  it('throws AbortError when stream is aborted', async () => {
    const controller = new AbortController()
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(streamController) {
        streamController.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
        )
        setTimeout(() => {
          streamController.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n')
          )
          streamController.enqueue(encoder.encode('data: [DONE]\n\n'))
          streamController.close()
        }, 100)
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    setTimeout(() => controller.abort(), 30)

    try {
      for await (const chunk of client.stream([{ role: 'user', content: 'Test' }], {
        signal: controller.signal,
      })) {
        // consume chunks
      }
      expect.fail('Should have thrown AbortError')
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException)
      if (error instanceof DOMException) {
        expect(error.name).toBe('AbortError')
      }
    }
  })

  it('partially yielded content is available before abort', async () => {
    const controller = new AbortController()
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(streamController) {
        streamController.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
        )
        setTimeout(() => {
          streamController.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n')
          )
          streamController.enqueue(encoder.encode('data: [DONE]\n\n'))
          streamController.close()
        }, 100)
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const chunks: string[] = []
    let iterations = 0

    setTimeout(() => controller.abort(), 50)

    try {
      for await (const chunk of client.stream([{ role: 'user', content: 'Test' }], {
        signal: controller.signal,
      })) {
        chunks.push(chunk)
        iterations++
      }
    } catch (e) {
      // Expected abort
    }

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toBe('Hello')
  })

  it('throws immediately for pre-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()

    try {
      for await (const chunk of client.stream([{ role: 'user', content: 'Test' }], {
        signal: controller.signal,
      })) {
        expect.fail('Should not yield any chunks')
      }
      expect.fail('Should have thrown AbortError')
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException)
      if (error instanceof DOMException) {
        expect(error.name).toBe('AbortError')
      }
    }
  })
})

describe('Abort During Retry', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('aborts retry wait when signal fires', async () => {
    const controller = new AbortController()

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limited' } }),
      } as Response)
      .mockImplementation(
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
              2000
            )
          )
      )

    setTimeout(() => controller.abort(), 100)

    try {
      await client.chat([{ role: 'user', content: 'Test' }], { signal: controller.signal })
      expect.fail('Should have thrown AbortError')
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException)
      if (error instanceof DOMException) {
        expect(error.name).toBe('AbortError')
      }
    }
  })
})
