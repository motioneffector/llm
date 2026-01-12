import type {
  ClientOptions,
  LLMClient,
  Message,
  ChatOptions,
  ChatResponse,
  ConversationOptions,
  Conversation,
  GenerationParams,
} from '../types'
import { ValidationError, ParseError } from '../errors'
import { fetchWithRetry, parseJsonResponse } from './http'
import { parseSSEStream } from './stream'
import { createConversation } from './conversation'
import { estimateTokens } from '../utils/tokens'
import { getModelInfo } from './models'

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_MAX_RETRIES = 3

interface OpenRouterResponse {
  id: string
  model: string
  choices: Array<{
    message: {
      content: string | null
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  } | null
}

function validateClientOptions(options: ClientOptions): void {
  if (!options.apiKey || options.apiKey.trim() === '') {
    throw new ValidationError('apiKey is required and cannot be empty', 'apiKey')
  }

  if (!options.model || options.model.trim() === '') {
    throw new ValidationError('model is required and cannot be empty', 'model')
  }
}

function validateMessages(messages: Message[]): void {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ValidationError('messages array cannot be empty', 'messages')
  }

  for (const message of messages) {
    if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
      throw new ValidationError(
        `Invalid message role: ${message.role}. Must be 'system', 'user', or 'assistant'.`,
        'role'
      )
    }

    if (typeof message.content !== 'string') {
      throw new TypeError('Message content must be a string')
    }
  }
}

function validateChatOptions(options?: ChatOptions): void {
  if (!options) return

  if (options.temperature !== undefined) {
    if (
      typeof options.temperature !== 'number' ||
      options.temperature < 0 ||
      options.temperature > 2
    ) {
      throw new ValidationError('temperature must be between 0 and 2', 'temperature')
    }
  }
}

function mergeParams(
  defaultParams: GenerationParams | undefined,
  options: ChatOptions | undefined
): GenerationParams {
  const merged: GenerationParams = { ...defaultParams }

  if (options) {
    if (options.temperature !== undefined) merged.temperature = options.temperature
    if (options.maxTokens !== undefined) merged.maxTokens = options.maxTokens
    if (options.topP !== undefined) merged.topP = options.topP
    if (options.stop !== undefined) merged.stop = options.stop
  }

  return merged
}

function buildRequestBody(
  messages: Message[],
  model: string,
  params: GenerationParams,
  stream: boolean
): string {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream,
  }

  if (params.temperature !== undefined) body.temperature = params.temperature
  if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens
  if (params.topP !== undefined) body.top_p = params.topP
  if (params.stop !== undefined) body.stop = params.stop

  return JSON.stringify(body)
}

function isOpenRouter(baseUrl: string): boolean {
  return baseUrl.includes('openrouter')
}

/**
 * Creates a new LLM client instance.
 *
 * The client provides methods for sending chat completions, streaming responses,
 * and managing conversations. It handles authentication, retries, and error handling.
 *
 * @param options - Configuration options for the client
 * @returns An LLM client with chat, stream, and conversation methods
 *
 * @example
 * ```typescript
 * const client = createLLMClient({
 *   apiKey: 'your-openrouter-key',
 *   model: 'anthropic/claude-sonnet-4'
 * })
 *
 * // Send a chat completion
 * const response = await client.chat([
 *   { role: 'user', content: 'Explain quantum computing' }
 * ])
 * console.log(response.content)
 * ```
 *
 * @example
 * ```typescript
 * // With custom parameters
 * const client = createLLMClient({
 *   apiKey: process.env.OPENROUTER_KEY,
 *   model: 'anthropic/claude-sonnet-4',
 *   defaultParams: {
 *     temperature: 0.7,
 *     maxTokens: 1000
 *   }
 * })
 * ```
 *
 * @throws {ValidationError} If apiKey or model is missing or invalid
 */
