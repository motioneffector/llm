# Conversations

Conversations are stateful wrappers that automatically maintain message history across multiple exchanges. Instead of manually building the messages array for each turn, you call `send()` with new content and the conversation handles context.

## How It Works

When you use `client.chat()` directly, you're responsible for tracking history:

```typescript
// Manual history management
const messages = [{ role: 'system', content: 'Be helpful.' }]

messages.push({ role: 'user', content: 'Hi' })
const response1 = await client.chat(messages)
messages.push({ role: 'assistant', content: response1.content })

messages.push({ role: 'user', content: 'How are you?' })
const response2 = await client.chat(messages)
messages.push({ role: 'assistant', content: response2.content })
```

Conversations automate this:

```typescript
// Automatic history management
const conversation = client.createConversation({ system: 'Be helpful.' })

const reply1 = await conversation.send('Hi')
const reply2 = await conversation.send('How are you?')
// History is tracked automatically
```

The conversation:
1. Adds your message to history
2. Sends the full history to the API
3. Adds the response to history
4. Returns just the response text

## Basic Usage

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const conversation = client.createConversation({
  system: 'You are a helpful coding assistant.'
})

const reply1 = await conversation.send('How do I read a file in Python?')
console.log(reply1)

const reply2 = await conversation.send('Now show me how to write to it.')
console.log(reply2)
// The model knows "it" refers to the file from the previous exchange
```

## Key Points

- **Created from the client** - Call `client.createConversation()` to create one.
- **System prompt is optional** - Pass `system` to set the model's behavior.
- **History is accessible** - Read `conversation.history` to see all messages.
- **Returns just content** - `send()` returns the response string, not the full response object.
- **One request at a time** - Concurrent `send()` calls throw `ConcurrencyError`.
- **Clear to reset** - Use `clear()` to remove messages but keep system prompt, or `clearAll()` to reset everything.

## Examples

### With System Prompt

Set the model's behavior at creation:

```typescript
const conversation = client.createConversation({
  system: 'Respond only in haiku format.'
})

const reply = await conversation.send('Tell me about the ocean')
// Response will be a haiku
```

### Streaming in Conversations

Use `sendStream()` for real-time responses:

```typescript
const conversation = client.createConversation()

for await (const chunk of conversation.sendStream('Write a story')) {
  process.stdout.write(chunk)
}
// History is updated after stream completes
```

### Accessing History

Read the full conversation:

```typescript
const conversation = client.createConversation({ system: 'Be brief.' })

await conversation.send('What is TypeScript?')
await conversation.send('Who created it?')

console.log(conversation.history)
// [
//   { role: 'system', content: 'Be brief.' },
//   { role: 'user', content: 'What is TypeScript?' },
//   { role: 'assistant', content: '...' },
//   { role: 'user', content: 'Who created it?' },
//   { role: 'assistant', content: '...' }
// ]
```

### Resetting the Conversation

Clear messages to start fresh:

```typescript
conversation.clear()    // Keeps system prompt, removes other messages
conversation.clearAll() // Removes everything including system prompt
```

## Related

- **[Messages](Concept-Messages)** - The underlying message format
- **[Building Conversations](Guide-Building-Conversations)** - Complete guide with examples
- **[Conversation API](API-Conversation)** - Full method reference
