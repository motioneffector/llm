# Messages

Messages are the structured format for communicating with LLMs. Every interaction is an array of messages, each with a role and content. The model reads the entire array as context and generates a response based on the conversation pattern.

## How It Works

An LLM doesn't remember previous requests. Each API call includes the full conversation history as an array of messages. The model sees this array, understands the flow, and generates the next response.

```
Request 1: [user: "Hi"]           → Response: "Hello!"
Request 2: [user: "Hi",
            assistant: "Hello!",
            user: "How are you?"] → Response: "I'm doing well!"
```

Messages have three roles:

| Role | Purpose |
|------|---------|
| `system` | Sets the model's behavior, persona, or instructions. Usually first. |
| `user` | Your input—questions, commands, content to process. |
| `assistant` | The model's previous responses. Included for context. |

## Basic Usage

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const response = await client.chat([
  { role: 'system', content: 'You are a helpful coding assistant.' },
  { role: 'user', content: 'How do I read a file in Node.js?' }
])
```

The model sees the system instruction and the user question, then responds as a coding assistant.

## Key Points

- **Order matters** - System message first, then user/assistant messages in conversation order.
- **Content is always a string** - No objects, no arrays, just text.
- **Build the array yourself** - For simple requests, you construct the array. For multi-turn conversations, use [Conversations](Concept-Conversations) to manage history automatically.
- **Assistant messages are context** - When continuing a conversation, include previous assistant responses so the model knows what it already said.

## Examples

### Simple Question

A single user message is the simplest case:

```typescript
const response = await client.chat([
  { role: 'user', content: 'What is TypeScript?' }
])
```

### With System Prompt

Add a system message to control behavior:

```typescript
const response = await client.chat([
  { role: 'system', content: 'Respond in exactly one sentence.' },
  { role: 'user', content: 'Explain quantum computing.' }
])
```

### Multi-Turn Conversation

Include previous exchanges for context:

```typescript
const response = await client.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
  { role: 'assistant', content: 'The capital of France is Paris.' },
  { role: 'user', content: 'What is its population?' }
])
// Model knows "its" refers to Paris
```

## Related

- **[Client](Concept-Client)** - Where messages are sent
- **[Conversations](Concept-Conversations)** - Automatic history management for multi-turn chats
- **[Sending Messages](Guide-Sending-Messages)** - Complete guide with all options
