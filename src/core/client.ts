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
    if (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2) {
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

export function createLLMClient(options: ClientOptions): LLMClient {
  validateClientOptions(options)

  const baseUrl = options.baseUrl || DEFAULT_BASE_URL
  const apiKey = options.apiKey
  let currentModel = options.model
  const defaultParams = options.defaultParams
  const referer = options.referer || 'https://github.com/motioneffector/llm'
  const title = options.title || 'LLM Client'

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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

  async function chat(messages: Message[], chatOptions?: ChatOptions): Promise<ChatResponse> {
    validateMessages(messages)
    validateChatOptions(chatOptions)

    if (chatOptions?.signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    const startTime = Date.now()
    const model = chatOptions?.model || currentModel
    const params = mergeParams(defaultParams, chatOptions)
    const body = buildRequestBody(messages, model, params, false)

    const maxRetries = chatOptions?.maxRetries !== undefined ? chatOptions.maxRetries : DEFAULT_MAX_RETRIES
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

    const content = parsed.choices[0].message.content ?? ''
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
      finishReason: (parsed.choices[0].finish_reason as ChatResponse['finishReason']) || null,
      latency,
    }
  }

  function stream(messages: Message[], chatOptions?: ChatOptions): AsyncIterable<string> {
    validateMessages(messages)
    validateChatOptions(chatOptions)

    if (chatOptions?.signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    const model = chatOptions?.model || currentModel
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

  function getModel(): string {
    return currentModel
  }

  function setModel(model: string): void {
    if (!model || model.trim() === '') {
      throw new ValidationError('model cannot be empty', 'model')
    }
    currentModel = model
  }

  function createConversationWrapper(convOptions?: ConversationOptions): Conversation {
    return createConversation(chat, stream, convOptions)
  }

  function estimateChat(messages: Message[]): { prompt: number; available: number } {
    const MESSAGE_OVERHEAD = 3

    let totalTokens = 0
    for (const message of messages) {
      totalTokens += estimateTokens(message.content)
      totalTokens += MESSAGE_OVERHEAD
    }

    const modelInfo = getModelInfo(currentModel)
    const contextLength = modelInfo?.contextLength || 128000

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