export function createLLMClient(options: ClientOptions): LLMClient {
  validateClientOptions(options)

  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const apiKey = options.apiKey
  let currentModel = options.model
  const defaultParams = options.defaultParams
  const referer = options.referer ?? 'https://github.com/motioneffector/llm'
  const title = options.title ?? 'LLM Client'

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    if (isOpenRouter(baseUrl)) {
      headers['HTTP-Referer'] = referer
      headers['X-Title'] = title
    }

    return headers
  }

  function buildUrl(): string {
    const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    return `${url}/chat/completions`
  }

  /**
   * Send a chat completion request and wait for the full response.
   *
   * @param messages - Array of messages forming the conversation
   * @param chatOptions - Optional parameters for this request
   * @returns A promise that resolves to the chat response with content, usage, and metadata
   *
   * @example
   * ```typescript
   * const response = await client.chat([
   *   { role: 'user', content: 'Write a haiku about TypeScript' }
   * ])
   * console.log(response.content)
   * console.log(`Used ${response.usage.totalTokens} tokens`)
   * ```
   *
   * @example
   * ```typescript
   * // With custom options
   * const response = await client.chat(
   *   [{ role: 'user', content: 'Explain recursion' }],
   *   { temperature: 0.3, maxTokens: 500 }
   * )
   * ```
   *
   * @throws {ValidationError} If messages array is empty or contains invalid messages
   * @throws {AuthError} If API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {ModelError} If model is unavailable or invalid
   * @throws {NetworkError} If network request fails
   */
  async function chat(messages: Message[], chatOptions?: ChatOptions): Promise<ChatResponse> {
    validateMessages(messages)
    validateChatOptions(chatOptions)

    if (chatOptions?.signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    const startTime = Date.now()
    const model = chatOptions?.model ?? currentModel
    const params = mergeParams(defaultParams, chatOptions)
    const body = buildRequestBody(messages, model, params, false)

    const maxRetries = chatOptions?.maxRetries ?? DEFAULT_MAX_RETRIES
    const shouldRetry = chatOptions?.retry !== false

    const response = await fetchWithRetry(
      buildUrl(),
      {
        method: 'POST',
        headers: buildHeaders(),
        body,
        signal: chatOptions?.signal,
      },
      {
        maxRetries,
        shouldRetry,
        signal: chatOptions?.signal,
      }
    )

    const endTime = Date.now()
    const latency = endTime - startTime

    let data: unknown
    try {
      data = await response.json()
    } catch (error) {
      throw new ParseError('Failed to parse JSON response', error as Error)
    }

    const parsed = parseJsonResponse<OpenRouterResponse>(data)

    const firstChoice = parsed.choices[0]
    if (!firstChoice) {
      throw new ParseError('No choices in response')
    }

    const content = firstChoice.message.content ?? ''
    const usage = parsed.usage
      ? {
          promptTokens: parsed.usage.prompt_tokens,
          completionTokens: parsed.usage.completion_tokens,
          totalTokens: parsed.usage.total_tokens,
        }
      : {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        }

    return {
      content,
      usage,
      model: parsed.model,
      id: parsed.id,
      finishReason: (firstChoice.finish_reason as ChatResponse['finishReason']) ?? null,
      latency,
    }
  }

  /**
   * Send a chat completion request and stream the response as it's generated.
   *
   * Returns an async iterable that yields text chunks as they arrive from the API.
   * This allows for real-time display of responses to users.
   *
   * @param messages - Array of messages forming the conversation
   * @param chatOptions - Optional parameters for this request
   * @returns An async iterable that yields response chunks as strings
   *
   * @example
   * ```typescript
   * const stream = client.stream([
   *   { role: 'user', content: 'Write a short story' }
   * ])
   *
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk)
   * }
   * ```
   *
   * @example
   * ```typescript
   * // With abort signal
   * const controller = new AbortController()
   * const stream = client.stream(
   *   [{ role: 'user', content: 'Count to 100' }],
   *   { signal: controller.signal }
   * )
   *
   * setTimeout(() => controller.abort(), 5000)
   * ```
   *
   * @throws {ValidationError} If messages array is empty or contains invalid messages
   * @throws {AuthError} If API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {ModelError} If model is unavailable or invalid
   * @throws {NetworkError} If network request fails
   */
  function stream(messages: Message[], chatOptions?: ChatOptions): AsyncIterable<string> {
    validateMessages(messages)
    validateChatOptions(chatOptions)

    if (chatOptions?.signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    const model = chatOptions?.model ?? currentModel
    const params = mergeParams(defaultParams, chatOptions)
    const body = buildRequestBody(messages, model, params, true)

    let started = false

    return {
      async *[Symbol.asyncIterator]() {
        if (started) {
          return
        }
        started = true

        const response = await fetchWithRetry(
          buildUrl(),
          {
            method: 'POST',
            headers: buildHeaders(),
            body,
            signal: chatOptions?.signal,
          },
          {
            maxRetries: 0,
            shouldRetry: false,
            signal: chatOptions?.signal,
          }
        )

        yield* parseSSEStream(response, chatOptions?.signal)
      },
    }
  }

  /**
   * Get the current default model.
   *
   * @returns The current model identifier
   *
   * @example
   * ```typescript
   * const model = client.getModel()
   * console.log(model) // 'anthropic/claude-sonnet-4'
   * ```
   */
  function getModel(): string {
    return currentModel
  }

  /**
   * Change the default model used for future requests.
   *
   * This updates the model used for all subsequent chat and stream calls
   * unless overridden by chatOptions.model.
   *
   * @param model - The new model identifier
   *
   * @example
   * ```typescript
   * client.setModel('openai/gpt-4o')
   * const response = await client.chat([
   *   { role: 'user', content: 'Hello!' }
   * ])
   * // Uses GPT-4o instead of original model
   * ```
   *
   * @throws {ValidationError} If model is empty or invalid
   */
  function setModel(model: string): void {
    if (!model || model.trim() === '') {
      throw new ValidationError('model cannot be empty', 'model')
    }
    currentModel = model
  }

  /**
   * Create a stateful conversation with automatic history management.
   *
   * Conversations maintain message history and can have a system prompt.
   * This is useful for multi-turn interactions where context needs to be preserved.
   *
   * @param convOptions - Options including system prompt and initial messages
   * @returns A conversation instance with send, sendStream, and history methods
   *
   * @example
   * ```typescript
   * const conversation = client.createConversation({
   *   system: 'You are a helpful coding assistant.'
   * })
   *
   * const reply1 = await conversation.send('How do I read a file in Python?')
   * const reply2 = await conversation.send('Now show me how to write to it.')
   * // History is automatically maintained
   * ```
   *
   * @example
   * ```typescript
   * // With streaming
   * const conversation = client.createConversation()
   * const stream = conversation.sendStream('Tell me a story')
   *
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk)
   * }
   * ```
   */
  function createConversationWrapper(convOptions?: ConversationOptions): Conversation {
    return createConversation(chat, stream, convOptions)
  }

  /**
   * Estimate token usage for a set of messages.
   *
   * Returns the estimated prompt tokens and available tokens remaining
   * in the model's context window. Useful for checking if messages will fit.
   *
   * @param messages - The messages to estimate tokens for
   * @returns An object with prompt token estimate and available tokens
   *
   * @example
   * ```typescript
   * const messages = [
   *   { role: 'user', content: 'What is TypeScript?' }
   * ]
   *
   * const estimate = client.estimateChat(messages)
   * console.log(`Prompt: ${estimate.prompt} tokens`)
   * console.log(`Available: ${estimate.available} tokens`)
   * ```
   */
  function estimateChat(messages: Message[]): { prompt: number; available: number } {
    const MESSAGE_OVERHEAD = 3

    let totalTokens = 0
    for (const message of messages) {
      totalTokens += estimateTokens(message.content)
      totalTokens += MESSAGE_OVERHEAD
    }

    const modelInfo = getModelInfo(currentModel)
    const contextLength = modelInfo?.contextLength ?? 128000

    const available = Math.max(0, contextLength - totalTokens)

    return { prompt: totalTokens, available }
  }

  return {
    chat,
    stream,
    createConversation: createConversationWrapper,
    getModel,
    setModel,
    estimateChat,
  }
}
