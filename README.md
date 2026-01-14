# @motioneffector/llm

A TypeScript client for LLM APIs with OpenRouter support, streaming responses, conversation management, and automatic retries.

[![npm version](https://img.shields.io/npm/v/@motioneffector/llm.svg)](https://www.npmjs.com/package/@motioneffector/llm)
[![license](https://img.shields.io/npm/l/@motioneffector/llm.svg)](https://github.com/motioneffector/llm/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

**[Try the interactive demo →](https://motioneffector.github.io/llm/)**

## Features

- **OpenRouter Integration** - Access 200+ models through a unified API
- **Streaming Support** - Real-time response streaming with async iterators
- **Conversation Management** - Stateful conversations with automatic history tracking
- **Automatic Retries** - Smart retry logic with exponential backoff
- **Token Estimation** - Estimate prompt tokens before sending requests
- **Type Safety** - Full TypeScript definitions with no any types
- **Model Information** - Built-in pricing and context length data
- **Abort Support** - Cancel requests using AbortController signals

[Read the full manual →](https://github.com/motioneffector/llm/wiki)

## Quick Start

```typescript
import { createLLMClient } from '@motioneffector/llm'

// Create a client
const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY,
  model: 'anthropic/claude-sonnet-4'
})

// Simple chat completion
const response = await client.chat([
  { role: 'user', content: 'Explain quantum computing' }
])
console.log(response.content)

// Streaming response
const stream = client.stream([
  { role: 'user', content: 'Write a haiku' }
])
for await (const chunk of stream) {
  process.stdout.write(chunk)
}
```

## Testing & Validation

- **Comprehensive test suite** - 265 unit tests covering core functionality
- **Fuzz tested** - Randomized input testing to catch edge cases
- **Strict TypeScript** - Full type coverage with no `any` types
- **Zero dependencies** - No supply chain risk

## License

MIT © [motioneffector](https://github.com/motioneffector)
