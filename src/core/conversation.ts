import type { Message, Conversation, ConversationOptions, ChatOptions, ChatResponse } from '../types'
import { ValidationError, ConcurrencyError } from '../errors'

export function createConversation(
  chatFn: (messages: Message[], options?: ChatOptions) => Promise<ChatResponse>,
  streamFn: (messages: Message[], options?: ChatOptions) => AsyncIterable<string>,
  options?: ConversationOptions
): Conversation {
  let systemPrompt = options?.system
  const messages: Message[] = [...(options?.initialMessages || [])]
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

  function addMessage(role: 'user' | 'assistant', content: string): void {
    checkConcurrency()

    if (role === 'system' as string) {
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

  function clear(): void {
    checkConcurrency()
    messages.length = 0
  }

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
