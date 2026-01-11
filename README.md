# @motioneffector/llm

A TypeScript client library for interacting with LLM APIs, with first-class support for OpenRouter.

## Overview

This library provides a clean, typed interface for sending prompts to large language models and handling responses. It supports streaming, message history management, and multiple providers through OpenRouter's unified API.

## Features

- **OpenRouter Integration**: Access Claude, GPT-4, Llama, Mistral, and more through one API
- **Streaming Support**: Handle streaming responses with async iterators
- **Message History**: Built-in conversation management
- **Type Safety**: Full TypeScript types for messages, responses, and options
- **Token Counting**: Estimate token usage before sending
- **Retry Logic**: Automatic retry with exponential backoff
- **Abort Support**: Cancel in-flight requests
- **System Prompts**: Easy system prompt management

## Core Concepts

### Messages

Messages follow the standard chat format:

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}
```

### Basic Usage

```typescript
const client = createLLMClient({
  apiKey: 'your-openrouter-key',
  model: 'anthropic/claude-sonnet-4'
})

const response = await client.chat([
  { role: 'user', content: 'Explain quantum computing in simple terms.' }
])

console.log(response.content)
```

### Streaming

```typescript
const stream = client.stream([
  { role: 'user', content: 'Write a short story about a robot.' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk)
}
```

### Conversation Management

```typescript
const conversation = client.createConversation({
  system: 'You are a helpful coding assistant.'
})

const response1 = await conversation.send('How do I read a file in Python?')
const response2 = await conversation.send('Now show me how to write to it.')
// History is automatically maintained
```

## API

### `createLLMClient(options)`

Creates an LLM client instance.

**Options:**
- `apiKey`: Your OpenRouter API key
- `model`: Model identifier (e.g., `'anthropic/claude-sonnet-4'`)
- `baseUrl`: API endpoint (defaults to OpenRouter)
- `defaultParams`: Default generation parameters (optional)

### `client.chat(messages, options?)`

Send a chat completion request.

**Options:**
- `model`: Override default model
- `temperature`: Sampling temperature (0-2)
- `maxTokens`: Maximum response length
- `signal`: AbortSignal for cancellation

**Returns:** `{ content: string, usage: TokenUsage }`

### `client.stream(messages, options?)`

Send a streaming chat completion request.

**Returns:** `AsyncIterable<string>`

### `client.createConversation(options?)`

Create a managed conversation.

**Options:**
- `system`: System prompt
- `initialMessages`: Starting message history

### `conversation.send(content)`

Send a user message and get a response. History is maintained.

### `conversation.sendStream(content)`

Send a user message and stream the response.

### `conversation.history`

Access the full message history.

### `conversation.clear()`

Clear conversation history (keeps system prompt).

### `estimateTokens(text)`

Estimate token count for a string.

## Supported Models

Through OpenRouter, you can access:

- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **OpenAI**: GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo
- **Meta**: Llama 3.1 (various sizes)
- **Mistral**: Mistral Large, Mixtral
- **Google**: Gemini Pro
- And many more...

See [OpenRouter's model list](https://openrouter.ai/models) for all available models.

## Error Handling

```typescript
try {
  const response = await client.chat(messages)
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait and retry
  } else if (error instanceof AuthError) {
    // Invalid API key
  } else if (error instanceof ModelError) {
    // Model unavailable or invalid
  }
}
```

## Use Cases

- Chatbots and conversational interfaces
- Content generation tools
- Code assistants
- Text analysis and summarization
- Any application integrating LLM capabilities

## Design Philosophy

This library aims to be a thin, typed wrapper around LLM APIs. It handles the tedious parts (streaming, retries, history) while staying out of your way. No heavy abstractions, no framework lock-in.

## Installation

```bash
npm install @motioneffector/llm
```

## License

MIT
