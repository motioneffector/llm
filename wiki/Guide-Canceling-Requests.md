# Canceling Requests

Cancel in-flight requests when users navigate away, timeouts occur, or you need to stop generation early. This guide covers AbortController usage for both regular and streaming requests.

## Prerequisites

Before starting, you should:

- Know the basics of [sending messages](Guide-Sending-Messages)
- Understand [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

## Overview

We'll cancel requests by:

1. Creating an AbortController
2. Passing its signal to the request
3. Calling abort() to cancel
4. Handling the AbortError

## Step 1: Create an AbortController

AbortController provides a signal you can pass to requests and an abort() method to cancel them.

```typescript
const controller = new AbortController()
```

## Step 2: Pass the Signal

Include the signal in your request options:

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const controller = new AbortController()

const response = await client.chat(
  [{ role: 'user', content: 'Tell me a long story' }],
  { signal: controller.signal }
)
```

## Step 3: Cancel When Needed

Call `abort()` to cancel the request:

```typescript
// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000)
```

## Step 4: Handle the Error

Canceled requests throw a `DOMException` with name `'AbortError'`:

```typescript
try {
  const response = await client.chat(messages, { signal: controller.signal })
  console.log(response.content)
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('Request was canceled')
  } else {
    throw error
  }
}
```

## Complete Example

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const controller = new AbortController()

// Cancel after 5 seconds
const timeout = setTimeout(() => {
  console.log('Timeout reached, canceling...')
  controller.abort()
}, 5000)

try {
  const response = await client.chat(
    [{ role: 'user', content: 'Write a very long essay about TypeScript' }],
    { signal: controller.signal }
  )
  clearTimeout(timeout)
  console.log(response.content)
} catch (error) {
  clearTimeout(timeout)
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('Request canceled due to timeout')
  } else {
    throw error
  }
}
```

## Variations

### Canceling Streams

Streams work the same way but you can cancel mid-generation:

```typescript
const controller = new AbortController()

// Cancel after 2 seconds
setTimeout(() => controller.abort(), 2000)

const stream = client.stream(
  [{ role: 'user', content: 'Count from 1 to 1000' }],
  { signal: controller.signal }
)

try {
  for await (const chunk of stream) {
    process.stdout.write(chunk)
  }
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('\n[Stream canceled]')
  } else {
    throw error
  }
}
```

### User-Initiated Cancellation

Wire up a cancel button:

```typescript
const cancelButton = document.getElementById('cancel')!
const controller = new AbortController()

cancelButton.addEventListener('click', () => {
  controller.abort()
})

try {
  const response = await client.chat(messages, { signal: controller.signal })
  showResult(response.content)
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    showMessage('Canceled by user')
  } else {
    showError(error)
  }
}
```

### Timeout Wrapper Function

Create a reusable timeout wrapper:

```typescript
import type { Message, ChatOptions, ChatResponse } from '@motioneffector/llm'

async function chatWithTimeout(
  client: ReturnType<typeof createLLMClient>,
  messages: Message[],
  timeoutMs: number,
  options?: ChatOptions
): Promise<ChatResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await client.chat(messages, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

// Usage
const response = await chatWithTimeout(client, messages, 10000)
```

### Canceling Conversation Requests

Conversations also accept the signal:

```typescript
const conversation = client.createConversation()
const controller = new AbortController()

setTimeout(() => controller.abort(), 5000)

try {
  const reply = await conversation.send('Write a long story', {
    signal: controller.signal
  })
  console.log(reply)
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('Conversation request canceled')
  } else {
    throw error
  }
}
```

## Troubleshooting

### Abort Doesn't Stop Immediately

**Symptom:** Request continues briefly after abort().

**Cause:** Abort signals are checked at specific points; active network operations complete their current chunk.

**Solution:** This is normal behavior. The request will stop at the next check point.

### Already Aborted Error

**Symptom:** Error thrown before request starts.

**Cause:** Using an already-aborted controller.

**Solution:** Create a fresh AbortController for each request:

```typescript
// Wrong - reusing aborted controller
controller.abort()
await client.chat(messages, { signal: controller.signal }) // Throws immediately

// Right - new controller
const newController = new AbortController()
await client.chat(messages, { signal: newController.signal })
```

### Memory Leaks with Timeouts

**Symptom:** Timeouts keep running after completion.

**Cause:** Not clearing the timeout when request completes normally.

**Solution:** Always clear timeouts in finally block:

```typescript
const timeout = setTimeout(() => controller.abort(), 5000)
try {
  await client.chat(messages, { signal: controller.signal })
} finally {
  clearTimeout(timeout)
}
```

## See Also

- **[Streaming](Concept-Streaming)** - Canceling streams mid-generation
- **[Streaming Responses](Guide-Streaming-Responses)** - Streaming with abort examples
- **[Client API](API-Client)** - Signal option documentation
