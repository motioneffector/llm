# Conversation API

Methods for managing stateful conversations with automatic history tracking.

---

## `conversation.send()`

Sends a user message and returns the assistant's response. History is updated automatically.

**Signature:**

```typescript
function send(
  content: string,
  options?: ChatOptions
): Promise<string>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `content` | `string` | Yes | The user's message content |
| `options` | `ChatOptions` | No | Request-specific options |

**Returns:** `Promise<string>` — The assistant's response text.

**Example:**

```typescript
const conversation = client.createConversation()

const reply = await conversation.send('What is TypeScript?')
console.log(reply)
```

**Throws:**

- `ConcurrencyError` — If another request is in progress
- `ValidationError` — If content is invalid
- `AuthError`, `RateLimitError`, `NetworkError` — API errors

---

## `conversation.sendStream()`

Sends a user message and streams the assistant's response. History is updated after the stream completes.

**Signature:**

```typescript
function sendStream(
  content: string,
  options?: ChatOptions
): AsyncIterable<string>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `content` | `string` | Yes | The user's message content |
| `options` | `ChatOptions` | No | Request-specific options |

**Returns:** `AsyncIterable<string>` — An async iterable yielding response chunks.

**Example:**

```typescript
const conversation = client.createConversation()

for await (const chunk of conversation.sendStream('Tell me a story')) {
  process.stdout.write(chunk)
}
```

**Throws:**

- `ConcurrencyError` — If another request is in progress
- `ValidationError` — If content is invalid

---

## `conversation.history`

The full message history including system prompt and all exchanges.

**Type:** `Message[]` (readonly)

**Example:**

```typescript
const conversation = client.createConversation({
  system: 'Be helpful.'
})

await conversation.send('Hello')

console.log(conversation.history)
// [
//   { role: 'system', content: 'Be helpful.' },
//   { role: 'user', content: 'Hello' },
//   { role: 'assistant', content: '...' }
// ]
```

**Notes:**

- Returns a defensive copy; mutations don't affect internal state
- System prompt appears first if set

---

## `conversation.addMessage()`

Manually adds a message to history without making an API call.

**Signature:**

```typescript
function addMessage(
  role: 'user' | 'assistant',
  content: string
): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `role` | `'user' \| 'assistant'` | Yes | The message role |
| `content` | `string` | Yes | The message content |

**Example:**

```typescript
const conversation = client.createConversation()

// Seed with prior context
conversation.addMessage('user', 'My name is Alice.')
conversation.addMessage('assistant', 'Nice to meet you, Alice!')

// Continue naturally
const reply = await conversation.send('What is my name?')
```

**Throws:**

- `ConcurrencyError` — If a request is in progress
- `ValidationError` — If role is `'system'` or invalid
- `TypeError` — If content is not a string

---

## `conversation.clear()`

Clears all messages except the system prompt.

**Signature:**

```typescript
function clear(): void
```

**Example:**

```typescript
const conversation = client.createConversation({
  system: 'Be helpful.'
})

await conversation.send('Hello')
await conversation.send('How are you?')

conversation.clear()

console.log(conversation.history)
// [{ role: 'system', content: 'Be helpful.' }]
```

**Throws:**

- `ConcurrencyError` — If a request is in progress

---

## `conversation.clearAll()`

Clears all messages including the system prompt.

**Signature:**

```typescript
function clearAll(): void
```

**Example:**

```typescript
conversation.clearAll()

console.log(conversation.history)
// []
```

**Throws:**

- `ConcurrencyError` — If a request is in progress

---

## Types

### `Conversation`

```typescript
interface Conversation {
  send(content: string, options?: ChatOptions): Promise<string>
  sendStream(content: string, options?: ChatOptions): AsyncIterable<string>
  history: Message[]
  addMessage(role: 'user' | 'assistant', content: string): void
  clear(): void
  clearAll(): void
}
```

### `ConversationOptions`

```typescript
interface ConversationOptions {
  system?: string
  initialMessages?: Message[]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `system` | `string` | No | System prompt to guide model behavior |
| `initialMessages` | `Message[]` | No | Pre-populated message history |
