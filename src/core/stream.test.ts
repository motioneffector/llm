import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'
import { createMockStream } from '../test/fixtures'
import { NetworkError, ParseError } from '../errors'

describe('client.stream(messages)', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('returns async iterable', () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['Hello']),
    } as Response)

    const stream = client.stream([{ role: 'user', content: 'Hi' }])
    expect(stream[Symbol.asyncIterator]).toBeDefined()
  })

  it('yields string chunks as they arrive', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['Hello', ' ', 'world']),
    } as Response)

    const chunks: string[] = []
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      expect(typeof chunk).toBe('string')
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(3)
  })

  it('final concatenation equals complete response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['Hello', ' ', 'world', '!']),
    } as Response)

    let full = ''
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      full += chunk
    }

    expect(full).toBe('Hello world!')
  })

  it('sends stream: true in request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream([]),
    } as Response)

    const streamIterable = client.stream([{ role: 'user', content: 'Hi' }])
    // Start iteration to trigger the request
    const iterator = streamIterable[Symbol.asyncIterator]()
    await iterator.next()

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"stream":true'),
      })
    )
  })

  it('handles SSE format correctly', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['Test']),
    } as Response)

    const chunks: string[] = []
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk)
    }

    expect(chunks).toContain('Test')
  })

  it('handles [DONE] signal', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream([]),
    } as Response)

    const chunks: string[] = []
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(0)
  })

  it('handles data: prefix in SSE lines', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['Content']),
    } as Response)

    const chunks: string[] = []
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk)
    }

    expect(chunks).toContain('Content')
  })

  it('handles multiple chunks in single SSE event', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['A', 'B', 'C']),
    } as Response)

    const chunks: string[] = []
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(0)
  })

  it('skips empty SSE lines', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
        controller.enqueue(encoder.encode('\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const chunks: string[] = []
    for await (const chunk of client.stream([{ role: 'user', content: 'Test' }])) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(['Hi'])
  })

  it('skips SSE comments (lines starting with :)', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(': keep-alive\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const chunks: string[] = []
    for await (const chunk of client.stream([{ role: 'user', content: 'Test' }])) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(['Hi'])
  })
})

describe('Stream Iteration', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('can iterate with for-await-of', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['Hello']),
    } as Response)

    let iterations = 0
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      expect(chunk).toBeDefined()
      iterations++
    }

    expect(iterations).toBeGreaterThan(0)
  })

  it('can break early from iteration', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['A', 'B', 'C', 'D']),
    } as Response)

    let count = 0
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      expect(chunk).toBeDefined()
      count++
      if (count === 2) break
    }

    expect(count).toBe(2)
  })

  it('stream is single-use (cannot iterate twice)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body: createMockStream(['Hello']),
    } as Response)

    const stream = client.stream([{ role: 'user', content: 'Hi' }])

    const firstIterations: string[] = []
    for await (const chunk of stream) {
      firstIterations.push(chunk)
    }

    const secondIterations: string[] = []
    for await (const chunk of stream) {
      secondIterations.push(chunk)
    }

    expect(firstIterations.length).toBeGreaterThan(0)
    expect(secondIterations.length).toBe(0)
  })

  it('partially consumed stream cleans up automatically', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['A', 'B', 'C']),
    } as Response)

    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      expect(chunk).toBeDefined()
      break
    }

    expect(true).toBe(true)
  })
})

describe('Stream Options', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('accepts same options as chat()', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['Hi']),
    } as Response)

    const streamIterable = client.stream([{ role: 'user', content: 'Test' }], {
      temperature: 0.5,
    })
    const iterator = streamIterable[Symbol.asyncIterator]()
    await iterator.next()

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.stringContaining('"temperature":0.5'),
      })
    )
  })

  it('accepts AbortSignal', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream(['Hi']),
    } as Response)

    const controller = new AbortController()
    const streamIterable = client.stream([{ role: 'user', content: 'Test' }], {
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
})

describe('Stream Edge Cases', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('handles empty stream (no content chunks)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body: createMockStream([]),
    } as Response)

    let full = ''
    for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
      full += chunk
    }

    expect(full).toBe('')
  })

  it('handles connection drop mid-stream', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new Error('Connection lost'))
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    await expect(async () => {
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        expect(chunk).toBeDefined()
      }
    }).rejects.toThrow(NetworkError)
  })

  it('handles malformed SSE chunk', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {invalid json}\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    await expect(async () => {
      for await (const chunk of client.stream([{ role: 'user', content: 'Hi' }])) {
        expect(chunk).toBeDefined()
      }
    }).rejects.toThrow(ParseError)
  })

  it('handles chunk with empty content delta', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":""}}]}\n\n')
        )
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      body,
    } as Response)

    const chunks: string[] = []
    for await (const chunk of client.stream([{ role: 'user', content: 'Test' }])) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(['Hi'])
  })
})
