# @motioneffector/llm

A lightweight, type-safe TypeScript client for Large Language Model APIs with first-class OpenRouter support. Features streaming responses, automatic retries, conversation management, and comprehensive error handling.

[![npm version](https://img.shields.io/npm/v/@motioneffector/llm.svg)](https://www.npmjs.com/package/@motioneffector/llm)
[![license](https://img.shields.io/npm/l/@motioneffector/llm.svg)](https://github.com/motioneffector/llm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Demo

[Try the interactive demo](https://motioneffector.github.io/llm/) to see the library in action.

## Installation

```bash
npm install @motioneffector/llm
```

## Quick Start

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: 'your-openrouter-key',
  model: 'anthropic/claude-sonnet-4'
})

// Simple chat
const response = await client.chat([
  { role: 'user', content: 'Explain TypeScript in one sentence' }
])
console.log(response.content)

// Streaming
for await (const chunk of client.stream([...])) {
  process.stdout.write(chunk)
}
```

## Features

- **OpenRouter Integration** - Access Claude, GPT-4, Llama, Gemini, and 100+ models through one unified API
- **Streaming Support** - Handle streaming responses with async iterators for real-time output
- **Conversation Management** - Built-in message history tracking with automatic context management
- **Automatic Retries** - Exponential backoff retry logic for transient failures (429, 5xx)
- **Request Cancellation** - Abort in-flight requests with AbortSignal support
- **Token Estimation** - Estimate token usage before making API calls
- **Full TypeScript Support** - Complete type definitions for all methods and responses
- **Zero Dependencies** - Minimal footprint, uses only native Fetch API
- **Tree-Shakeable** - ESM build optimized for bundle size

## API Reference

### `createLLMClient(options)`

Creates an LLM client instance.

**Options:**
- `apiKey` (string, required) - Your OpenRouter API key
- `model` (string, required) - Model identifier (e.g., `'anthropic/claude-sonnet-4'`)
- `baseUrl` (string, optional) - API endpoint (default: `'https://openrouter.ai/api/v1'`)
- `defaultParams` (object, optional) - Default generation parameters
- `referer` (string, optional) - HTTP-Referer header for OpenRouter
- `title` (string, optional) - X-Title header for OpenRouter

**Returns:** `LLMClient`

**Example:**
```typescript
const client = createLLMClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-sonnet-4',
  defaultParams: {
    temperature: 0.7,
    maxTokens: 1000
  }
})
```

---

### `client.chat(messages, options?)`

Send a chat completion request and receive the full response.

**Parameters:**
- `messages` (Message[]) - Array of message objects with `role` and `content`
- `options` (ChatOptions, optional) - Request-specific options

**ChatOptions:**
- `model` (string) - Override default model for this request
- `temperature` (number, 0-2) - Sampling temperature
- `maxTokens` (number) - Maximum tokens to generate
- `topP` (number, 0-1) - Nucleus sampling parameter
- `stop` (string[]) - Stop sequences
- `signal` (AbortSignal) - Abort controller signal
- `retry` (boolean) - Enable/disable automatic retries (default: true)
- `maxRetries` (number) - Maximum retry attempts (default: 3)

**Returns:** `Promise<ChatResponse>`

```typescript
interface ChatResponse {
  content: string           // Generated text
  usage: TokenUsage         // Token counts
  model: string             // Actual model used
  id: string                // Request ID
  finishReason: string | null  // Why generation stopped
  latency: number           // Response time in ms
}
```

**Example:**
```typescript
const response = await client.chat([
  { role: 'system', content: 'You are a helpful assistant' },
  { role: 'user', content: 'What is TypeScript?' }
], {
  temperature: 0.5,
  maxTokens: 500
})

console.log(response.content)
console.log(`Used ${response.usage.totalTokens} tokens`)
```

---

### `client.stream(messages, options?)`

Send a chat completion request and stream the response as it's generated.

**Parameters:**
- `messages` (Message[]) - Array of message objects
- `options` (ChatOptions, optional) - Same as `chat()` (retry options ignored for streams)

**Returns:** `AsyncIterable<string>`

**Example:**
```typescript
const stream = client.stream([
  { role: 'user', content: 'Write a haiku about TypeScript' }
])

let fullResponse = ''
for await (const chunk of stream) {
  process.stdout.write(chunk)
  fullResponse += chunk
}
```

---

### `client.createConversation(options?)`

Create a conversation with automatic message history management.

**Options:**
- `system` (string, optional) - System prompt prepended to all requests
- `initialMessages` (Message[], optional) - Starting message history

**Returns:** `Conversation`

**Example:**
```typescript
const conversation = client.createConversation({
  system: 'You are a TypeScript expert. Be concise.'
})

await conversation.send('How do I type a Promise?')
await conversation.send('What about async functions?')
console.log(conversation.history) // Full conversation history
```

---

### `conversation.send(content, options?)`

Send a user message and receive assistant response. Automatically maintains history.

**Parameters:**
- `content` (string) - User message content
- `options` (ChatOptions, optional) - Request options

**Returns:** `Promise<string>` - Assistant's response text

**Example:**
```typescript
const response = await conversation.send('Explain generics')
console.log(response)
```

---

### `conversation.sendStream(content, options?)`

Send a user message and stream the assistant response.

**Parameters:**
- `content` (string) - User message content
- `options` (ChatOptions, optional) - Request options

**Returns:** `AsyncIterable<string>`

**Example:**
```typescript
for await (const chunk of conversation.sendStream('Write code')) {
  process.stdout.write(chunk)
}
```

---

### `conversation.history`

Read-only access to the full message history.

**Returns:** `Message[]`

**Example:**
```typescript
const messages = conversation.history
console.log(`Conversation has ${messages.length} messages`)
```

---

### `conversation.addMessage(role, content)`

Manually add a message to conversation history.

**Parameters:**
- `role` ('user' | 'assistant') - Message role (cannot add 'system')
- `content` (string) - Message content

**Example:**
```typescript
conversation.addMessage('user', 'Hello')
conversation.addMessage('assistant', 'Hi there!')
```

---

### `conversation.clear()`

Clear conversation history while preserving the system prompt.

**Example:**
```typescript
conversation.clear()
console.log(conversation.history) // Only system message remains
```

---

### `conversation.clearAll()`

Clear all messages including the system prompt.

**Example:**
```typescript
conversation.clearAll()
console.log(conversation.history.length) // 0
```

---

### `client.getModel()`

Get the current default model.

**Returns:** `string`

**Example:**
```typescript
console.log(client.getModel()) // 'anthropic/claude-sonnet-4'
```

---

### `client.setModel(model)`

Change the default model for subsequent requests.

**Parameters:**
- `model` (string) - New model identifier

**Example:**
```typescript
client.setModel('openai/gpt-4o')
```

---

### `client.estimateChat(messages)`

Estimate token usage for a message array.

**Parameters:**
- `messages` (Message[]) - Messages to estimate

**Returns:** `{ prompt: number, available: number }`

**Example:**
```typescript
const estimate = client.estimateChat(messages)
console.log(`Estimated ${estimate.prompt} prompt tokens`)
console.log(`${estimate.available} tokens available for response`)
```

---

### `estimateTokens(text)`

Estimate token count for a text string (simple heuristic: ~4 chars per token).

**Parameters:**
- `text` (string) - Text to estimate

**Returns:** `number`

**Example:**
```typescript
import { estimateTokens } from '@motioneffector/llm'

const tokens = estimateTokens('Hello, world!')
console.log(`~${tokens} tokens`)
```

---

### `getModelInfo(modelId)`

Get context length and pricing information for a model.

**Parameters:**
- `modelId` (string) - Model identifier

**Returns:** `ModelInfo | undefined`

```typescript
interface ModelInfo {
  contextLength: number
  pricing: {
    prompt: number      // Per 1M tokens
    completion: number  // Per 1M tokens
  }
}
```

**Example:**
```typescript
import { getModelInfo } from '@motioneffector/llm'

const info = getModelInfo('anthropic/claude-sonnet-4')
if (info) {
  console.log(`Context: ${info.contextLength} tokens`)
  console.log(`Price: $${info.pricing.prompt}/M prompt tokens`)
}
```

## Error Handling

All errors extend the base `LLMError` class. Specific error types:

```typescript
import {
  RateLimitError,    // 429 - Rate limit exceeded
  AuthError,         // 401/403 - Invalid API key
  ModelError,        // 404 - Model not found
  ServerError,       // 5xx - Server errors
  NetworkError,      // Network/connection failures
  ParseError,        // Invalid response format
  ValidationError,   // Invalid input
  ConcurrencyError   // Concurrent conversation operations
} from '@motioneffector/llm'

try {
  const response = await client.chat(messages)
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`)
  } else if (error instanceof AuthError) {
    console.error('Invalid API key')
  } else if (error instanceof ModelError) {
    console.error('Model unavailable')
  }
}
```

All errors include:
- `message` (string) - Human-readable error description
- `status` (number) - HTTP status code (for HTTP errors)
- `cause` (Error) - Original error if wrapped

## Supported Models

Through OpenRouter, access 100+ models including:

- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **OpenAI**: GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo
- **Meta**: Llama 3.1 (8B, 70B, 405B)
- **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash
- **Mistral**: Mistral Large, Mistral Medium, Mixtral
- **Anthropic**: Claude 3.5 Sonnet, Opus, Haiku
- **And many more...**

See [OpenRouter's model list](https://openrouter.ai/models) for all available models and pricing.

## Advanced Usage

### Custom Base URL

Use with other OpenAI-compatible APIs:

```typescript
const client = createLLMClient({
  apiKey: 'sk-xxx',
  model: 'gpt-4',
  baseUrl: 'https://api.openai.com/v1'
})
```

### Request Cancellation

```typescript
const controller = new AbortController()

setTimeout(() => controller.abort(), 5000) // Cancel after 5s

try {
  const response = await client.chat(messages, {
    signal: controller.signal
  })
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request cancelled')
  }
}
```

### Disable Retries

```typescript
const response = await client.chat(messages, {
  retry: false  // Fail immediately on errors
})
```

### Custom Retry Configuration

```typescript
const response = await client.chat(messages, {
  maxRetries: 5  // More aggressive retrying
})
```

## Browser Support

Works in all modern browsers and Node.js 18+. Uses native Fetch API (no polyfills needed for modern environments).

## License

MIT © [motioneffector](https://github.com/motioneffector)
