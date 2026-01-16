# Error Handling

The library throws typed errors for different failure modes. You can catch specific error types to handle them appropriately—retry on rate limits, re-authenticate on auth errors, or show user-friendly messages for network issues.

## How It Works

All errors extend the base `LLMError` class. When something goes wrong, the library throws a specific error type based on the cause:

```
LLMError (base class)
├── ValidationError   - Invalid input (bad params, empty messages)
├── AuthError         - Authentication failed (401, 403)
├── RateLimitError    - Too many requests (429)
├── ModelError        - Model unavailable (404)
├── ServerError       - API server error (5xx)
├── NetworkError      - Connection failed
├── ParseError        - Invalid response format
└── ConcurrencyError  - Concurrent operation conflict
```

Catch specific types to handle them differently:

```typescript
try {
  await client.chat(messages)
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait and retry
  } else if (error instanceof AuthError) {
    // Re-authenticate
  } else {
    // Generic error handling
  }
}
```

## Basic Usage

```typescript
import {
  createLLMClient,
  RateLimitError,
  AuthError,
  NetworkError
} from '@motioneffector/llm'

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
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`)
  } else if (error instanceof AuthError) {
    console.log('Invalid API key')
  } else if (error instanceof NetworkError) {
    console.log('Network connection failed')
  } else {
    throw error
  }
}
```

## Key Points

- **Automatic retries built-in** - The client automatically retries on rate limits and server errors (configurable).
- **RateLimitError includes timing** - The `retryAfter` property tells you how long to wait.
- **ValidationError happens before requests** - Invalid parameters throw immediately, no API call made.
- **NetworkError wraps connection issues** - Timeouts, DNS failures, connection refused.
- **ConcurrencyError is conversation-specific** - Thrown when you try concurrent operations on a conversation.

## Examples

### Rate Limit Handling

Respect the server's backoff timing:

```typescript
async function chatWithBackoff(messages: Message[]): Promise<string> {
  try {
    const response = await client.chat(messages)
    return response.content
  } catch (error) {
    if (error instanceof RateLimitError && error.retryAfter) {
      console.log(`Rate limited. Waiting ${error.retryAfter}s...`)
      await new Promise(r => setTimeout(r, error.retryAfter! * 1000))
      return chatWithBackoff(messages)
    }
    throw error
  }
}
```

### Disabling Automatic Retries

Sometimes you want to handle retries yourself:

```typescript
const response = await client.chat(messages, {
  retry: false
})
```

### Customizing Retry Count

Increase or decrease retry attempts:

```typescript
const response = await client.chat(messages, {
  maxRetries: 5  // Default is 3
})
```

### Validation Errors

Catch invalid input before it reaches the API:

```typescript
import { ValidationError } from '@motioneffector/llm'

try {
  await client.chat([])  // Empty messages
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Invalid: ${error.message}`)
    console.log(`Field: ${error.field}`)  // 'messages'
  }
}
```

## Related

- **[Error Handling](Guide-Error-Handling)** - Complete guide with patterns
- **[Errors API](API-Errors)** - Full reference for all error types
- **[Client API](API-Client)** - Retry options documentation
