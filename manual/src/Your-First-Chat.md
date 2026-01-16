# Your First Chat

Send a message to an LLM and get a response in under 5 minutes.

By the end of this guide, you'll have a working script that sends a message to Claude and prints the response with usage statistics.

## What We're Building

A simple script that asks Claude to explain a concept and displays the response along with token usage and latency metrics:

```
Quantum computing uses quantum bits (qubits) that can exist in multiple
states simultaneously, unlike classical bits...

Used 127 tokens in 1243ms
```

## Step 1: Get an API Key

Sign up at [OpenRouter](https://openrouter.ai/) and create an API key. OpenRouter provides access to 200+ models through a single API.

Set the key as an environment variable:

```bash
export OPENROUTER_KEY="sk-or-v1-..."
```

## Step 2: Create the Client

The client is your connection to the API. Create it with your key and the model you want to use.

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})
```

The client handles authentication, retries, and request formatting automatically.

## Step 3: Send a Message

Call `chat()` with an array of messages. Each message has a `role` and `content`.

```typescript
const response = await client.chat([
  { role: 'user', content: 'Explain quantum computing in simple terms' }
])
```

The library sends the request, waits for the response, and returns a structured result.

## Step 4: Use the Response

The response object contains the generated text plus metadata about the request.

```typescript
console.log(response.content)
console.log(`Used ${response.usage.totalTokens} tokens in ${response.latency}ms`)
```

## The Complete Code

Here's everything together:

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENROUTER_KEY!,
  model: 'anthropic/claude-sonnet-4'
})

const response = await client.chat([
  { role: 'user', content: 'Explain quantum computing in simple terms' }
])

console.log(response.content)
console.log(`Used ${response.usage.totalTokens} tokens in ${response.latency}ms`)
```

Run it with:

```bash
npx tsx chat.ts
```

## What's Next?

Now that you have the basics:

- **[Understand the Client](Concept-Client)** - Learn how the client works and what you can configure
- **[Stream Responses](Guide-Streaming-Responses)** - Display text as it's generated instead of waiting
- **[Build Conversations](Guide-Building-Conversations)** - Create multi-turn dialogues with automatic history
- **[Explore the API](API-Client)** - Full reference when you need details
