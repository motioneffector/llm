export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ChatResponse {
  content: string
  usage: TokenUsage
  model: string
  id: string
  finishReason: 'stop' | 'length' | 'content_filter' | null
  latency: number
}

export interface GenerationParams {
  temperature?: number
  maxTokens?: number
  topP?: number
  stop?: string[]
}

export interface ClientOptions {
  apiKey: string
  model: string
  baseUrl?: string
  defaultParams?: GenerationParams
  referer?: string
  title?: string
}

export interface ChatOptions extends GenerationParams {
  model?: string
  signal?: AbortSignal
  retry?: boolean
  maxRetries?: number
}

export interface ConversationOptions {
  system?: string
  initialMessages?: Message[]
}

export interface ModelInfo {
  contextLength: number
  pricing: {
    prompt: number
    completion: number
  }
}

export interface LLMClient {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>
  stream(messages: Message[], options?: ChatOptions): AsyncIterable<string>
  createConversation(options?: ConversationOptions): Conversation
  getModel(): string
  setModel(model: string): void
  estimateChat(messages: Message[]): { prompt: number; available: number }
}

export interface Conversation {
  send(content: string, options?: ChatOptions): Promise<string>
  sendStream(content: string, options?: ChatOptions): AsyncIterable<string>
  history: Message[]
  addMessage(role: 'user' | 'assistant', content: string): void
  clear(): void
  clearAll(): void
}
