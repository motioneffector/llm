# @motioneffector/llm - Test Specification

Test-driven development specification for the LLM client library.

---

## Type Definitions

Reference types used throughout tests:

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

interface ChatResponse {
  content: string
  usage: TokenUsage
  model: string
  id: string
  finishReason: 'stop' | 'length' | 'content_filter' | null
  latency: number  // milliseconds
}

interface ClientOptions {
  apiKey: string
  model: string
  baseUrl?: string
  defaultParams?: GenerationParams
  referer?: string  // OpenRouter HTTP-Referer header
  title?: string    // OpenRouter X-Title header
}

interface GenerationParams {
  temperature?: number    // 0-2
  maxTokens?: number
  topP?: number          // 0-1
  stop?: string[]
}

interface ChatOptions extends GenerationParams {
  model?: string
  signal?: AbortSignal
  retry?: boolean
  maxRetries?: number
}

interface ConversationOptions {
  system?: string
  initialMessages?: Message[]
}

interface ModelInfo {
  contextLength: number
  pricing: { prompt: number, completion: number }  // per 1M tokens
}
```

---

## 1. Client Creation

### `createLLMClient(options)`

```
✓ creates client with apiKey and model
  - Input: { apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' }
  - Returns: LLMClient instance with chat, stream, createConversation methods

✓ throws ValidationError if apiKey is missing
  - Input: { model: 'anthropic/claude-sonnet-4' }
  - Throws: ValidationError with message containing 'apiKey'

✓ throws ValidationError if apiKey is empty string
  - Input: { apiKey: '', model: 'anthropic/claude-sonnet-4' }
  - Throws: ValidationError

✓ throws ValidationError if model is missing
  - Input: { apiKey: 'sk-test' }
  - Throws: ValidationError with message containing 'model'

✓ throws ValidationError if model is empty string
  - Input: { apiKey: 'sk-test', model: '' }
  - Throws: ValidationError

✓ accepts custom baseUrl
  - Input: { apiKey: 'sk-test', model: 'gpt-4', baseUrl: 'https://api.openai.com/v1' }
  - Client uses provided baseUrl for requests

✓ defaults baseUrl to OpenRouter
  - Input: { apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' }
  - Requests go to 'https://openrouter.ai/api/v1'

✓ accepts defaultParams for generation settings
  - Input: { apiKey: 'sk-test', model: 'x', defaultParams: { temperature: 0.7, maxTokens: 1000 } }
  - These params are used in subsequent chat() calls

✓ accepts referer option for OpenRouter header
  - Input: { apiKey: 'sk-test', model: 'x', referer: 'https://myapp.com' }
  - HTTP-Referer header uses provided value

✓ accepts title option for OpenRouter header
  - Input: { apiKey: 'sk-test', model: 'x', title: 'My Application' }
  - X-Title header uses provided value

✓ does not make any network requests on creation
  - Creating client should not trigger any fetch calls
  - Verified by checking mock fetch was not called
```

---

## 2. Basic Chat Completion

### `client.chat(messages)`

```
✓ sends messages array to API and returns response
  - Input: [{ role: 'user', content: 'Hello' }]
  - Makes POST request to /chat/completions
  - Returns ChatResponse object

✓ returns response with content string
  - Response: { content: 'Hello! How can I help?' }
  - content is extracted from choices[0].message.content

✓ returns response with usage stats
  - Response: { usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } }
  - Maps from API's prompt_tokens/completion_tokens/total_tokens

✓ returns response with model identifier
  - Response: { model: 'anthropic/claude-sonnet-4' }
  - model reflects actual model used (may differ from requested)

✓ returns response with request id
  - Response: { id: 'chatcmpl-abc123' }
  - id is from API response

✓ returns response with finishReason
  - Response: { finishReason: 'stop' }
  - Maps from choices[0].finish_reason
  - Possible values: 'stop', 'length', 'content_filter', null

✓ returns response with latency in milliseconds
  - Response: { latency: 1234 }
  - Measured from request start to response complete

✓ handles single user message
  - Input: [{ role: 'user', content: 'Hi' }]
  - Sends array with one message

✓ handles system + user messages
  - Input: [{ role: 'system', content: 'Be helpful' }, { role: 'user', content: 'Hi' }]
  - Sends both messages in order

✓ handles full conversation history
  - Input: [system, user, assistant, user, assistant, user]
  - Sends complete history to API

✓ handles response with null usage data
  - API returns: { choices: [...], usage: null }
  - Response: { usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }

✓ handles response with missing usage field
  - API returns: { choices: [...] } (no usage key)
  - Response: { usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }
```

### Request Format

```
✓ sends Authorization header with Bearer token
  - Header: 'Authorization: Bearer sk-test'

✓ sends Content-Type header as application/json
  - Header: 'Content-Type: application/json'

✓ sends model in request body
  - Body contains: { model: 'anthropic/claude-sonnet-4' }

✓ sends messages array in request body
  - Body contains: { messages: [...] }
  - Each message has role and content fields

✓ sends HTTP-Referer header for OpenRouter (default baseUrl)
  - Header: 'HTTP-Referer: https://localhost' (default)
  - Or custom value if referer option provided

✓ sends X-Title header for OpenRouter (default baseUrl)
  - Header: 'X-Title: @motioneffector/llm' (default)
  - Or custom value if title option provided

✓ omits OpenRouter headers when baseUrl is not OpenRouter
  - baseUrl: 'https://api.openai.com/v1'
  - HTTP-Referer and X-Title headers are NOT sent
  - Detection: baseUrl does not contain 'openrouter'

✓ sends stream: false for non-streaming requests
  - Body contains: { stream: false }
```

---

## 3. Message Validation

### Input Validation

```
✓ throws ValidationError for empty messages array
  - Input: []
  - Throws: ValidationError with message 'messages array cannot be empty'
  - No network request is made

✓ throws ValidationError for invalid role
  - Input: [{ role: 'admin', content: 'Hi' }]
  - Throws: ValidationError with message containing 'role'
  - Valid roles: 'system', 'user', 'assistant'

✓ throws TypeError for null content
  - Input: [{ role: 'user', content: null }]
  - Throws: TypeError with message containing 'content'

✓ throws TypeError for undefined content
  - Input: [{ role: 'user', content: undefined }]
  - Throws: TypeError

✓ throws TypeError for non-string content
  - Input: [{ role: 'user', content: 123 }]
  - Throws: TypeError

✓ allows empty string content
  - Input: [{ role: 'user', content: '' }]
  - Does NOT throw, sends to API

✓ allows whitespace-only content
  - Input: [{ role: 'user', content: '   ' }]
  - Does NOT throw, sends to API

✓ validates all messages in array, not just first
  - Input: [{ role: 'user', content: 'Hi' }, { role: 'invalid', content: 'x' }]
  - Throws: ValidationError for second message

✓ handles messages with unicode and emoji
  - Input: [{ role: 'user', content: '你好 👋 مرحبا' }]
  - Sends correctly encoded

✓ handles messages with newlines
  - Input: [{ role: 'user', content: 'Line 1\nLine 2\n\nLine 4' }]
  - Sends with newlines preserved

✓ does not validate message length (let API handle)
  - Very long content is sent to API
  - API may return error for exceeding context
```

---

## 4. Chat Options

### `client.chat(messages, options)`

```
✓ temperature option is sent to API
  - Options: { temperature: 0.5 }
  - Body contains: { temperature: 0.5 }

✓ temperature must be between 0 and 2
  - Options: { temperature: 2.5 }
  - Throws: ValidationError

✓ maxTokens option is sent as max_tokens
  - Options: { maxTokens: 500 }
  - Body contains: { max_tokens: 500 }

✓ topP option is sent as top_p
  - Options: { topP: 0.9 }
  - Body contains: { top_p: 0.9 }

✓ model option overrides default model
  - Client default: 'anthropic/claude-sonnet-4'
  - Options: { model: 'openai/gpt-4' }
  - Body contains: { model: 'openai/gpt-4' }

✓ stop option sends stop sequences
  - Options: { stop: ['END', '###'] }
  - Body contains: { stop: ['END', '###'] }

✓ options override defaultParams from client creation
  - Client defaultParams: { temperature: 0.7 }
  - Options: { temperature: 0.2 }
  - Body contains: { temperature: 0.2 }

✓ options merge with defaultParams (non-conflicting)
  - Client defaultParams: { temperature: 0.7 }
  - Options: { maxTokens: 100 }
  - Body contains: { temperature: 0.7, max_tokens: 100 }

✓ undefined options do not override defaultParams
  - Client defaultParams: { temperature: 0.7 }
  - Options: { temperature: undefined }
  - Body contains: { temperature: 0.7 }
```

---

## 5. Streaming

### `client.stream(messages)`

```
✓ returns async iterable
  - const stream = client.stream(messages)
  - stream[Symbol.asyncIterator] exists

✓ yields string chunks as they arrive
  - for await (const chunk of stream) { /* chunk is string */ }

✓ final concatenation equals complete response
  - let full = ''; for await (const c of stream) full += c;
  - full === complete assistant response

✓ sends stream: true in request body
  - Body contains: { stream: true }

✓ handles SSE format correctly
  - Parses 'data: {...}\n\n' format

✓ handles [DONE] signal
  - 'data: [DONE]\n\n' terminates stream
  - No error thrown, iteration ends

✓ handles data: prefix in SSE lines
  - Strips 'data: ' prefix before JSON parsing

✓ handles multiple chunks in single SSE event
  - Some APIs batch multiple deltas

✓ skips empty SSE lines
  - Blank lines between events are ignored

✓ skips SSE comments (lines starting with :)
  - ': keep-alive' lines are ignored
```

### Stream Iteration

```
✓ can iterate with for-await-of
  - for await (const chunk of client.stream(msgs)) { }
  - Works correctly

✓ can break early from iteration
  - for await (const chunk of stream) { break; }
  - No error thrown, resources cleaned up

✓ stream is single-use (cannot iterate twice)
  - const stream = client.stream(msgs)
  - First iteration: works
  - Second iteration: yields nothing or throws

✓ partially consumed stream cleans up automatically
  - No explicit dispose() needed after break
```

### Stream Options

```
✓ accepts same options as chat()
  - client.stream(messages, { temperature: 0.5 })
  - Options sent in request body

✓ accepts AbortSignal
  - client.stream(messages, { signal })
  - Stream can be cancelled mid-iteration
```

### Stream Edge Cases

```
✓ handles empty stream (no content chunks)
  - API sends: 'data: [DONE]' immediately
  - Full response is empty string ''
  - No error thrown

✓ handles connection drop mid-stream
  - Network fails during iteration
  - Throws: NetworkError

✓ handles malformed SSE chunk
  - 'data: {invalid json}\n\n'
  - Throws: ParseError

✓ handles chunk with empty content delta
  - delta: { content: '' }
  - Skipped, does not yield empty string
```

---

## 6. Conversation Management

### `client.createConversation(options?)`

```
✓ creates conversation object
  - Returns object with send, sendStream, history, clear methods

✓ accepts optional system prompt
  - Options: { system: 'You are helpful' }
  - System message prepended to all requests

✓ accepts optional initial messages
  - Options: { initialMessages: [{ role: 'user', content: 'Hi' }] }
  - History starts with these messages

✓ allows system message in initialMessages
  - Options: { initialMessages: [{ role: 'system', content: 'Be brief' }] }
  - Valid, used as system prompt

✓ allows both system and initialMessages with system
  - Options: { system: 'X', initialMessages: [{ role: 'system', content: 'Y' }] }
  - system option takes precedence, initialMessages system is kept in history

✓ allows empty initialMessages array
  - Options: { initialMessages: [] }
  - Equivalent to not providing it

✓ allows non-alternating messages in initialMessages
  - Options: { initialMessages: [user, user, assistant] }
  - Valid, no alternation requirement

✓ starts with empty history if no options
  - const conv = client.createConversation()
  - conv.history returns []
```

### `conversation.send(content)`

```
✓ sends user message and returns assistant response string
  - Input: 'Hello'
  - Returns: 'Hi there! How can I help?'

✓ adds user message to history before request
  - Input: 'Hello'
  - history includes { role: 'user', content: 'Hello' }

✓ adds assistant response to history after completion
  - Response: 'Hi there!'
  - history includes { role: 'assistant', content: 'Hi there!' }

✓ subsequent send() includes full history
  - send('Hello') → 'Hi'
  - send('How are you?')
  - Second request includes: [user: Hello, assistant: Hi, user: How are you?]

✓ system prompt is included first in every request
  - system: 'Be helpful'
  - Every API request starts with system message

✓ throws ConcurrencyError if called while previous send is pending
  - send('First') // don't await
  - send('Second') // throws ConcurrencyError immediately
```

### `conversation.sendStream(content)`

```
✓ sends user message and returns async iterable
  - Input: 'Hello'
  - Returns: AsyncIterable<string>

✓ adds user message to history immediately (before streaming)
  - sendStream('Hello')
  - history immediately includes user message

✓ adds complete assistant response to history after stream ends
  - Stream yields: 'Hi', ' there'
  - After iteration: history includes { role: 'assistant', content: 'Hi there' }

✓ does NOT add partial response to history if stream errors
  - Stream yields 'Hi' then throws NetworkError
  - history does NOT include partial assistant message
  - User message IS in history (was added before request)

✓ does NOT add response to history if stream is aborted
  - Stream cancelled via AbortSignal
  - history does NOT include assistant message

✓ throws ConcurrencyError if called while previous request is pending
  - sendStream('First') // don't await iteration
  - sendStream('Second') // throws ConcurrencyError
```

### `conversation.history`

```
✓ returns full message history array
  - Returns: Message[]

✓ includes system message if set (as first element)
  - system: 'Be helpful'
  - history[0] === { role: 'system', content: 'Be helpful' }

✓ returns defensive copy (mutations don't affect internal state)
  - const h = conversation.history
  - h.push({ role: 'user', content: 'X' })
  - conversation.history does NOT include X

✓ returns empty array for new conversation without initialMessages
  - const conv = client.createConversation()
  - conv.history.length === 0
```

### `conversation.addMessage(role, content)`

```
✓ manually adds message to history
  - addMessage('user', 'Injected')
  - history includes the message

✓ accepts 'user' role
  - addMessage('user', 'Hello')
  - Works correctly

✓ accepts 'assistant' role
  - addMessage('assistant', 'Hi')
  - Works correctly

✓ throws ValidationError for 'system' role
  - addMessage('system', 'X')
  - Throws: ValidationError with message 'use constructor for system prompt'

✓ throws ValidationError for invalid role
  - addMessage('admin', 'X')
  - Throws: ValidationError

✓ throws TypeError for non-string content
  - addMessage('user', null)
  - Throws: TypeError

✓ throws ConcurrencyError if called during pending request
  - send('Hello') // don't await
  - addMessage('user', 'X') // throws
```

### `conversation.clear()`

```
✓ clears all messages except system prompt
  - After multiple send() calls
  - clear()
  - history only contains system message (if set)

✓ system prompt retained if originally set
  - system: 'Be helpful'
  - send() then clear()
  - history === [{ role: 'system', content: 'Be helpful' }]

✓ results in empty history if no system prompt
  - No system option
  - send() then clear()
  - history === []

✓ throws ConcurrencyError if called during pending request
  - send('Hello') // don't await
  - clear() // throws
```

### `conversation.clearAll()`

```
✓ clears all messages including system prompt
  - system: 'Be helpful'
  - send() then clearAll()
  - history === []

✓ throws ConcurrencyError if called during pending request
  - send('Hello') // don't await
  - clearAll() // throws
```

---

## 7. Request Cancellation

### `client.chat(messages, { signal })`

```
✓ accepts AbortSignal option
  - const controller = new AbortController()
  - client.chat(messages, { signal: controller.signal })

✓ aborts in-flight request when signal fires
  - controller.abort() during request
  - Underlying fetch is aborted

✓ throws AbortError when cancelled
  - controller.abort()
  - Throws: AbortError (or DOMException with name 'AbortError')

✓ throws AbortError immediately for pre-aborted signal
  - const controller = new AbortController()
  - controller.abort()
  - client.chat(messages, { signal: controller.signal })
  - Throws immediately, no request made

✓ AbortError includes abort reason if provided
  - controller.abort(new Error('User cancelled'))
  - error.cause === abort reason
```

### `client.stream(messages, { signal })`

```
✓ accepts AbortSignal option
  - const controller = new AbortController()
  - client.stream(messages, { signal: controller.signal })

✓ stops stream iteration when signal fires
  - controller.abort() during for-await
  - Iteration terminates

✓ throws AbortError when stream is aborted
  - Throws during next iteration after abort

✓ partially yielded content is available before abort
  - Stream yields 'Hello', ' world'
  - Abort after 'Hello'
  - Already yielded 'Hello' was received

✓ throws immediately for pre-aborted signal
  - Pre-aborted signal passed
  - Throws AbortError before first yield
```

### Abort During Retry

```
✓ aborts retry wait when signal fires
  - Request fails with 429
  - During backoff wait, signal.abort()
  - Throws AbortError, does not continue retry
```

---

## 8. Error Handling

### Error Types

```
All custom errors extend Error and have:
- name: string (error class name)
- message: string (human readable)
- cause?: Error (original error if wrapped)

✓ ValidationError for input validation failures
✓ TypeError for type mismatches
✓ RateLimitError for 429 responses
✓ AuthError for 401/403 responses
✓ ModelError for model-related 404 responses
✓ ServerError for 5xx responses
✓ NetworkError for fetch/connection failures
✓ ParseError for JSON/response parsing failures
✓ AbortError for cancelled requests
✓ ConcurrencyError for concurrent conversation operations
```

### HTTP Errors

```
✓ throws RateLimitError on 429
  - Status: 429
  - Throws: RateLimitError
  - error.status === 429

✓ RateLimitError includes retryAfter if header present
  - Response header: 'Retry-After: 30'
  - error.retryAfter === 30

✓ throws AuthError on 401
  - Status: 401
  - Throws: AuthError
  - error.status === 401

✓ throws AuthError on 403
  - Status: 403
  - Throws: AuthError

✓ throws ModelError on 404 (model not found)
  - Status: 404
  - Throws: ModelError
  - error.status === 404

✓ throws ServerError on 500
  - Status: 500
  - Throws: ServerError

✓ throws ServerError on 502, 503, 504
  - Each status throws ServerError
  - error.status reflects actual status

✓ error includes response body message if available
  - Response body: { error: { message: 'Model not found' } }
  - error.message includes 'Model not found'

✓ error handles non-JSON error response body
  - Response body: 'Internal server error'
  - error.message includes response text

✓ throws ServerError for unknown 4xx/5xx status
  - Status: 418, 599
  - Throws: ServerError with status

✓ throws NetworkError for non-HTTP errors during fetch
  - fetch throws TypeError (invalid URL, etc.)
  - Throws: NetworkError with cause
```

### Network Errors

```
✓ throws NetworkError on fetch failure (no response)
  - fetch() rejects (network down, DNS failure)
  - Throws: NetworkError

✓ throws NetworkError on connection timeout
  - Request times out
  - Throws: NetworkError

✓ error.cause contains original error
  - Original: TypeError('Failed to fetch')
  - error.cause === original error
```

### Parse Errors

```
✓ throws ParseError on invalid JSON response
  - Response body: 'not json'
  - Status: 200
  - Throws: ParseError

✓ throws ParseError on unexpected response structure
  - Response: { unexpected: 'format' }
  - Missing choices array
  - Throws: ParseError

✓ throws ParseError on missing content in response
  - Response: { choices: [{ message: {} }] }
  - Throws: ParseError (or returns empty string - decide based on API behavior)

✓ ParseError includes response body in message for debugging
  - error.message includes truncated response body
```

---

## 9. Retry Logic

### Automatic Retry

```
✓ retries on 429 (rate limit)
  - First request: 429
  - Second request: 200
  - Returns successful response

✓ retries on 500
  - Server error, then success
  - Returns successful response

✓ retries on 502, 503, 504
  - Each gateway error triggers retry

✓ does NOT retry on 400
  - Status: 400
  - Throws immediately, no retry

✓ does NOT retry on 401
  - Auth error
  - Throws immediately

✓ does NOT retry on 403
  - Forbidden
  - Throws immediately

✓ does NOT retry on 404
  - Model not found
  - Throws immediately

✓ respects Retry-After header if present
  - Response header: 'Retry-After: 2'
  - Waits at least 2 seconds before retry

✓ uses exponential backoff: 1s, 2s, 4s
  - First retry after ~1000ms
  - Second retry after ~2000ms
  - Third retry after ~4000ms
  - (with jitter)

✓ backoff capped at 30 seconds
  - Even with many retries, never waits more than 30s

✓ maximum 3 retries by default (4 total attempts)
  - Attempts: original + 3 retries
  - After 4th failure, throws error

✓ maxRetries option overrides default
  - Options: { maxRetries: 5 }
  - Allows up to 5 retries (6 total attempts)

✓ maxRetries: 0 means no retries
  - Options: { maxRetries: 0 }
  - Single attempt, throws on first failure
```

### `client.chat(messages, { retry: false })`

```
✓ disables automatic retry entirely
  - Options: { retry: false }
  - 429 response
  - Throws immediately

✓ throws immediately on retriable error
  - 503 with retry: false
  - Throws ServerError, no retry
```

### Retry and Streaming

```
✓ streaming does NOT retry (fails fast)
  - client.stream(messages)
  - 429 response
  - Throws immediately, no retry

✓ streaming retry: true option is ignored
  - Options have no effect for streams
```

---

## 10. Token Estimation

### `estimateTokens(text)`

```
✓ returns estimated token count for string
  - Input: 'Hello world'
  - Returns: number (approximately 3)

✓ returns 0 for empty string
  - Input: ''
  - Returns: 0

✓ uses simple heuristic: characters / 4
  - Input: 'Hello' (5 chars)
  - Returns: approximately 1-2

✓ handles unicode correctly
  - Input: '你好世界' (4 chars, but multi-byte)
  - Returns: reasonable estimate

✓ rounds to nearest integer
  - Never returns fractional tokens
```

### `client.estimateChat(messages)`

```
✓ estimates tokens for full message array
  - Input: [{ role: 'user', content: 'Hello' }]
  - Returns: { prompt: number }

✓ accounts for message structure overhead
  - Each message has ~4 token overhead for role/formatting
  - [{ role: 'user', content: 'Hi' }] > estimateTokens('Hi')

✓ sums all message contents
  - Multiple messages
  - Total includes all content

✓ returns available tokens based on model context
  - Returns: { prompt: 100, available: 3900 }
  - available = model context limit - prompt estimate

✓ uses default context limit if model unknown
  - Unknown model ID
  - Uses conservative default (e.g., 4096)
```

---

## 11. Model Information

### `client.getModel()`

```
✓ returns current default model
  - Client created with model: 'anthropic/claude-sonnet-4'
  - Returns: 'anthropic/claude-sonnet-4'
```

### `client.setModel(model)`

```
✓ changes default model
  - setModel('openai/gpt-4')
  - getModel() === 'openai/gpt-4'

✓ affects subsequent requests
  - setModel('openai/gpt-4')
  - chat() uses 'openai/gpt-4'

✓ throws ValidationError for empty model
  - setModel('')
  - Throws: ValidationError

✓ does not validate model exists (API will reject invalid)
  - setModel('nonexistent/model')
  - Does not throw (validation happens at API call)
```

### `getModelInfo(modelId)`

Standalone function, not client method.

```
✓ returns model context length
  - getModelInfo('anthropic/claude-sonnet-4')
  - Returns: { contextLength: 200000, ... }

✓ returns model pricing info
  - Returns: { pricing: { prompt: 3, completion: 15 } }
  - Prices per 1 million tokens

✓ returns undefined for unknown model
  - getModelInfo('unknown/model')
  - Returns: undefined

✓ includes common models
  - anthropic/claude-sonnet-4
  - anthropic/claude-3-opus
  - openai/gpt-4o
  - openai/gpt-4-turbo
  - meta-llama/llama-3.1-405b
```

---

## 12. Multiple Providers

### OpenRouter Specifics

```
✓ handles OpenRouter-specific response format
  - OpenRouter may include additional fields
  - Parses correctly without error

✓ includes required OpenRouter headers (default baseUrl)
  - HTTP-Referer header present
  - X-Title header present

✓ parses OpenRouter error messages
  - OpenRouter error format: { error: { message, code } }
  - Error message extracted correctly
```

### Base URL Override

```
✓ custom baseUrl sends requests to that endpoint
  - baseUrl: 'https://api.openai.com/v1'
  - Requests go to 'https://api.openai.com/v1/chat/completions'

✓ works with OpenAI-compatible APIs
  - baseUrl: 'http://localhost:11434/v1' (Ollama)
  - Standard request format works

✓ omits OpenRouter-specific headers for non-OpenRouter URLs
  - baseUrl does not contain 'openrouter'
  - HTTP-Referer NOT sent
  - X-Title NOT sent

✓ includes OpenRouter headers if URL contains 'openrouter'
  - baseUrl: 'https://custom.openrouter.ai/v1'
  - Headers ARE sent

✓ appends /chat/completions to baseUrl
  - baseUrl: 'https://api.example.com/v1'
  - Requests to: 'https://api.example.com/v1/chat/completions'

✓ handles baseUrl with trailing slash
  - baseUrl: 'https://api.example.com/v1/'
  - Does not double-slash: '.../v1/chat/completions'
```

---

## 13. Edge Cases

### Request Edge Cases

```
✓ handles rapid successive requests
  - await chat(), await chat(), await chat()
  - All complete successfully

✓ handles concurrent requests (different calls)
  - Promise.all([chat(a), chat(b), chat(c)])
  - All complete independently

✓ handles very long messages (sends to API, may fail)
  - Content: 'x'.repeat(1000000)
  - Request sent, API may return error

✓ handles special characters in content
  - Content with quotes, backslashes, etc.
  - JSON serialization handles correctly
```

### Response Edge Cases

```
✓ handles response with empty content
  - API returns: { choices: [{ message: { content: '' } }] }
  - Returns: { content: '' }

✓ handles response with null content
  - API returns: { choices: [{ message: { content: null } }] }
  - Returns: { content: '' } (coerce to empty string)

✓ handles unexpected extra fields in response
  - API returns additional fields
  - Ignores them, extracts known fields
```

### Conversation Edge Cases

```
✓ conversation works after clear()
  - send(), clear(), send()
  - Second send works correctly

✓ conversation works after error
  - send() throws NetworkError
  - Retry send() works

✓ history not corrupted after failed request
  - send('Hello') throws
  - history still valid (may include user message)
```

---

## 14. Exports

### Module Exports

```
✓ exports createLLMClient function
  - import { createLLMClient } from '@motioneffector/llm'

✓ exports estimateTokens function
  - import { estimateTokens } from '@motioneffector/llm'

✓ exports getModelInfo function
  - import { getModelInfo } from '@motioneffector/llm'

✓ exports error classes
  - import { ValidationError, RateLimitError, AuthError, ... } from '@motioneffector/llm'

✓ exports TypeScript types
  - import type { Message, ChatResponse, TokenUsage, ... } from '@motioneffector/llm'
```

---

## Test Utilities Needed

```
Mock Infrastructure:
- Mock fetch implementation that can return configured responses
- Mock SSE stream generator for streaming tests
- Fixture responses for success, errors, and edge cases
- Helper to create test client with mocked fetch

Timing Utilities:
- Fake timers for retry backoff testing
- Latency measurement verification

Assertion Helpers:
- Assert request body contains expected fields
- Assert headers are correct
- Assert error type and properties
```

---

## Test Organization

Suggested test file structure:

```
tests/
├── client.test.ts          # createLLMClient, basic options
├── chat.test.ts            # client.chat() functionality
├── stream.test.ts          # client.stream() functionality
├── conversation.test.ts    # Conversation management
├── validation.test.ts      # Input validation, error types
├── retry.test.ts           # Retry logic, backoff
├── cancellation.test.ts    # AbortSignal handling
├── tokens.test.ts          # Token estimation
├── models.test.ts          # Model info, switching
├── providers.test.ts       # Multi-provider, baseUrl
└── fixtures/
    ├── responses.ts        # Mock API responses
    └── streams.ts          # Mock SSE streams
```
