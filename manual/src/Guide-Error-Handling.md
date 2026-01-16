# Error Handling

Handle API errors gracefully in production. This guide covers error types, retry strategies, and recovery patterns.

## Prerequisites

Before starting, you should:

- Know the basics of [sending messages](Guide-Sending-Messages)
- Understand JavaScript try/catch and error handling

## Overview

We'll handle errors by:

1. Understanding the error hierarchy
2. Catching specific error types
3. Implementing appropriate recovery
4. Configuring retry behavior

## Step 1: Import Error Types

Import the specific error types you want to handle:

```typescript
import {
  createLLMClient,
  RateLimitError,
  AuthError,
  NetworkError,
  ValidationError,
  ModelError,
  ServerError
} from '@motioneffector/llm'
```

## Step 2: Wrap Requests in Try/Catch

Catch errors and check their type:

```typescript
const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

try {
  const response = await client.chat([
    { role: 'user', content: 'Hello' }
  ])
  console.log(response.content)
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limiting
  } else if (error instanceof AuthError) {
    // Handle authentication failure
  } else {
    throw error
  }
}
```

## Step 3: Handle Each Error Type

Implement appropriate handling for each error:

```typescript
try {
  const response = await client.chat(messages)
  return response.content
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter ?? 60} seconds`)
    // Queue for later or show user a message
  } else if (error instanceof AuthError) {
    console.log('Authentication failed. Check your API key.')
    // Prompt for new credentials
  } else if (error instanceof NetworkError) {
    console.log('Network error. Check your connection.')
    // Retry or show offline state
  } else if (error instanceof ModelError) {
    console.log('Model unavailable. Try a different model.')
    // Fall back to alternative model
  } else if (error instanceof ValidationError) {
    console.log(`Invalid input: ${error.message}`)
    // Fix the input and retry
  } else {
    console.log('Unexpected error:', error)
    throw error
  }
}
```

## Complete Example

```typescript
import {
  createLLMClient,
  RateLimitError,
  AuthError,
  NetworkError,
  ModelError,
  ValidationError,
  LLMError,
  type Message
} from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

async function sendWithErrorHandling(messages: Message[]): Promise<string> {
  try {
    const response = await client.chat(messages)
    return response.content
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new Error(`Invalid request: ${error.message}`)
    }

    if (error instanceof AuthError) {
      throw new Error('API key is invalid or expired')
    }

    if (error instanceof RateLimitError) {
      const wait = error.retryAfter ?? 60
      throw new Error(`Rate limited. Try again in ${wait} seconds`)
    }

    if (error instanceof ModelError) {
      throw new Error('Model is unavailable. Try a different model')
    }

    if (error instanceof NetworkError) {
      throw new Error('Network connection failed. Check your internet')
    }

    if (error instanceof LLMError) {
      throw new Error(`API error: ${error.message}`)
    }

    throw error
  }
}

// Usage
try {
  const reply = await sendWithErrorHandling([
    { role: 'user', content: 'Hello!' }
  ])
  console.log(reply)
} catch (error) {
  console.error((error as Error).message)
}
```

## Variations

### Manual Retry with Backoff

Implement custom retry logic for rate limits:

```typescript
async function chatWithRetry(
  messages: Message[],
  maxAttempts = 3
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await client.chat(messages)
      return response.content
    } catch (error) {
      if (error instanceof RateLimitError && attempt < maxAttempts - 1) {
        const delay = error.retryAfter ?? Math.pow(2, attempt) * 1000
        console.log(`Rate limited. Waiting ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}
```

### Disable Built-in Retries

Handle all retries yourself:

```typescript
const response = await client.chat(messages, {
  retry: false
})
```

### Custom Retry Count

Adjust the number of automatic retries:

```typescript
const response = await client.chat(messages, {
  maxRetries: 5  // Default is 3
})
```

### Fallback Model

Switch to a backup model on failure:

```typescript
async function chatWithFallback(messages: Message[]): Promise<string> {
  try {
    const response = await client.chat(messages)
    return response.content
  } catch (error) {
    if (error instanceof ModelError) {
      console.log('Primary model unavailable, trying fallback...')
      const response = await client.chat(messages, {
        model: 'openai/gpt-4o'
      })
      return response.content
    }
    throw error
  }
}
```

### Logging Errors

Log errors for debugging while still handling them:

```typescript
try {
  const response = await client.chat(messages)
  return response.content
} catch (error) {
  if (error instanceof LLMError) {
    console.error('[LLM Error]', {
      type: error.name,
      message: error.message,
      ...(error instanceof RateLimitError && { retryAfter: error.retryAfter }),
      ...(error instanceof AuthError && { status: error.status })
    })
  }
  throw error
}
```

## Troubleshooting

### Error Type Not Matching

**Symptom:** `error instanceof RateLimitError` is always false.

**Cause:** Importing from wrong location or bundler issues.

**Solution:** Import directly from `@motioneffector/llm`:

```typescript
import { RateLimitError } from '@motioneffector/llm'
```

### Retries Not Working

**Symptom:** Requests fail immediately without retrying.

**Cause:** Non-retriable error (auth, validation) or retries disabled.

**Solution:** Check error type. Only rate limits (429) and server errors (5xx) are retried automatically.

### Missing retryAfter

**Symptom:** `error.retryAfter` is undefined.

**Cause:** Server didn't include Retry-After header.

**Solution:** Use a default value:

```typescript
const delay = error.retryAfter ?? 60
```

## See Also

- **[Error Handling](Concept-Error-Handling)** - Error hierarchy and types
- **[Errors API](API-Errors)** - Full error class reference
- **[Client API](API-Client)** - Retry options documentation
