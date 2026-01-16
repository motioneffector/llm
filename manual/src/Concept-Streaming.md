# Streaming

Streaming delivers LLM responses in real-time as they're generated, rather than waiting for the complete response. You see text appear word by word, creating a more responsive experience.

## How It Works

With regular `chat()`, you wait for the model to generate the entire response before seeing anything. With `stream()`, text chunks arrive as they're generated:

```
Regular:     [wait 3 seconds] ──────────────► "The complete response..."
Streaming:   "The" ► "complete" ► "response" ► "..." (appears progressively)
```

The stream is an async iterable. You iterate over it with `for await...of`, and each iteration yields a small chunk of text (usually a few words or a partial sentence).

```typescript
const stream = client.stream([{ role: 'user', content: 'Tell me a story' }])

for await (const chunk of stream) {
  process.stdout.write(chunk)  // Display immediately
}
```

## Basic Usage

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const stream = client.stream([
  { role: 'user', content: 'Write a haiku about TypeScript' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk)
}

console.log() // Newline at the end
```

Each chunk is a string fragment. Write them directly to output without newlines between chunks.

## Key Points

- **Returns `AsyncIterable<string>`** - Use `for await...of` to consume chunks.
- **Chunks are partial text** - Each chunk might be a word, punctuation, or partial word. Just concatenate them.
- **No automatic retries** - Streaming requests don't retry on failure because retrying would duplicate output.
- **Use AbortController to cancel** - Pass a signal to stop the stream mid-generation.
- **Same options as chat** - Temperature, maxTokens, model override all work the same.

## Examples

### Collecting Full Response While Streaming

Display chunks and build the complete response:

```typescript
const stream = client.stream([
  { role: 'user', content: 'Explain async/await' }
])

let fullResponse = ''

for await (const chunk of stream) {
  process.stdout.write(chunk)
  fullResponse += chunk
}

console.log(`\n\nTotal length: ${fullResponse.length}`)
```

### Canceling a Stream

Stop generation early with AbortController:

```typescript
const controller = new AbortController()

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000)

const stream = client.stream(
  [{ role: 'user', content: 'Count to 1000' }],
  { signal: controller.signal }
)

try {
  for await (const chunk of stream) {
    process.stdout.write(chunk)
  }
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('\n[Canceled]')
  } else {
    throw error
  }
}
```

### With Custom Parameters

All generation options work with streaming:

```typescript
const stream = client.stream(
  [{ role: 'user', content: 'Write a poem' }],
  {
    temperature: 0.9,
    maxTokens: 200,
    model: 'openai/gpt-4o'
  }
)
```

## Related

- **[Client](Concept-Client)** - The stream method is on the client
- **[Streaming Responses](Guide-Streaming-Responses)** - Step-by-step guide
- **[Canceling Requests](Guide-Canceling-Requests)** - How to abort streams
- **[Client API](API-Client)** - `stream()` method reference
