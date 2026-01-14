# Errors

Error classes for handling different failure modes. All errors extend the base `LLMError` class.

---

## Error Hierarchy

```
LLMError (base)
├── ValidationError
├── AuthError
├── RateLimitError
├── ModelError
├── ServerError
├── NetworkError
├── ParseError
└── ConcurrencyError
```

---

## `LLMError`

Base class for all library errors.

```typescript
class LLMError extends Error {
  name: 'LLMError'
  message: string
}
```

**Example:**

```typescript
import { LLMError } from '@motioneffector/llm'

try {
  await client.chat(messages)
} catch (error) {
  if (error instanceof LLMError) {
    console.log('LLM-related error:', error.message)
  }
}
```

---

## `ValidationError`

Thrown when input validation fails. Catches invalid parameters before making API requests.

```typescript
class ValidationError extends LLMError {
  name: 'ValidationError'
  field?: string
}
```

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string \| undefined` | The invalid field name |

**Thrown when:**

- Messages array is empty
- Message has invalid role
- Message content is not a string
- Temperature is outside 0-2 range
- API key or model is empty

**Example:**

```typescript
import { ValidationError } from '@motioneffector/llm'

try {
  await client.chat([])
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Invalid ${error.field}: ${error.message}`)
  }
}
```

---

## `AuthError`

Thrown when authentication fails.

```typescript
class AuthError extends LLMError {
  name: 'AuthError'
  status: number
}
```

| Property | Type | Description |
|----------|------|-------------|
| `status` | `number` | HTTP status code (401 or 403) |

**Thrown when:**

- API key is invalid (401)
- API key lacks permission (403)

**Example:**

```typescript
import { AuthError } from '@motioneffector/llm'

try {
  await client.chat(messages)
} catch (error) {
  if (error instanceof AuthError) {
    console.log(`Auth failed (${error.status}): ${error.message}`)
  }
}
```

---

## `RateLimitError`

Thrown when rate limit is exceeded.

```typescript
class RateLimitError extends LLMError {
  name: 'RateLimitError'
  status: number
  retryAfter?: number
}
```

| Property | Type | Description |
|----------|------|-------------|
| `status` | `number` | HTTP status code (429) |
| `retryAfter` | `number \| undefined` | Seconds to wait before retrying |

**Notes:**

- Automatic retries are attempted before this error is thrown
- `retryAfter` comes from the Retry-After header if provided

**Example:**

```typescript
import { RateLimitError } from '@motioneffector/llm'

try {
  await client.chat(messages)
} catch (error) {
  if (error instanceof RateLimitError) {
    const wait = error.retryAfter ?? 60
    console.log(`Rate limited. Retry in ${wait} seconds`)
  }
}
```

---

## `ModelError`

Thrown when the requested model is unavailable.

```typescript
class ModelError extends LLMError {
  name: 'ModelError'
  status: number
}
```

| Property | Type | Description |
|----------|------|-------------|
| `status` | `number` | HTTP status code (404) |

**Thrown when:**

- Model doesn't exist
- Model is temporarily unavailable

**Example:**

```typescript
import { ModelError } from '@motioneffector/llm'

try {
  await client.chat(messages)
} catch (error) {
  if (error instanceof ModelError) {
    console.log('Model unavailable:', error.message)
  }
}
```

---

## `ServerError`

Thrown when the API server returns an error.

```typescript
class ServerError extends LLMError {
  name: 'ServerError'
  status: number
}
```

| Property | Type | Description |
|----------|------|-------------|
| `status` | `number` | HTTP status code (5xx) |

**Notes:**

- Automatic retries are attempted for 5xx errors before this is thrown

**Example:**

```typescript
import { ServerError } from '@motioneffector/llm'

try {
  await client.chat(messages)
} catch (error) {
  if (error instanceof ServerError) {
    console.log(`Server error (${error.status}): ${error.message}`)
  }
}
```

---

## `NetworkError`

Thrown when network request fails.

```typescript
class NetworkError extends LLMError {
  name: 'NetworkError'
  cause?: Error
}
```

| Property | Type | Description |
|----------|------|-------------|
| `cause` | `Error \| undefined` | The underlying error |

**Thrown when:**

- Connection refused
- DNS lookup failed
- Request timeout
- Network unreachable

**Example:**

```typescript
import { NetworkError } from '@motioneffector/llm'

try {
  await client.chat(messages)
} catch (error) {
  if (error instanceof NetworkError) {
    console.log('Network failed:', error.message)
    if (error.cause) {
      console.log('Caused by:', error.cause.message)
    }
  }
}
```

---

## `ParseError`

Thrown when response parsing fails.

```typescript
class ParseError extends LLMError {
  name: 'ParseError'
  cause?: Error
}
```

| Property | Type | Description |
|----------|------|-------------|
| `cause` | `Error \| undefined` | The underlying error |

**Thrown when:**

- Response is not valid JSON
- Response missing expected fields
- Streaming chunk is malformed

**Example:**

```typescript
import { ParseError } from '@motioneffector/llm'

try {
  await client.chat(messages)
} catch (error) {
  if (error instanceof ParseError) {
    console.log('Failed to parse response:', error.message)
  }
}
```

---

## `ConcurrencyError`

Thrown when attempting concurrent operations on a conversation.

```typescript
class ConcurrencyError extends LLMError {
  name: 'ConcurrencyError'
}
```

**Thrown when:**

- Calling `send()` while another `send()` is pending
- Calling `sendStream()` while a request is in progress
- Calling `addMessage()`, `clear()`, or `clearAll()` during a request

**Example:**

```typescript
import { ConcurrencyError } from '@motioneffector/llm'

try {
  // Don't do this
  conversation.send('First')  // Not awaited
  await conversation.send('Second')  // Throws ConcurrencyError
} catch (error) {
  if (error instanceof ConcurrencyError) {
    console.log('Wait for the previous request to complete')
  }
}
```

---

## Importing Errors

Import individual error types or the base class:

```typescript
// Individual errors
import {
  LLMError,
  ValidationError,
  RateLimitError,
  AuthError,
  ModelError,
  ServerError,
  NetworkError,
  ParseError,
  ConcurrencyError
} from '@motioneffector/llm'

// Check against base class
if (error instanceof LLMError) {
  // It's one of ours
}

// Check specific types
if (error instanceof RateLimitError) {
  // Handle rate limiting
}
```
