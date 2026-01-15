# Types

TypeScript interfaces used throughout the library.

---

## `Message`

A single message in a conversation.

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}
```

| Property | Type | Description |
|----------|------|-------------|
| `role` | `'system' \| 'user' \| 'assistant'` | The role of the message sender |
| `content` | `string` | The text content of the message |

**Example:**

```typescript
const messages: Message[] = [
  { role: 'system', content: 'Be helpful.' },
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi there!' }
]
```

---

## `ChatResponse`

Response from a chat completion request.

```typescript
interface ChatResponse {
  content: string
  usage: TokenUsage
  model: string
  id: string
  finishReason: 'stop' | 'length' | 'content_filter' | null
  latency: number
}
```

| Property | Type | Description |
|----------|------|-------------|
| `content` | `string` | The generated text response |
| `usage` | `TokenUsage` | Token usage statistics |
| `model` | `string` | The model that generated the response |
| `id` | `string` | Unique identifier for this completion |
| `finishReason` | `'stop' \| 'length' \| 'content_filter' \| null` | Why generation stopped |
| `latency` | `number` | Request latency in milliseconds |

**Finish Reasons:**

- `'stop'` — Natural completion
- `'length'` — Hit max tokens limit
- `'content_filter'` — Response was filtered
- `null` — Unknown or not provided

---

## `TokenUsage`

Token usage statistics for a request.

```typescript
interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}
```

| Property | Type | Description |
|----------|------|-------------|
| `promptTokens` | `number` | Tokens in the prompt/input |
| `completionTokens` | `number` | Tokens in the response/output |
| `totalTokens` | `number` | Total tokens used |

---

## `GenerationParams`

Parameters for controlling text generation.

```typescript
interface GenerationParams {
  temperature?: number
  maxTokens?: number
  topP?: number
  stop?: string[]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `temperature` | `number` | Sampling temperature (0-2). Higher = more random |
| `maxTokens` | `number` | Maximum tokens to generate |
| `topP` | `number` | Nucleus sampling threshold (0-1) |
| `stop` | `string[]` | Sequences that stop generation |

---

## `ClientOptions`

Configuration for creating an LLM client.

```typescript
interface ClientOptions {
  apiKey: string
  model: string
  baseUrl?: string
  defaultParams?: GenerationParams
  referer?: string
  title?: string
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `apiKey` | `string` | Yes | API key for authentication |
| `model` | `string` | Yes | Model identifier (e.g., `'anthropic/claude-sonnet-4'`) |
| `baseUrl` | `string` | No | API endpoint. Default: OpenRouter |
| `defaultParams` | `GenerationParams` | No | Default generation parameters |
| `referer` | `string` | No | HTTP-Referer header for OpenRouter |
| `title` | `string` | No | X-Title header for OpenRouter |

---

## `ChatOptions`

Options for a single chat request.

```typescript
interface ChatOptions extends GenerationParams {
  model?: string
  signal?: AbortSignal
  retry?: boolean
  maxRetries?: number
}
```

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Override model for this request |
| `signal` | `AbortSignal` | Signal to cancel the request |
| `retry` | `boolean` | Enable retries. Default: `true` |
| `maxRetries` | `number` | Max retry attempts. Default: `3` |
| `temperature` | `number` | Sampling temperature (0-2) |
| `maxTokens` | `number` | Maximum tokens to generate |
| `topP` | `number` | Nucleus sampling threshold |
| `stop` | `string[]` | Stop sequences |

---

## `ConversationOptions`

Options for creating a conversation.

```typescript
interface ConversationOptions {
  system?: string
  initialMessages?: Message[]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `system` | `string` | System prompt to guide model behavior |
| `initialMessages` | `Message[]` | Pre-populated message history |

---

## `ModelInfo`

Information about a model's capabilities and pricing.

```typescript
interface ModelInfo {
  contextLength: number
  pricing: {
    prompt: number
    completion: number
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `contextLength` | `number` | Maximum tokens the model can process |
| `pricing.prompt` | `number` | Cost per million prompt tokens (USD) |
| `pricing.completion` | `number` | Cost per million completion tokens (USD) |

---

## `LLMClient`

The main client interface.

```typescript
interface LLMClient {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>
  stream(messages: Message[], options?: ChatOptions): AsyncIterable<string>
  createConversation(options?: ConversationOptions): Conversation
  getModel(): string
  setModel(model: string): void
  estimateChat(messages: Message[]): { prompt: number; available: number }
}
```

---

## `Conversation`

A stateful conversation interface.

```typescript
interface Conversation {
  send(content: string, options?: ChatOptions): Promise<string>
  sendStream(content: string, options?: ChatOptions): AsyncIterable<string>
  history: Message[]
  addMessage(role: 'user' | 'assistant', content: string): void
  clear(): void
  clearAll(): void
}
```
