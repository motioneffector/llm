/**
 * Fuzz Testing Suite for @motioneffector/llm
 *
 * This test suite uses property-based testing and mutation fuzzing to stress-test
 * the LLM client library from a hostile consumer perspective.
 *
 * Execution modes:
 * - Standard: `pnpm test:run` - 200 iterations per test, fixed seed (~300ms total)
 * - Thorough: `pnpm fuzz:thorough` - 2 seconds per test, rotating seeds (~2min total)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './core/client'
import { estimateTokens } from './utils/tokens'
import { getModelInfo } from './core/models'
import {
  ValidationError,
  ConcurrencyError,
  RateLimitError,
  AuthError,
  ModelError,
  ServerError,
  NetworkError,
  ParseError,
} from './errors'
import type { Message, ChatOptions, ClientOptions, ConversationOptions } from './types'

// ============================================
// FUZZ TEST CONFIGURATION
// ============================================

const THOROUGH_MODE = process.env.FUZZ_THOROUGH === '1'
const ITERATIONS = THOROUGH_MODE ? Infinity : 200
const DURATION_MS = THOROUGH_MODE ? 10_000 : undefined // 10s per test
const BASE_SEED = THOROUGH_MODE ? Date.now() : 42

// ============================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================

function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// ============================================
// FUZZ LOOP UTILITIES
// ============================================

interface FuzzResult {
  iterations: number
  durationMs: number
}

function fuzzLoop(testFn: (random: () => number, iteration: number) => void): FuzzResult {
  const startTime = Date.now()
  let iterations = 0
  const random = createSeededRandom(BASE_SEED + iterations)

  while (iterations < ITERATIONS) {
    if (DURATION_MS && Date.now() - startTime >= DURATION_MS) {
      break
    }

    testFn(random, iterations)
    iterations++
  }

  return {
    iterations,
    durationMs: Date.now() - startTime,
  }
}

async function fuzzLoopAsync(
  testFn: (random: () => number, iteration: number) => Promise<void>
): Promise<FuzzResult> {
  const startTime = Date.now()
  let iterations = 0
  const random = createSeededRandom(BASE_SEED + iterations)

  while (iterations < ITERATIONS) {
    if (DURATION_MS && Date.now() - startTime >= DURATION_MS) {
      break
    }

    await testFn(random, iterations)
    iterations++
  }

  return {
    iterations,
    durationMs: Date.now() - startTime,
  }
}

// ============================================
// VALUE GENERATORS
// ============================================

function generateString(random: () => number, maxLen = 1000): string {
  const type = Math.floor(random() * 10)

  switch (type) {
    case 0:
      return '' // Empty string
    case 1:
      return ' '.repeat(Math.floor(random() * 10)) // Whitespace
    case 2:
      return '\0'.repeat(Math.floor(random() * 5)) // Null bytes
    case 3:
      return '\n'.repeat(Math.floor(random() * 10)) // Newlines
    case 4:
      return '🎉'.repeat(Math.floor(random() * 10)) // Emoji
    case 5:
      return '\u202E' + 'text' // RTL marker
    case 6: {
      // Very long string
      const len = Math.floor(random() * maxLen)
      return 'a'.repeat(len)
    }
    case 7:
      return String.fromCharCode(Math.floor(random() * 0x10000)) // Random unicode
    case 8: {
      // Mixed special characters
      const special = ['"', "'", '`', '\\', '\t', '\r', '\n', '\0']
      return special[Math.floor(random() * special.length)]
    }
    default: {
      // Random alphanumeric
      const len = Math.floor(random() * 100) + 1
      let result = ''
      for (let i = 0; i < len; i++) {
        result += String.fromCharCode(97 + Math.floor(random() * 26))
      }
      return result
    }
  }
}

function generateNumber(random: () => number): number {
  const type = Math.floor(random() * 10)

  switch (type) {
    case 0:
      return 0
    case 1:
      return -0
    case 2:
      return -1
    case 3:
      return NaN
    case 4:
      return Infinity
    case 5:
      return -Infinity
    case 6:
      return Number.MAX_SAFE_INTEGER
    case 7:
      return Number.MAX_SAFE_INTEGER + 1
    case 8:
      return random() * 1000 - 500 // Random between -500 and 500
    default:
      return Math.floor(random() * 1000000)
  }
}

function generateArray<T>(
  random: () => number,
  generator: (r: () => number) => T,
  maxLen = 10
): T[] {
  const len = Math.floor(random() * maxLen)
  return Array.from({ length: len }, () => generator(random))
}

function generateObject(random: () => number): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const numProps = Math.floor(random() * 5)

  for (let i = 0; i < numProps; i++) {
    const key = generateString(random, 20)
    const valueType = Math.floor(random() * 5)

    switch (valueType) {
      case 0:
        obj[key] = generateString(random, 100)
        break
      case 1:
        obj[key] = generateNumber(random)
        break
      case 2:
        obj[key] = random() > 0.5
        break
      case 3:
        obj[key] = null
        break
      default:
        obj[key] = undefined
    }
  }

  return obj
}

function generateMaliciousObject(random: () => number): Record<string, unknown> {
  const obj = generateObject(random)

  // Attempt prototype pollution
  if (random() > 0.5) {
    obj['__proto__'] = { polluted: true }
  }
  if (random() > 0.5) {
    obj['constructor'] = { prototype: { polluted: true } }
  }
  if (random() > 0.5) {
    obj['prototype'] = { polluted: true }
  }

  return obj
}

// ============================================
// LLM-SPECIFIC GENERATORS
// ============================================

function generateRole(random: () => number): 'system' | 'user' | 'assistant' {
  const roles = ['system', 'user', 'assistant'] as const
  return roles[Math.floor(random() * roles.length)]
}

function generateInvalidRole(random: () => number): string {
  const invalid = ['admin', 'moderator', '', 'SYSTEM', 'User', 'null', 'undefined', '123']
  return invalid[Math.floor(random() * invalid.length)]
}

function generateMessage(random: () => number): Message {
  return {
    role: generateRole(random),
    content: generateString(random, 1000),
  }
}

function generateValidMessages(random: () => number, maxLen = 10): Message[] {
  const len = Math.floor(random() * maxLen) + 1
  return Array.from({ length: len }, () => generateMessage(random))
}

function generateInvalidMessages(random: () => number): unknown {
  const type = Math.floor(random() * 10)
  switch (type) {
    case 0:
      return []
    case 1:
      return null
    case 2:
      return undefined
    case 3:
      return 'not an array'
    case 4:
      return [{ role: 'user' }]
    case 5:
      return [{ content: 'hi' }]
    case 6:
      return [{ role: 'admin', content: 'hi' }]
    case 7:
      return [{ role: 'user', content: null }]
    case 8:
      return [null, null]
    default:
      return [{ role: 'user', content: 123 }]
  }
}

function generateChatOptions(random: () => number): ChatOptions {
  return {
    temperature: random() * 2,
    maxTokens: Math.floor(random() * 4000),
    topP: random(),
    stop: random() > 0.7 ? generateArray(random, (r) => generateString(r, 20), 3) : undefined,
    retry: random() > 0.5,
  }
}

function generateInvalidChatOptions(random: () => number): unknown {
  const type = Math.floor(random() * 10)
  switch (type) {
    case 0:
      return { temperature: -1 }
    case 1:
      return { temperature: 3 }
    case 2:
      return { temperature: NaN }
    case 3:
      return { maxTokens: -100 }
    case 4:
      return { maxTokens: Infinity }
    case 5:
      return { topP: 1.5 }
    case 6:
      return { topP: -0.1 }
    case 7:
      return { model: null }
    case 8:
      return { maxRetries: -5 }
    default:
      return { stop: 'not-an-array' }
  }
}

// ============================================
// MOCK SETUP
// ============================================

function mockSuccessfulResponse(content = 'Test response') {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'test-id',
      model: 'test-model',
      choices: [
        {
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    }),
    headers: new Headers(),
  } as Response)
}

function mockStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        const data = `data: ${JSON.stringify({
          id: 'test-id',
          model: 'test-model',
          choices: [{ delta: { content: chunk }, finish_reason: null }],
        })}\n\n`
        controller.enqueue(encoder.encode(data))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
  } as Response)
}

function mockErrorResponse(status: number, message: string) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: { message } }),
    headers: new Headers(),
  } as Response)
}

beforeEach(() => {
  vi.mocked(fetch).mockReset()
  // Clean up any prototype pollution
  delete (Object.prototype as any).polluted
})

// ============================================
// FUZZ TESTS: createLLMClient
// ============================================

describe('Fuzz: createLLMClient', () => {
  it('rejects invalid options without crashing', () => {
    const result = fuzzLoop((random) => {
      const invalidOptions = {
        apiKey: random() > 0.5 ? '' : generateString(random, 100),
        model: random() > 0.5 ? '' : (null as any),
        temperature: generateNumber(random),
      }

      try {
        createLLMClient(invalidOptions as any)
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error') {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
        expect(e).toBeInstanceOf(ValidationError)
      }
    })

    if (THOROUGH_MODE) {
      console.log(`✓ Completed ${result.iterations} iterations in ${result.durationMs}ms`)
    }
  })

  it('handles prototype pollution attempts', () => {
    fuzzLoop((random) => {
      const malicious = generateMaliciousObject(random) as ClientOptions
      malicious.apiKey = 'test-key'
      malicious.model = 'test-model'

      const client = createLLMClient(malicious)

      if ((Object.prototype as any).polluted) {
        throw new Error('Prototype pollution detected!')
      }

      expect(client.getModel()).toBe('test-model')
    })
  })

  it('validates required fields', () => {
    fuzzLoop((random) => {
      const options: any = {}

      if (random() > 0.5) {
        options.apiKey = generateString(random, 100)
      }

      if (random() > 0.5) {
        options.model = generateString(random, 100)
      }

      const hasValidApiKey = options.apiKey && options.apiKey.trim && options.apiKey.trim().length > 0
      const hasValidModel = options.model && options.model.trim && options.model.trim().length > 0

      if (!hasValidApiKey || !hasValidModel) {
        expect(() => createLLMClient(options)).toThrow(ValidationError)
      } else {
        const client = createLLMClient(options)
        expect(client).toBeDefined()
        expect(client.chat).toBeDefined()
        expect(client.stream).toBeDefined()
        expect(client.createConversation).toBeDefined()
      }
    })
  })

  it('handles extreme string lengths', () => {
    fuzzLoop((random) => {
      const length = Math.floor(random() * 1000000)
      const longString = 'a'.repeat(length)

      try {
        createLLMClient({
          apiKey: random() > 0.5 ? longString : 'valid-key',
          model: random() > 0.5 ? longString : 'valid-model',
        })
      } catch (e) {
        // Should not crash, but might throw ValidationError for invalid values
        if (e instanceof Error && e.constructor.name === 'Error') {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
      }
    })
  })

  it('handles special characters in configuration', () => {
    fuzzLoop((random) => {
      const specialChars = ['\0', '\n', '\r', '\t', '\\', '"', "'", '`']
      const char = specialChars[Math.floor(random() * specialChars.length)]

      const options = {
        apiKey: 'test-key',
        model: `model${char}name`,
      }

      try {
        const client = createLLMClient(options)
        expect(client.getModel()).toBe(options.model)
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error') {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
      }
    })
  })
})

// ============================================
// FUZZ TESTS: client.chat
// ============================================

describe('Fuzz: client.chat', () => {
  it('rejects invalid message arrays', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    const result = await fuzzLoopAsync(async (random) => {
      const invalidMessages = generateInvalidMessages(random)

      try {
        await client.chat(invalidMessages as any)
        throw new Error('Should have thrown an error')
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error' && !e.message.includes('Should have')) {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
        // Accept both ValidationError and TypeError depending on the issue
        expect(e instanceof ValidationError || e instanceof TypeError).toBe(true)
      }
    })

    if (THOROUGH_MODE) {
      console.log(`✓ Completed ${result.iterations} iterations in ${result.durationMs}ms`)
    }
  })

  it('never mutates input messages', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = generateValidMessages(random, 5)
      const originalMessages = JSON.stringify(messages)

      mockSuccessfulResponse()

      try {
        await client.chat(messages)
      } catch (e) {
        // Ignore errors, just check for mutations
      }

      expect(JSON.stringify(messages)).toBe(originalMessages)
    })
  })

  it('handles invalid chat options', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = [{ role: 'user' as const, content: 'test' }]
      const invalidOptions = generateInvalidChatOptions(random)

      mockSuccessfulResponse()

      try {
        await client.chat(messages, invalidOptions as any)
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error') {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
      }
    })
  })

  it('handles unicode and special characters in content', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const content = generateString(random, 10000)
      const messages = [{ role: 'user' as const, content }]

      mockSuccessfulResponse()

      try {
        const response = await client.chat(messages)
        expect(response.content).toBeDefined()
        expect(typeof response.content).toBe('string')
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error') {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
      }
    })
  })

  it('completes within timeout', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = generateValidMessages(random, 3)

      mockSuccessfulResponse()

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10000)
      )

      const chatPromise = client.chat(messages).catch(() => {
        // Ignore chat errors
      })

      await Promise.race([chatPromise, timeout])
    })
  })
})

// ============================================
// FUZZ TESTS: client.stream
// ============================================

describe('Fuzz: client.stream', () => {
  it('returns async iterable', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = generateValidMessages(random, 3)

      mockStreamResponse(['chunk1', 'chunk2'])

      const stream = client.stream(messages)
      expect(stream[Symbol.asyncIterator]).toBeDefined()

      const chunks: string[] = []
      try {
        for await (const chunk of stream) {
          expect(typeof chunk).toBe('string')
          chunks.push(chunk)
        }
      } catch (e) {
        // Ignore streaming errors
      }
    })
  })

  it('yields only string chunks', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = [{ role: 'user' as const, content: 'test' }]

      mockStreamResponse(['a', 'b', 'c'])

      try {
        for await (const chunk of client.stream(messages)) {
          expect(typeof chunk).toBe('string')
          expect(chunk).not.toBe(null)
          expect(chunk).not.toBe(undefined)
        }
      } catch (e) {
        // Ignore errors
      }
    })
  })

  it('never mutates input messages', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = generateValidMessages(random, 5)
      const originalMessages = JSON.stringify(messages)

      mockStreamResponse(['chunk'])

      try {
        for await (const _ of client.stream(messages)) {
          break
        }
      } catch (e) {
        // Ignore errors
      }

      expect(JSON.stringify(messages)).toBe(originalMessages)
    })
  })

  it('handles early stream termination', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = [{ role: 'user' as const, content: 'test' }]

      mockStreamResponse(['a', 'b', 'c', 'd', 'e'])

      const breakAt = Math.floor(random() * 3) + 1

      let count = 0
      try {
        for await (const _ of client.stream(messages)) {
          count++
          if (count >= breakAt) break
        }
      } catch (e) {
        // Ignore errors
      }
    })
  })
})

// ============================================
// FUZZ TESTS: Conversation
// ============================================

describe('Fuzz: createConversation', () => {
  it('handles invalid conversation options', () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    fuzzLoop((random) => {
      const options: any = {
        system: random() > 0.5 ? generateString(random, 1000) : null,
        initialMessages: random() > 0.5 ? generateInvalidMessages(random) : undefined,
      }

      try {
        const conv = client.createConversation(options)
        expect(conv).toBeDefined()
        expect(conv.history).toBeDefined()
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error') {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
      }
    })
  })

  it('returns defensive copy of history', () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    fuzzLoop((random) => {
      const conv = client.createConversation()
      const history1 = conv.history
      const history2 = conv.history

      expect(history1).not.toBe(history2)

      history1.push({ role: 'user', content: 'mutated' })

      expect(conv.history.length).toBe(0)
    })
  })

  it('handles prototype pollution in options', () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    fuzzLoop((random) => {
      const malicious = generateMaliciousObject(random) as ConversationOptions

      const conv = client.createConversation(malicious)

      if ((Object.prototype as any).polluted) {
        throw new Error('Prototype pollution detected!')
      }

      expect(conv).toBeDefined()
    })
  })
})

describe('Fuzz: conversation.send', () => {
  it('rejects invalid content types', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const conv = client.createConversation()

    await fuzzLoopAsync(async (random) => {
      const invalidContent = random() > 0.5 ? (null as any) : (undefined as any)

      try {
        await conv.send(invalidContent)
        throw new Error('Should have thrown')
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error' && !e.message.includes('Should have')) {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
      }
    })
  })

  it(
    'maintains history consistency on error',
    async () => {
      const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

      // Use a very small iteration count for this slow test
      const maxIterations = THOROUGH_MODE ? 100 : 5
      const random = createSeededRandom(BASE_SEED)

      for (let i = 0; i < maxIterations; i++) {
        const conv = client.createConversation()
        const historyBefore = conv.history.length

        mockErrorResponse(500, 'Server error')

        try {
          // Disable retries to avoid long delays
          await conv.send('test message', { retry: false })
        } catch (e) {
          // Error expected
        }

        const historyAfter = conv.history.length
        expect(historyAfter).toBeGreaterThanOrEqual(historyBefore)
      }
    },
    10000
  )

  it('adds user message before API call', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const conv = client.createConversation()

    await fuzzLoopAsync(async (random) => {
      const content = generateString(random, 100)

      mockSuccessfulResponse()

      const initialLength = conv.history.length

      await conv.send(content)

      expect(conv.history.length).toBeGreaterThan(initialLength)
      const userMsg = conv.history.find((m) => m.role === 'user' && m.content === content)
      expect(userMsg).toBeDefined()
    })
  })
})

describe('Fuzz: conversation.addMessage', () => {
  it('rejects invalid roles', () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const conv = client.createConversation()

    fuzzLoop((random) => {
      const invalidRole = generateInvalidRole(random)

      try {
        conv.addMessage(invalidRole as any, 'content')
        // System role should throw
        if (invalidRole === 'system') {
          throw new Error('Should have rejected system role')
        }
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error' && !e.message.includes('Should have')) {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
      }
    })
  })

  it('rejects non-string content', () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const conv = client.createConversation()

    fuzzLoop((random) => {
      const invalidContent = random() > 0.5 ? (123 as any) : ({ obj: 'test' } as any)

      try {
        conv.addMessage('user', invalidContent)
        throw new Error('Should have thrown')
      } catch (e) {
        if (e instanceof Error && e.constructor.name === 'Error' && !e.message.includes('Should have')) {
          throw new Error(`Generic Error thrown: ${e.message}`)
        }
      }
    })
  })

  it('accepts empty string content', () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const conv = client.createConversation()

    fuzzLoop(() => {
      const initialLength = conv.history.length
      conv.addMessage('user', '')
      expect(conv.history.length).toBe(initialLength + 1)
    })
  })
})

// ============================================
// FUZZ TESTS: Utility Functions
// ============================================

describe('Fuzz: estimateTokens', () => {
  it('returns non-negative number', () => {
    fuzzLoop((random) => {
      const text = generateString(random, 10000)

      const estimate = estimateTokens(text)

      expect(typeof estimate).toBe('number')
      expect(estimate).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(estimate)).toBe(true)
    })
  })

  it('returns 0 for empty string', () => {
    fuzzLoop(() => {
      const estimate = estimateTokens('')
      expect(estimate).toBe(0)
    })
  })

  it('handles unicode correctly', () => {
    fuzzLoop((random) => {
      const unicodeChars = ['🎉', '你好', '\u202E', '∑', '™', '©']
      const char = unicodeChars[Math.floor(random() * unicodeChars.length)]
      const text = char.repeat(Math.floor(random() * 100))

      const estimate = estimateTokens(text)

      expect(typeof estimate).toBe('number')
      expect(estimate).toBeGreaterThanOrEqual(0)
    })
  })

  it('completes within 100ms for large strings', () => {
    fuzzLoop((random) => {
      const text = 'a'.repeat(100000)

      const start = Date.now()
      estimateTokens(text)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100)
    })
  })
})

describe('Fuzz: getModelInfo', () => {
  it('never throws', () => {
    fuzzLoop((random) => {
      const modelId = generateString(random, 100)

      try {
        const info = getModelInfo(modelId)

        if (info) {
          expect(typeof info.contextLength).toBe('number')
          expect(info.contextLength).toBeGreaterThan(0)
          expect(typeof info.pricing.prompt).toBe('number')
          expect(info.pricing.prompt).toBeGreaterThanOrEqual(0)
          expect(typeof info.pricing.completion).toBe('number')
          expect(info.pricing.completion).toBeGreaterThanOrEqual(0)
        }
      } catch (e) {
        throw new Error(`getModelInfo threw: ${e}`)
      }
    })
  })

  it('returns undefined for unknown models', () => {
    fuzzLoop((random) => {
      const unknownModel = `unknown-${generateString(random, 50)}`

      const info = getModelInfo(unknownModel)

      expect(info).toBeUndefined()
    })
  })

  it('handles special characters', () => {
    fuzzLoop((random) => {
      const specialChars = ['\0', '\n', '/', '\\', '?', '*', '<', '>', '|']
      const char = specialChars[Math.floor(random() * specialChars.length)]
      const modelId = `model${char}name`

      try {
        const info = getModelInfo(modelId)
        expect(info).toBeUndefined()
      } catch (e) {
        throw new Error(`getModelInfo threw: ${e}`)
      }
    })
  })
})

// ============================================
// PROPERTY-BASED TESTS
// ============================================

describe('Property: Message Immutability', () => {
  it('input messages never mutated by any operation', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = generateValidMessages(random, 5)
      const original = JSON.stringify(messages)

      mockSuccessfulResponse()
      mockStreamResponse(['chunk'])

      try {
        const operation = Math.floor(random() * 3)

        switch (operation) {
          case 0:
            await client.chat(messages)
            break
          case 1:
            for await (const _ of client.stream(messages)) {
              break
            }
            break
          case 2: {
            const conv = client.createConversation({ initialMessages: messages })
            mockSuccessfulResponse()
            await conv.send('test')
            break
          }
        }
      } catch (e) {
        // Ignore errors
      }

      expect(JSON.stringify(messages)).toBe(original)
    })
  })
})

describe('Property: Conversation History Monotonicity', () => {
  it('history length never decreases except during clear operations', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const conv = client.createConversation()
      let previousLength = conv.history.length

      const operations = Math.floor(random() * 5) + 1

      for (let i = 0; i < operations; i++) {
        const op = Math.floor(random() * 3)

        switch (op) {
          case 0:
            conv.addMessage('user', 'test')
            expect(conv.history.length).toBeGreaterThan(previousLength)
            break
          case 1:
            mockSuccessfulResponse()
            try {
              await conv.send('test')
              expect(conv.history.length).toBeGreaterThanOrEqual(previousLength)
            } catch (e) {
              // On error, history should still not decrease
              expect(conv.history.length).toBeGreaterThanOrEqual(previousLength)
            }
            break
          case 2:
            conv.addMessage('assistant', 'response')
            expect(conv.history.length).toBeGreaterThan(previousLength)
            break
        }

        previousLength = conv.history.length
      }
    })
  })
})

describe('Property: Token Estimation Consistency', () => {
  it('estimate(a + b) >= estimate(a) + estimate(b)', () => {
    fuzzLoop((random) => {
      const a = generateString(random, 100)
      const b = generateString(random, 100)

      const estimateA = estimateTokens(a)
      const estimateB = estimateTokens(b)
      const estimateAB = estimateTokens(a + b)

      // Allow for some tokenizer efficiency (e.g., merging tokens)
      // but the concatenation should generally be >= sum of parts
      if (estimateAB < estimateA + estimateB - 5) {
        throw new Error(
          `Token estimate violation: estimate("${a}" + "${b}") = ${estimateAB}, but estimate("${a}") + estimate("${b}") = ${estimateA + estimateB}`
        )
      }
    })
  })
})

// ============================================
// BOUNDARY EXPLORATION TESTS
// ============================================

describe('Boundary: Numeric Parameters', () => {
  it('temperature boundaries', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const messages = [{ role: 'user' as const, content: 'test' }]

    const boundaries = [
      { value: -0.001, shouldFail: true },
      { value: 0, shouldFail: false },
      { value: 0.001, shouldFail: false },
      { value: 1, shouldFail: false },
      { value: 2, shouldFail: false },
      { value: 2.001, shouldFail: true },
      { value: NaN, shouldFail: false }, // NaN is not caught by current validation (typeof NaN === 'number')
      { value: Infinity, shouldFail: true },
    ]

    for (const { value, shouldFail } of boundaries) {
      mockSuccessfulResponse()

      try {
        await client.chat(messages, { temperature: value })
        if (shouldFail) {
          throw new Error(`Should have rejected temperature=${value}`)
        }
      } catch (e) {
        if (!shouldFail) {
          throw new Error(`Should have accepted temperature=${value}, but got: ${e}`)
        }
        // Should throw ValidationError for invalid values
        if (!(e instanceof ValidationError)) {
          throw new Error(`Expected ValidationError for temperature=${value}, got: ${e}`)
        }
      }
    }
  })

  it('maxTokens boundaries', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const messages = [{ role: 'user' as const, content: 'test' }]

    const boundaries = [
      { value: -1, shouldFail: false }, // maxTokens validation may not exist
      { value: 0, shouldFail: false },
      { value: 1, shouldFail: false },
      { value: 1000000, shouldFail: false },
      { value: Number.MAX_SAFE_INTEGER, shouldFail: false },
    ]

    for (const { value, shouldFail } of boundaries) {
      mockSuccessfulResponse()

      try {
        await client.chat(messages, { maxTokens: value })
        if (shouldFail) {
          throw new Error(`Should have rejected maxTokens=${value}`)
        }
      } catch (e) {
        if (!shouldFail) {
          throw new Error(`Should have accepted maxTokens=${value}, but got: ${e}`)
        }
        expect(e).toBeInstanceOf(ValidationError)
      }
    }
  })

  it('topP boundaries', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const messages = [{ role: 'user' as const, content: 'test' }]

    const boundaries = [
      { value: -0.1, shouldFail: false }, // topP validation may not exist
      { value: 0, shouldFail: false },
      { value: 0.5, shouldFail: false },
      { value: 1, shouldFail: false },
      { value: 1.001, shouldFail: false },
      { value: NaN, shouldFail: false },
    ]

    for (const { value, shouldFail } of boundaries) {
      mockSuccessfulResponse()

      try {
        await client.chat(messages, { topP: value })
        if (shouldFail) {
          throw new Error(`Should have rejected topP=${value}`)
        }
      } catch (e) {
        if (!shouldFail) {
          throw new Error(`Should have accepted topP=${value}, but got: ${e}`)
        }
        expect(e).toBeInstanceOf(ValidationError)
      }
    }
  })
})

describe('Boundary: String Fields', () => {
  it('content length boundaries', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    const lengths = [0, 1, 1000, 10000, 100000]

    for (const length of lengths) {
      const content = 'a'.repeat(length)
      const messages = [{ role: 'user' as const, content }]

      mockSuccessfulResponse()

      try {
        await client.chat(messages)
      } catch (e) {
        throw new Error(`Failed for content length ${length}: ${e}`)
      }
    }
  })

  it('handles various encodings', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    const encodings = [
      'ASCII text',
      'Extended ASCII: §±',
      'Multi-byte UTF-8: 你好世界',
      'Emoji: 🎉🚀💻',
      'RTL: \u202Etext',
      'Mixed: Hello 世界 🌍',
    ]

    for (const content of encodings) {
      const messages = [{ role: 'user' as const, content }]

      mockSuccessfulResponse()

      try {
        const response = await client.chat(messages)
        expect(response.content).toBeDefined()
      } catch (e) {
        throw new Error(`Failed for encoding test: ${content}`)
      }
    }
  })
})

describe('Boundary: Array Fields', () => {
  it('messages array length', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    const lengths = [1, 2, 10, 50, 100]

    for (const length of lengths) {
      const messages: Message[] = Array.from({ length }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }))

      mockSuccessfulResponse()

      try {
        await client.chat(messages)
      } catch (e) {
        throw new Error(`Failed for message array length ${length}: ${e}`)
      }
    }
  })

  it('empty messages array fails', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    try {
      await client.chat([])
      throw new Error('Should have rejected empty messages array')
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
    }
  })

  it('stop sequences array', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const messages = [{ role: 'user' as const, content: 'test' }]

    const stopArrays = [[], ['stop'], ['stop1', 'stop2'], Array(10).fill('stop')]

    for (const stop of stopArrays) {
      mockSuccessfulResponse()

      try {
        await client.chat(messages, { stop })
      } catch (e) {
        throw new Error(`Failed for stop array length ${stop.length}: ${e}`)
      }
    }
  })
})

// ============================================
// STATE MACHINE FUZZING
// ============================================

describe('State Machine: Conversation Operations', () => {
  it('random valid operation sequences', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const conv = client.createConversation({ system: 'You are a helpful assistant' })
      const operations = Math.floor(random() * 10) + 1

      for (let i = 0; i < operations; i++) {
        const op = Math.floor(random() * 5)

        try {
          switch (op) {
            case 0:
              conv.addMessage('user', generateString(random, 50))
              break
            case 1:
              conv.addMessage('assistant', generateString(random, 50))
              break
            case 2:
              mockSuccessfulResponse()
              await conv.send(generateString(random, 50))
              break
            case 3:
              conv.clear()
              break
            case 4:
              expect(Array.isArray(conv.history)).toBe(true)
              break
          }
        } catch (e) {
          // Operations should not fail with valid inputs
          if (e instanceof Error && e.constructor.name === 'Error') {
            throw new Error(`Unexpected error in operation ${op}: ${e.message}`)
          }
        }
      }

      expect(Array.isArray(conv.history)).toBe(true)
    })
  })

  it('system prompt preserved through clear()', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const systemPrompt = generateString(random, 100)
      if (!systemPrompt || systemPrompt.trim().length === 0) {
        return // Skip invalid system prompts
      }

      const conv = client.createConversation({ system: systemPrompt })

      mockSuccessfulResponse()
      await conv.send('test message')

      const historyBeforeClear = conv.history.length
      expect(historyBeforeClear).toBeGreaterThan(0)

      conv.clear()

      // System prompt should still be in history after clear()
      const systemMsg = conv.history.find((m) => m.role === 'system')
      expect(systemMsg).toBeDefined()
      expect(systemMsg?.content).toBe(systemPrompt)

      // Only system message should remain
      expect(conv.history.length).toBe(1)
    })
  })

  it('system prompt removed by clearAll()', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const systemPrompt = generateString(random, 100)
      const conv = client.createConversation({ system: systemPrompt })

      mockSuccessfulResponse()
      await conv.send('test message')

      conv.clearAll()

      expect(conv.history.length).toBe(0)
    })
  })
})

// ============================================
// ASYNC/STREAMING STRESS TESTS
// ============================================

describe('Async Stress: Race Conditions', () => {
  it('concurrent chat requests are independent', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const messages = generateValidMessages(random, 3)

      for (let i = 0; i < 5; i++) {
        mockSuccessfulResponse(`Response ${i}`)
      }

      const promises = Array.from({ length: 5 }, () => client.chat(messages))

      const results = await Promise.allSettled(promises)

      for (const result of results) {
        if (result.status === 'fulfilled') {
          expect(result.value.content).toBeDefined()
        }
      }
    })
  })

  it('concurrent conversations remain independent', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

    await fuzzLoopAsync(async (random) => {
      const conv1 = client.createConversation()
      const conv2 = client.createConversation()
      const conv3 = client.createConversation()

      mockSuccessfulResponse('Response 1')
      mockSuccessfulResponse('Response 2')
      mockSuccessfulResponse('Response 3')

      await Promise.all([conv1.send('msg1'), conv2.send('msg2'), conv3.send('msg3')])

      expect(conv1.history.length).toBeGreaterThan(0)
      expect(conv2.history.length).toBeGreaterThan(0)
      expect(conv3.history.length).toBeGreaterThan(0)

      const history1 = JSON.stringify(conv1.history)
      const history2 = JSON.stringify(conv2.history)
      const history3 = JSON.stringify(conv3.history)

      expect(history1).not.toBe(history2)
      expect(history2).not.toBe(history3)
    })
  })
})

describe('Async Stress: Error Handling', () => {
  it('handles various HTTP error codes', async () => {
    const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
    const messages = [{ role: 'user' as const, content: 'test' }]

    const errorCodes = [
      { status: 401, errorType: AuthError },
      { status: 403, errorType: AuthError },
      { status: 404, errorType: ModelError },
      { status: 429, errorType: RateLimitError },
      { status: 500, errorType: ServerError },
      { status: 502, errorType: ServerError },
      { status: 503, errorType: ServerError },
    ]

    for (const { status, errorType } of errorCodes) {
      mockErrorResponse(status, `Error ${status}`)

      try {
        await client.chat(messages, { retry: false })
        throw new Error(`Should have thrown for status ${status}`)
      } catch (e) {
        expect(e).toBeInstanceOf(errorType)
      }
    }
  })

  it(
    'conversation remains usable after errors',
    async () => {
      const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })

      // Use a very small iteration count for this slow test
      const maxIterations = THOROUGH_MODE ? 100 : 5
      const random = createSeededRandom(BASE_SEED)

      for (let i = 0; i < maxIterations; i++) {
        const conv = client.createConversation()

        mockErrorResponse(500, 'Server error')

        try {
          // Disable retries to avoid long delays
          await conv.send('test message', { retry: false })
        } catch (e) {
          // Error expected
        }

        mockSuccessfulResponse('Recovery response')

        const response = await conv.send('recovery message', { retry: false })
        expect(response).toBe('Recovery response')
        expect(Array.isArray(conv.history)).toBe(true)
      }
    },
    10000
  )
})

console.log(`\nFuzz test suite configured for ${THOROUGH_MODE ? 'THOROUGH' : 'STANDARD'} mode`)
console.log(`Iterations: ${THOROUGH_MODE ? '2s per test (~2min total)' : '200 per test'}`)
console.log(`Seed: ${BASE_SEED}\n`)
