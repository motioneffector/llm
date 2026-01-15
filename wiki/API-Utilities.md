# Utilities

Helper functions for model information and token estimation.

---

## `getModelInfo()`

Retrieves information about a specific model's capabilities and pricing.

**Signature:**

```typescript
function getModelInfo(modelId: string): ModelInfo | undefined
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `modelId` | `string` | Yes | The model identifier (e.g., `'anthropic/claude-sonnet-4'`) |

**Returns:** `ModelInfo | undefined` — Model information if found, undefined otherwise.

**Example:**

```typescript
import { getModelInfo } from '@motioneffector/llm'

const info = getModelInfo('anthropic/claude-sonnet-4')

if (info) {
  console.log(`Context: ${info.contextLength} tokens`)
  console.log(`Prompt cost: $${info.pricing.prompt}/M tokens`)
  console.log(`Completion cost: $${info.pricing.completion}/M tokens`)
}
```

**Available Models:**

| Model ID | Context Length | Prompt $/M | Completion $/M |
|----------|---------------|------------|----------------|
| `anthropic/claude-sonnet-4` | 200,000 | $3.00 | $15.00 |
| `anthropic/claude-3-opus` | 200,000 | $15.00 | $75.00 |
| `openai/gpt-4o` | 128,000 | $5.00 | $15.00 |
| `openai/gpt-4-turbo` | 128,000 | $10.00 | $30.00 |
| `meta-llama/llama-3.1-405b` | 128,000 | $3.00 | $3.00 |

**Notes:**

- Returns `undefined` for unknown models
- Pricing is in USD per million tokens
- Data may not reflect current API pricing; check provider for latest rates

---

## `estimateTokens()`

Estimates the number of tokens in a text string.

**Signature:**

```typescript
function estimateTokens(text: string): number
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | Yes | The text to estimate tokens for |

**Returns:** `number` — Estimated token count.

**Example:**

```typescript
import { estimateTokens } from '@motioneffector/llm'

const text = 'Hello, world! How are you doing today?'
const tokens = estimateTokens(text)

console.log(`Estimated tokens: ${tokens}`)
// Estimated tokens: 10
```

**Notes:**

- Uses a simple heuristic: 1 token ≈ 4 characters
- This is an approximation; actual tokenization varies by model
- Empty strings return 0
- Useful for rough estimates before sending requests

**Example with messages:**

```typescript
import { estimateTokens } from '@motioneffector/llm'

const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain quantum computing.' }
]

let totalTokens = 0
for (const message of messages) {
  totalTokens += estimateTokens(message.content)
  totalTokens += 3  // Overhead per message
}

console.log(`Estimated prompt tokens: ${totalTokens}`)
```

---

## Types

### `ModelInfo`

```typescript
interface ModelInfo {
  contextLength: number
  pricing: {
    prompt: number
    completion: number
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `contextLength` | `number` | Maximum tokens the model can process |
| `pricing.prompt` | `number` | Cost per million prompt tokens (USD) |
| `pricing.completion` | `number` | Cost per million completion tokens (USD) |
