/**
 * Represents a single message in a conversation.
 */
export interface Message {
  /** The role of the message sender */
  role: 'system' | 'user' | 'assistant'
  /** The text content of the message */
  content: string
}

/**
 * Token usage statistics for a chat completion.
 */
export interface TokenUsage {
  /** Number of tokens in the prompt */
  promptTokens: number
  /** Number of tokens in the completion */
  completionTokens: number
  /** Total tokens used (prompt + completion) */
  totalTokens: number
}

/**
 * Response from a chat completion request.
 */
export interface ChatResponse {
  /** The generated text response */
  content: string
  /** Token usage statistics */
  usage: TokenUsage
  /** The model that generated the response */
  model: string
  /** Unique identifier for this completion */
  id: string
  /** Why the model stopped generating ('stop' = natural end, 'length' = max tokens, 'content_filter' = filtered) */
  finishReason: 'stop' | 'length' | 'content_filter' | null
  /** Request latency in milliseconds */
  latency: number
}

/**
 * Parameters for controlling text generation.
 */
export interface GenerationParams {
  /** Sampling temperature (0-2). Higher = more random, lower = more deterministic */
  temperature?: number
  /** Maximum number of tokens to generate */
  maxTokens?: number
  /** Nucleus sampling threshold (0-1). Alternative to temperature */
  topP?: number
  /** Sequences where generation will stop */
  stop?: string[]
}

/**
 * Configuration options for creating an LLM client.
 */
export interface ClientOptions {
  /** API key for authentication (e.g., OpenRouter API key) */
  apiKey: string
  /** Model identifier (e.g., 'anthropic/claude-sonnet-4') */
  model: string
  /** Base URL for the API endpoint (defaults to OpenRouter) */
  baseUrl?: string
  /** Default generation parameters for all requests */
  defaultParams?: GenerationParams
  /** Referer header for OpenRouter (optional) */
  referer?: string
  /** Title header for OpenRouter (optional) */
  title?: string
}

/**
 * Options for a single chat request.
 */
export interface ChatOptions extends GenerationParams {
  /** Override the default model for this request */
  model?: string
  /** AbortSignal to cancel the request */
  signal?: AbortSignal
  /** Whether to retry on failure (default: true) */
  retry?: boolean
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
}

/**
 * Options for creating a conversation.
 */
export interface ConversationOptions {
  /** System prompt to guide the model's behavior */
  system?: string
  /** Pre-populated message history */
  initialMessages?: Message[]
}

/**
 * Information about a specific model's capabilities and pricing.
 */
export interface ModelInfo {
  /** Maximum number of tokens the model can process */
  contextLength: number
  /** Pricing information in dollars per million tokens */
  pricing: {
    /** Cost per million prompt tokens */
    prompt: number
    /** Cost per million completion tokens */
    completion: number
  }
}

/**
 * A model entry with its ID and full information.
 */
export interface ModelEntry extends ModelInfo {
  /** The model identifier (e.g., 'anthropic/claude-sonnet-4') */
  id: string
}

/**
 * Main interface for the LLM client.
 */
export interface LLMClient {
  /** Send a chat completion request and wait for the full response */
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>
  /** Send a chat completion request and stream the response as it's generated */
  stream(messages: Message[], options?: ChatOptions): AsyncIterable<string>
  /** Create a stateful conversation with automatic history management */
  createConversation(options?: ConversationOptions): Conversation
  /** Get the current default model */
  getModel(): string
  /** Change the default model */
  setModel(model: string): void
  /** Estimate token usage for a set of messages */
  estimateChat(messages: Message[]): { prompt: number; available: number }
}

/**
 * A stateful conversation that maintains message history.
 */
export interface Conversation {
  /** Send a message and get a response. History is automatically updated */
  send(content: string, options?: ChatOptions): Promise<string>
  /** Send a message and stream the response. History is automatically updated */
  sendStream(content: string, options?: ChatOptions): AsyncIterable<string>
  /** All messages in the conversation (including system prompt if set) */
  history: Message[]
  /** Manually add a message to the history without making an API call */
  addMessage(role: 'user' | 'assistant', content: string): void
  /** Clear all messages except the system prompt */
  clear(): void
  /** Clear all messages including the system prompt */
  clearAll(): void
}
