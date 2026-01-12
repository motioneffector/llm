import type {
  Message,
  Conversation,
  ConversationOptions,
  ChatOptions,
  ChatResponse,
} from '../types'
import { ValidationError, ConcurrencyError } from '../errors'

/**
 * Creates a conversation instance with automatic history management.
 *
 * This is an internal factory function used by the LLM client.
 * Conversations maintain a message history and provide methods for sending
 * messages while automatically updating the context.
 *
 * @param chatFn - The chat function from the client
 * @param streamFn - The stream function from the client
 * @param options - Optional conversation configuration
 * @returns A conversation instance
 *
 * @example
 * ```typescript
 * // Used internally by client.createConversation()
 * const conversation = createConversation(
 *   client.chat,
 *   client.stream,
 *   { system: 'You are helpful.' }
 * )
 * ```
 */
export function createConversation(
  chatFn: (messages: Message[], options?: ChatOptions) => Promise<ChatResponse>,
  streamFn: (messages: Message[], options?: ChatOptions) => AsyncIterable<string>,
  options?: ConversationOptions
): Conversation {
  let systemPrompt = options?.system
  const messages: Message[] = [...(options?.initialMessages ?? [])]
  let isProcessing = false

  function checkConcurrency(): void {
    if (isProcessing) {
      throw new ConcurrencyError('Cannot perform operation while a request is in progress')
    }
  }

  function getMessagesForAPI(): Message[] {
    const result: Message[] = []
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt })
    }
    result.push(...messages)
    return result
  }

  function getHistory(): Message[] {
    const result: Message[] = []
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt })
    }
    result.push(...messages)
    return result
  }

  /**
   * Send a user message and get the assistant's response.
   *
   * The user message is added to history, the API is called,
   * and the assistant's response is also added to history automatically.
   *
   * @param content - The user's message content
   * @param chatOptions - Optional parameters for this request
   * @returns The assistant's response text
   *
   * @example
   * ```typescript
   * const response = await conversation.send('What is TypeScript?')
   * console.log(response)
   * ```
   *
   * @throws {ConcurrencyError} If another request is already in progress
   * @throws {ValidationError} If message content is invalid
   */
  async function send(content: string, chatOptions?: ChatOptions): Promise<string> {
    checkConcurrency()

    isProcessing = true

    try {
      messages.push({ role: 'user', content })

      const allMessages = getMessagesForAPI()
      const response = await chatFn(allMessages, chatOptions)

      messages.push({ role: 'assistant', content: response.content })

      return response.content
    } finally {
      isProcessing = false
    }
  }

  /**
   * Send a user message and stream the assistant's response.
   *
   * The user message is added to history immediately. The assistant's response
   * is added to history after the stream completes successfully.
   *
   * @param content - The user's message content
   * @param chatOptions - Optional parameters for this request
   * @returns An async iterable that yields response chunks
   *
   * @example
   * ```typescript
   * const stream = conversation.sendStream('Tell me a joke')
   *
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk)
   * }
   * ```
   *
   * @throws {ConcurrencyError} If another request is already in progress
   * @throws {ValidationError} If message content is invalid
   */
  function sendStream(content: string, chatOptions?: ChatOptions): AsyncIterable<string> {
    checkConcurrency()

    isProcessing = true

    messages.push({ role: 'user', content })

    const allMessages = getMessagesForAPI()
    const stream = streamFn(allMessages, chatOptions)

    let fullResponse = ''
    let streamCompleted = false
    let streamError: Error | undefined

    return {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const chunk of stream) {
            fullResponse += chunk
            yield chunk
          }
          streamCompleted = true
        } catch (error) {
          streamError = error as Error
          throw error
        } finally {
          isProcessing = false

          if (streamCompleted && !streamError) {
            messages.push({ role: 'assistant', content: fullResponse })
          } else if (streamError) {
            messages.pop()
          }
        }
      },
    }
  }

  /**
   * Manually add a message to the conversation history.
   *
   * This does not make an API call. Use this to seed the conversation
   * with past messages or simulate responses.
   *
   * @param role - The role of the message ('user' or 'assistant')
   * @param content - The message content
   *
   * @example
   * ```typescript
   * conversation.addMessage('user', 'Hello')
   * conversation.addMessage('assistant', 'Hi there!')
   * // History now contains these messages
   * ```
   *
   * @throws {ConcurrencyError} If a request is in progress
   * @throws {ValidationError} If role is 'system' or invalid
   * @throws {TypeError} If content is not a string
   */
  function addMessage(role: 'user' | 'assistant', content: string): void {
    checkConcurrency()

    if (role === ('system' as string)) {
      throw new ValidationError(
        'Cannot add system messages manually, use constructor for system prompt',
        'role'
      )
    }

    if (role !== 'user' && role !== 'assistant') {
      throw new ValidationError(`Invalid role: ${role}. Must be 'user' or 'assistant'.`, 'role')
    }

    if (typeof content !== 'string') {
      throw new TypeError('Message content must be a string')
    }

    messages.push({ role, content })
  }

  /**
   * Clear all messages from the conversation history.
   *
   * The system prompt is preserved. Use this to start a new conversation
   * with the same system context.
   *
   * @example
   * ```typescript
   * conversation.clear()
   * // System prompt still active, but message history is empty
   * ```
   *
   * @throws {ConcurrencyError} If a request is in progress
   */
  function clear(): void {
    checkConcurrency()
    messages.length = 0
  }

  /**
   * Clear all messages including the system prompt.
   *
   * This completely resets the conversation to an empty state.
   *
   * @example
   * ```typescript
   * conversation.clearAll()
   * // Both messages and system prompt are cleared
   * ```
   *
   * @throws {ConcurrencyError} If a request is in progress
   */
  function clearAll(): void {
    checkConcurrency()
    messages.length = 0
    systemPrompt = undefined
  }

  return {
    send,
    sendStream,
    get history() {
      return [...getHistory()]
    },
    addMessage,
    clear,
    clearAll,
  }
}
