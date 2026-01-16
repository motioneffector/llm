# Streaming Responses

Display LLM output in real-time as it's generated. Streaming creates a more responsive experience by showing text progressively instead of waiting for the complete response.

## Prerequisites

Before starting, you should:

- Understand [async iterators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of)
- Know the basics of [sending messages](Guide-Sending-Messages)

## Overview

We'll stream a response by:

1. Calling `stream()` instead of `chat()`
2. Iterating with `for await...of`
3. Outputting each chunk immediately
4. Handling stream completion

## Step 1: Create the Stream

Call `stream()` with your messages. This returns an async iterable, not a promise.

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const stream = client.stream([
  { role: 'user', content: 'Write a short poem about coding' }
])
```

## Step 2: Iterate Over Chunks

Use `for await...of` to consume the stream. Each iteration yields a text chunk.

```typescript
for await (const chunk of stream) {
  process.stdout.write(chunk)
}
```

Use `process.stdout.write()` instead of `console.log()` to avoid newlines between chunks.

## Step 3: Handle Completion

The loop ends when the stream is done. Add any cleanup or final output:

```typescript
for await (const chunk of stream) {
  process.stdout.write(chunk)
}

console.log() // Final newline
console.log('Done!')
```

## Complete Example

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const stream = client.stream([
  { role: 'user', content: 'Explain how async/await works in JavaScript' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk)
}

console.log()
```

## Variations

### Collecting the Full Response

Build the complete text while streaming:

```typescript
const stream = client.stream([
  { role: 'user', content: 'Write a haiku' }
])

let fullResponse = ''

for await (const chunk of stream) {
  process.stdout.write(chunk)
  fullResponse += chunk
}

console.log(`\n\nFull response (${fullResponse.length} chars):`)
console.log(fullResponse)
```

### With Generation Options

All options from `chat()` work with `stream()`:

```typescript
const stream = client.stream(
  [{ role: 'user', content: 'Write a story' }],
  {
    temperature: 0.9,
    maxTokens: 500,
    model: 'openai/gpt-4o'
  }
)
```

### Browser Display

Update a DOM element progressively:

```typescript
const outputEl = document.getElementById('output')!

const stream = client.stream([
  { role: 'user', content: 'Explain quantum computing' }
])

for await (const chunk of stream) {
  outputEl.textContent += chunk
}
```

### Streaming in Conversations

Conversations support streaming with `sendStream()`:

```typescript
const conversation = client.createConversation({
  system: 'Be helpful.'
})

for await (const chunk of conversation.sendStream('Tell me a joke')) {
  process.stdout.write(chunk)
}

// History is updated after stream completes
console.log(conversation.history)
```

## Troubleshooting

### Stream Stops Unexpectedly

**Symptom:** Output ends mid-sentence.

**Cause:** Usually `maxTokens` limit reached.

**Solution:** Increase `maxTokens` in options, or don't set it to use the model's default.

### No Output Appears

**Symptom:** Loop runs but nothing displays.

**Cause:** Using `console.log()` with empty chunks or buffering issues.

**Solution:** Use `process.stdout.write()` and ensure you're actually in the loop (add a counter).

### AbortError on Cancel

**Symptom:** `AbortError` thrown when canceling.

**Cause:** This is expected behavior when aborting a stream.

**Solution:** Catch the error if you need to handle cancellation gracefully. See [Canceling Requests](Guide-Canceling-Requests).

## See Also

- **[Canceling Requests](Guide-Canceling-Requests)** - Stop streams mid-generation
- **[Streaming](Concept-Streaming)** - How streaming works
- **[Building Conversations](Guide-Building-Conversations)** - Using `sendStream()`
- **[Client API](API-Client)** - Full `stream()` reference
