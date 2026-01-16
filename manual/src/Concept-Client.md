# Client

The client is your configured connection to the LLM API. You create it once with your credentials and settings, then use it throughout your application to send messages, stream responses, and create conversations.

## How It Works

Think of the client like a database connection pool. You configure it once at startup with authentication and default settings, then use that same instance for all your requests. The client handles:

- Authentication (API key in headers)
- Request formatting (converting your messages to the API format)
- Retries (automatic retry with exponential backoff on failures)
- Response parsing (extracting content, usage stats, and metadata)

```
┌─────────────┐      ┌────────────┐      ┌─────────────┐
│ Your Code   │ ──►  │   Client   │ ──►  │ OpenRouter  │
│             │      │            │      │     API     │
│ messages[]  │      │ auth       │      │             │
│             │ ◄──  │ retries    │ ◄──  │  response   │
│ response    │      │ parsing    │      │             │
└─────────────┘      └────────────┘      └─────────────┘
```

## Basic Usage

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

// Use the client for requests
const response = await client.chat([
  { role: 'user', content: 'Hello!' }
])
```

This creates a client configured for Claude. All requests through this client use the same API key and default to the same model.

## Key Points

- **Create once, use everywhere** - Don't create a new client for each request. Create one at startup and reuse it.
- **Model can be changed** - Use `client.setModel()` to change the default, or pass `model` in request options to override per-request.
- **Default parameters** - Set `defaultParams` when creating the client to apply settings like `temperature` to all requests.
- **OpenRouter is the default** - The client defaults to OpenRouter's API. Use `baseUrl` to connect to other providers.

## Examples

### With Default Parameters

Set generation parameters that apply to all requests:

```typescript
const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4',
  defaultParams: {
    temperature: 0.7,
    maxTokens: 1000
  }
})
```

### Switching Models at Runtime

Change the default model without creating a new client:

```typescript
client.setModel('openai/gpt-4o')

// All future requests use GPT-4o
const response = await client.chat([
  { role: 'user', content: 'Hello!' }
])
```

### Override Model Per-Request

Use a different model for a specific request:

```typescript
const response = await client.chat(
  [{ role: 'user', content: 'Hello!' }],
  { model: 'openai/gpt-4o' }
)
// Uses GPT-4o for this request only
```

## Related

- **[Messages](Concept-Messages)** - The format for communicating with LLMs
- **[Sending Messages](Guide-Sending-Messages)** - Complete guide to chat requests
- **[Client API](API-Client)** - Full method reference
