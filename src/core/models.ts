import type { ModelInfo } from '../types'

const MODEL_DATABASE: Record<string, ModelInfo> = {
  'anthropic/claude-sonnet-4': {
    contextLength: 200000,
    pricing: {
      prompt: 3.0,
      completion: 15.0,
    },
  },
  'anthropic/claude-3-opus': {
    contextLength: 200000,
    pricing: {
      prompt: 15.0,
      completion: 75.0,
    },
  },
  'openai/gpt-4o': {
    contextLength: 128000,
    pricing: {
      prompt: 5.0,
      completion: 15.0,
    },
  },
  'openai/gpt-4-turbo': {
    contextLength: 128000,
    pricing: {
      prompt: 10.0,
      completion: 30.0,
    },
  },
  'meta-llama/llama-3.1-405b': {
    contextLength: 128000,
    pricing: {
      prompt: 3.0,
      completion: 3.0,
    },
  },
}

export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODEL_DATABASE[modelId]
}
