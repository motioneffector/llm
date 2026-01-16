# Client API

The main client interface for sending chat requests, streaming responses, and managing conversations.

---

## `createLLMClient()`

Creates a new LLM client instance configured with your credentials and defaults.

**Signature:**

```typescript
function createLLMClient(options: ClientOptions): LLMClient
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ClientOptions` | Yes | Configuration options for the client |

**Returns:** `LLMClient` — A client instance with chat, stream, and conversation methods.

**Example:**

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})
```

**Throws:**

- `ValidationError` — If `apiKey` or `model` is missing or empty

---

## `client.chat()`

Sends a chat completion request and waits for the full response.

**Signature:**

```typescript
function chat(
  messages: Message[],
  options?: ChatOptions
): Promise<ChatResponse>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messages` | `Message[]` | Yes | Array of messages forming the conversation |
| `options` | `ChatOptions` | No | Request-specific options |

**Returns:** `Promise<ChatResponse>` — The complete response with content, usage, and metadata.

**Example:**

```typescript
const response = await client.chat([
  { role: 'user', content: 'Hello!' }
])

console.log(response.content)
console.log(response.usage.totalTokens)
```

**Throws:**

- `ValidationError` — If messages array is empty or contains invalid messages
- `AuthError` — If API key is invalid (401, 403)
- `RateLimitError` — If rate limit exceeded (429)
- `ModelError` — If model is unavailable (404)
- `NetworkError` — If network request fails

---

## `client.stream()`

Sends a chat completion request and streams the response as it's generated.

**Signature:**

```typescript
function stream(
  messages: Message[],
  options?: ChatOptions
): AsyncIterable<string>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messages` | `Message[]` | Yes | Array of messages forming the conversation |
| `options` | `ChatOptions` | No | Request-specific options |

**Returns:** `AsyncIterable<string>` — An async iterable yielding response chunks.

**Example:**

```typescript
const stream = client.stream([
  { role: 'user', content: 'Write a poem' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk)
}
```

**Throws:**

- `ValidationError` — If messages array is empty or contains invalid messages
- `AuthError` — If API key is invalid
- `RateLimitError` — If rate limit exceeded
- `ModelError` — If model is unavailable
- `NetworkError` — If network request fails

---

## `client.createConversation()`

Creates a stateful conversation with automatic history management.

**Signature:**

```typescript
function createConversation(
  options?: ConversationOptions
): Conversation
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ConversationOptions` | No | Conversation configuration |

**Returns:** `Conversation` — A conversation instance with send, sendStream, and history methods.

**Example:**

```typescript
const conversation = client.createConversation({
  system: 'You are a helpful assistant.'
})

const reply = await conversation.send('Hello!')
```

---

## `client.getModel()`

Returns the current default model.

**Signature:**

```typescript
function getModel(): string
```

**Returns:** `string` — The current model identifier.

**Example:**

```typescript
console.log(client.getModel())
// 'anthropic/claude-sonnet-4'
```

---

## `client.setModel()`

Changes the default model for future requests.

**Signature:**

```typescript
function setModel(model: string): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | `string` | Yes | The new model identifier |

**Example:**

```typescript
client.setModel('openai/gpt-4o')
```

**Throws:**

- `ValidationError` — If model is empty

---

## `client.estimateChat()`

Estimates token usage for a set of messages.

**Signature:**

```typescript
function estimateChat(
  messages: Message[]
): { prompt: number; available: number }
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messages` | `Message[]` | Yes | Messages to estimate tokens for |

**Returns:** `{ prompt: number; available: number }` — Estimated prompt tokens and available context tokens.

**Example:**

```typescript
const estimate = client.estimateChat([
  { role: 'user', content: 'What is TypeScript?' }
])

console.log(`Prompt: ${estimate.prompt} tokens`)
console.log(`Available: ${estimate.available} tokens`)
```

---

## Types

### `ClientOptions`

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
| `model` | `string` | Yes | Default model identifier |
| `baseUrl` | `string` | No | API endpoint. Default: OpenRouter |
| `defaultParams` | `GenerationParams` | No | Default generation parameters |
| `referer` | `string` | No | HTTP-Referer for OpenRouter |
| `title` | `string` | No | X-Title for OpenRouter |

### `ChatOptions`

```typescript
interface ChatOptions extends GenerationParams {
  model?: string
  signal?: AbortSignal
  retry?: boolean
  maxRetries?: number
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `model` | `string` | No | Override model for this request |
| `signal` | `AbortSignal` | No | Signal to cancel the request |
| `retry` | `boolean` | No | Enable/disable retries. Default: `true` |
| `maxRetries` | `number` | No | Max retry attempts. Default: `3` |
| `temperature` | `number` | No | Sampling temperature (0-2) |
| `maxTokens` | `number` | No | Maximum tokens to generate |
| `topP` | `number` | No | Nucleus sampling threshold |
| `stop` | `string[]` | No | Stop sequences |

### `LLMClient`

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
