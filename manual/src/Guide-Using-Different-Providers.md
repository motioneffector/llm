# Using Different Providers

Connect to LLM providers other than OpenRouter—OpenAI direct, Anthropic direct, or self-hosted endpoints. This guide covers custom base URLs and provider-specific configuration.

## Prerequisites

Before starting, you should:

- Know the basics of [creating a client](Concept-Client)
- Have API credentials for your target provider

## Overview

We'll use different providers by:

1. Setting a custom `baseUrl`
2. Using provider-specific model names
3. Adjusting headers if needed

## Step 1: Set the Base URL

Pass `baseUrl` when creating the client to point to a different API:

```typescript
import { createLLMClient } from '@motioneffector/llm'

const client = createLLMClient({
  apiKey: process.env.OPENAI_KEY!,
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1'
})
```

The client appends `/chat/completions` to the base URL, so provide just the base path.

## Step 2: Use Provider Model Names

Each provider has its own model naming:

```typescript
// OpenAI
const openai = createLLMClient({
  apiKey: process.env.OPENAI_KEY!,
  model: 'gpt-4o',  // Not 'openai/gpt-4o'
  baseUrl: 'https://api.openai.com/v1'
})

// Anthropic
const anthropic = createLLMClient({
  apiKey: process.env.ANTHROPIC_KEY!,
  model: 'claude-sonnet-4-20250514',  // Anthropic's format
  baseUrl: 'https://api.anthropic.com/v1'
})
```

## Step 3: Handle Provider Differences

OpenRouter headers (`HTTP-Referer`, `X-Title`) are only sent when the URL contains "openrouter". Other providers don't need them.

The library handles standard OpenAI-compatible APIs. Providers with different formats may need additional configuration or may not be compatible.

## Complete Example

```typescript
import { createLLMClient } from '@motioneffector/llm'

// OpenAI Direct
const openai = createLLMClient({
  apiKey: process.env.OPENAI_KEY!,
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1'
})

const response = await openai.chat([
  { role: 'user', content: 'Hello from OpenAI!' }
])

console.log(response.content)
```

## Variations

### OpenAI

```typescript
const client = createLLMClient({
  apiKey: process.env.OPENAI_KEY!,
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1'
})
```

Available models: `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`, etc.

### Azure OpenAI

Azure uses a different URL format with deployments:

```typescript
const client = createLLMClient({
  apiKey: process.env.AZURE_OPENAI_KEY!,
  model: 'gpt-4',  // Deployment name
  baseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT'
})
```

Note: Azure may require additional headers. Check Azure documentation for current requirements.

### Local Models (Ollama, LM Studio)

Connect to locally-running models:

```typescript
// Ollama
const ollama = createLLMClient({
  apiKey: 'ollama',  // Ollama doesn't require a key
  model: 'llama2',
  baseUrl: 'http://localhost:11434/v1'
})

// LM Studio
const lmstudio = createLLMClient({
  apiKey: 'lm-studio',
  model: 'local-model',
  baseUrl: 'http://localhost:1234/v1'
})
```

### Together.ai

```typescript
const client = createLLMClient({
  apiKey: process.env.TOGETHER_KEY!,
  model: 'meta-llama/Llama-3-70b-chat-hf',
  baseUrl: 'https://api.together.xyz/v1'
})
```

### Groq

```typescript
const client = createLLMClient({
  apiKey: process.env.GROQ_KEY!,
  model: 'llama3-70b-8192',
  baseUrl: 'https://api.groq.com/openai/v1'
})
```

### Multiple Providers in One App

Create separate clients for different providers:

```typescript
const openai = createLLMClient({
  apiKey: process.env.OPENAI_KEY!,
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1'
})

const anthropic = createLLMClient({
  apiKey: process.env.ANTHROPIC_KEY!,
  model: 'claude-sonnet-4-20250514',
  baseUrl: 'https://api.anthropic.com/v1'
})

// Use the appropriate client
const response = await openai.chat(messages)
```

## Troubleshooting

### 404 Not Found

**Symptom:** Request returns 404.

**Cause:** Wrong base URL or model name.

**Solution:** Check the provider's documentation for the correct endpoint. The library appends `/chat/completions`, so don't include that in the base URL.

### Authentication Failed

**Symptom:** 401 or 403 error.

**Cause:** Wrong API key or key format.

**Solution:** Verify the key is for the correct provider. Some providers use different key formats (Bearer token vs API key header).

### Unsupported Response Format

**Symptom:** Parse errors or missing content.

**Cause:** Provider uses non-standard response format.

**Solution:** The library expects OpenAI-compatible responses. Providers with different formats may not work without modification.

### Headers Not Sent

**Symptom:** Provider rejects requests for missing headers.

**Cause:** Custom headers needed for this provider.

**Solution:** Currently the library doesn't support custom headers. Consider using OpenRouter as a proxy instead, which handles provider-specific requirements.

## See Also

- **[Client](Concept-Client)** - Client configuration options
- **[Client API](API-Client)** - `baseUrl` option reference
