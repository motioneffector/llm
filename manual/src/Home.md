# @motioneffector/llm

Think of this library as `fetch` for LLMs. It handles the tedious parts—authentication, retries, streaming, conversation state—so you can focus on what to say, not how to say it. You describe messages, it talks to the API and gives you back responses.

## I want to...

| Goal | Where to go |
|------|-------------|
| Get up and running quickly | [Your First Chat](Your-First-Chat) |
| Send a chat message | [Sending Messages](Guide-Sending-Messages) |
| Stream responses in real-time | [Streaming Responses](Guide-Streaming-Responses) |
| Build a multi-turn conversation | [Conversations](Concept-Conversations) |
| Handle errors and rate limits | [Error Handling](Guide-Error-Handling) |
| Look up a specific method | [API Reference](API-Client) |

## Key Concepts

### Client

The client is your configured connection to the LLM API. Create it once with your API key and model, then use it throughout your application to send messages and manage conversations.

### Messages

Messages are the structured format for LLM communication. Every interaction is an array of messages with roles (system, user, assistant) and content. The model reads the full array and responds based on the conversation pattern.

### Conversations

Conversations are stateful wrappers that automatically track message history. Instead of manually building message arrays for each turn, you call `send()` with new content and the conversation handles context.

## Quick Example

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY,
  model: 'anthropic/claude-sonnet-4'
})

const response = await client.chat([
  { role: 'user', content: 'Explain quantum computing in simple terms' }
])

console.log(response.content)
console.log(`Used ${response.usage.totalTokens} tokens in ${response.latency}ms`)
```

---

**[Full API Reference →](API-Client)**
