# Building Conversations

Create multi-turn conversations with automatic history management. Conversations track context so each message builds on previous exchanges.

## Prerequisites

Before starting, you should:

- Know the basics of [sending messages](Guide-Sending-Messages)
- Understand the [messages format](Concept-Messages)

## Overview

We'll build a conversation by:

1. Creating a conversation with an optional system prompt
2. Sending messages with `send()`
3. Accessing and managing history
4. Resetting when needed

## Step 1: Create the Conversation

Create a conversation from the client. Optionally provide a system prompt.

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const conversation = client.createConversation({
  system: 'You are a helpful coding assistant.'
})
```

## Step 2: Send Messages

Call `send()` with your message content. The conversation:
1. Adds your message to history
2. Sends all history to the API
3. Adds the response to history
4. Returns the response text

```typescript
const reply = await conversation.send('How do I read a file in Python?')
console.log(reply)
```

## Step 3: Continue the Conversation

Each `send()` automatically includes previous context:

```typescript
const reply1 = await conversation.send('How do I read a file in Python?')
console.log(reply1)

const reply2 = await conversation.send('Now show me how to write to it.')
console.log(reply2)
// Model knows "it" refers to the file
```

## Step 4: Access History

Read the full conversation with `history`:

```typescript
console.log(conversation.history)
// [
//   { role: 'system', content: 'You are a helpful coding assistant.' },
//   { role: 'user', content: 'How do I read a file in Python?' },
//   { role: 'assistant', content: '...' },
//   { role: 'user', content: 'Now show me how to write to it.' },
//   { role: 'assistant', content: '...' }
// ]
```

## Complete Example

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const conversation = client.createConversation({
  system: 'You are a TypeScript expert. Be concise.'
})

console.log('User: What is a generic type?')
const reply1 = await conversation.send('What is a generic type?')
console.log(`Assistant: ${reply1}\n`)

console.log('User: Show me an example with arrays.')
const reply2 = await conversation.send('Show me an example with arrays.')
console.log(`Assistant: ${reply2}\n`)

console.log('User: How do I constrain the type?')
const reply3 = await conversation.send('How do I constrain the type?')
console.log(`Assistant: ${reply3}\n`)

console.log(`Total messages: ${conversation.history.length}`)
```

## Variations

### Without System Prompt

System prompt is optional:

```typescript
const conversation = client.createConversation()
const reply = await conversation.send('Hello!')
```

### Streaming Responses

Use `sendStream()` for real-time output:

```typescript
const conversation = client.createConversation({
  system: 'Tell engaging stories.'
})

console.log('User: Tell me a story about a robot.')

for await (const chunk of conversation.sendStream('Tell me a story about a robot.')) {
  process.stdout.write(chunk)
}

console.log()
// History includes the complete response
```

### Manually Adding Messages

Seed history without making API calls:

```typescript
const conversation = client.createConversation()

// Inject prior context
conversation.addMessage('user', 'My name is Alice.')
conversation.addMessage('assistant', 'Nice to meet you, Alice!')

// Continue naturally
const reply = await conversation.send('What is my name?')
// Model will know it's Alice
```

### Clearing History

Reset the conversation while keeping the system prompt:

```typescript
conversation.clear()
// System prompt retained, messages cleared

conversation.clearAll()
// Everything cleared, including system prompt
```

### With Initial Messages

Pre-populate the conversation:

```typescript
const conversation = client.createConversation({
  system: 'You are a math tutor.',
  initialMessages: [
    { role: 'user', content: 'What is 2+2?' },
    { role: 'assistant', content: '2+2 equals 4.' }
  ]
})

const reply = await conversation.send('What about 3+3?')
```

## Troubleshooting

### ConcurrencyError

**Symptom:** `ConcurrencyError: Cannot perform operation while a request is in progress`

**Cause:** You called `send()` or `sendStream()` while another request is pending.

**Solution:** Wait for the previous request to complete:

```typescript
// Wrong
conversation.send('First')  // Don't await
conversation.send('Second') // Throws!

// Right
await conversation.send('First')
await conversation.send('Second')
```

### History Too Long

**Symptom:** Requests fail or become slow as conversation grows.

**Cause:** Context window exceeded or high token usage.

**Solution:** Use `clear()` to reset, or start a new conversation. Check `client.estimateChat(conversation.history)` to see token usage.

### System Prompt Not Working

**Symptom:** Model ignores system prompt instructions.

**Cause:** Some models handle system prompts differently.

**Solution:** Verify the system message is first in history with `console.log(conversation.history[0])`. Try rephrasing or being more explicit.

## See Also

- **[Conversations](Concept-Conversations)** - How conversations work
- **[Streaming Responses](Guide-Streaming-Responses)** - Using `sendStream()`
- **[Conversation API](API-Conversation)** - Full method reference
