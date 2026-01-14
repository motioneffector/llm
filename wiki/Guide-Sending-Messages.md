# Sending Messages

Send chat messages to an LLM and process the response. This guide covers message formatting, request options, and handling the response object.

## Prerequisites

Before starting, you should:

- [Install the package](Installation)
- Have an OpenRouter API key

## Overview

We'll send a chat message by:

1. Creating a client with credentials
2. Building a messages array
3. Calling `chat()` with options
4. Processing the response

## Step 1: Create the Client

The client needs your API key and a default model. Create it once and reuse it for all requests.

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})
```

## Step 2: Build the Messages Array

Messages are objects with `role` and `content`. The role is `system`, `user`, or `assistant`.

```typescript
const messages = [
  { role: 'system' as const, content: 'You are a helpful assistant.' },
  { role: 'user' as const, content: 'What is TypeScript?' }
]
```

For simple requests, you can skip the system message:

```typescript
const messages = [
  { role: 'user' as const, content: 'What is TypeScript?' }
]
```

## Step 3: Send the Request

Call `chat()` with your messages. The method returns a promise that resolves to the response.

```typescript
const response = await client.chat(messages)
```

## Step 4: Process the Response

The response object contains the generated text and metadata:

```typescript
console.log(response.content)        // The generated text
console.log(response.usage)          // Token counts
console.log(response.model)          // Model that responded
console.log(response.latency)        // Request time in ms
console.log(response.finishReason)   // Why generation stopped
```

The `usage` object has detailed token counts:

```typescript
console.log(response.usage.promptTokens)      // Input tokens
console.log(response.usage.completionTokens)  // Output tokens
console.log(response.usage.totalTokens)       // Total
```

## Complete Example

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const response = await client.chat([
  { role: 'system', content: 'Be concise.' },
  { role: 'user', content: 'Explain async/await in JavaScript.' }
])

console.log(response.content)
console.log(`Tokens: ${response.usage.totalTokens}, Latency: ${response.latency}ms`)
```

## Variations

### With Temperature

Control randomness with temperature (0 = deterministic, 2 = very random):

```typescript
const response = await client.chat(messages, {
  temperature: 0.7
})
```

### With Max Tokens

Limit response length:

```typescript
const response = await client.chat(messages, {
  maxTokens: 500
})
```

### With Stop Sequences

Stop generation when specific text appears:

```typescript
const response = await client.chat(messages, {
  stop: ['END', '---']
})
```

### Override Model Per-Request

Use a different model for one request:

```typescript
const response = await client.chat(messages, {
  model: 'openai/gpt-4o'
})
```

### Combining Options

Options can be combined:

```typescript
const response = await client.chat(messages, {
  temperature: 0.3,
  maxTokens: 1000,
  model: 'openai/gpt-4o'
})
```

## Troubleshooting

### Empty Response

**Symptom:** `response.content` is empty.

**Cause:** Model hit max tokens or content filter.

**Solution:** Check `response.finishReason`. If `'length'`, increase `maxTokens`. If `'content_filter'`, the response was blocked.

### Rate Limit Errors

**Symptom:** `RateLimitError` thrown.

**Cause:** Too many requests to the API.

**Solution:** The library retries automatically. For persistent issues, add delays between requests or check your API quota.

### Slow Responses

**Symptom:** Requests take several seconds.

**Cause:** Large prompts or model processing time.

**Solution:** Check `response.usage.promptTokens`. Reduce context if too large. Consider using [streaming](Guide-Streaming-Responses) for perceived performance.

## See Also

- **[Streaming Responses](Guide-Streaming-Responses)** - Real-time output
- **[Messages](Concept-Messages)** - Message format details
- **[Client API](API-Client)** - Full `chat()` reference
