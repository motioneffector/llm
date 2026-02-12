import { describe, it, expect } from 'vitest'
import * as LLM from './index'

describe('Module Exports', () => {
  it('exports createLLMClient function', () => {
    const createLLMClient = LLM.createLLMClient
    expect(createLLMClient).toBe(LLM.createLLMClient)
    const client = createLLMClient({ apiKey: 'sk-test', model: 'test' })
    expect(client.getModel()).toBe('test')
  })

  it('exports estimateTokens function', () => {
    const estimateTokens = LLM.estimateTokens
    expect(estimateTokens).toBe(LLM.estimateTokens)
    const result = estimateTokens('Hello')
    expect(result).toBe(2)
  })

  it('exports getModelInfo function', () => {
    const getModelInfo = LLM.getModelInfo
    expect(getModelInfo).toBe(LLM.getModelInfo)
    const info = getModelInfo('anthropic/claude-sonnet-4')
    expect(info).toEqual({
      contextLength: 200000,
      pricing: { prompt: 3.0, completion: 15.0 },
    })
  })

  it('exports error classes', () => {
    const valErr = new LLM.ValidationError('test')
    expect(valErr.name).toBe('ValidationError')
    const rateErr = new LLM.RateLimitError('test', 429)
    expect(rateErr.name).toBe('RateLimitError')
    const authErr = new LLM.AuthError('test', 401)
    expect(authErr.name).toBe('AuthError')
    const modelErr = new LLM.ModelError('test', 404)
    expect(modelErr.name).toBe('ModelError')
    const serverErr = new LLM.ServerError('test', 500)
    expect(serverErr.name).toBe('ServerError')
    const netErr = new LLM.NetworkError('test')
    expect(netErr.name).toBe('NetworkError')
    const parseErr = new LLM.ParseError('test')
    expect(parseErr.name).toBe('ParseError')
    const concErr = new LLM.ConcurrencyError('test')
    expect(concErr.name).toBe('ConcurrencyError')
  })

  it('exports TypeScript types', () => {
    // This test verifies that types can be imported
    // The types themselves are checked at compile time
    type _Message = LLM.Message
    type _ChatResponse = LLM.ChatResponse
    type _TokenUsage = LLM.TokenUsage
    type _ClientOptions = LLM.ClientOptions
    type _GenerationParams = LLM.GenerationParams
    type _ChatOptions = LLM.ChatOptions
    type _ConversationOptions = LLM.ConversationOptions
    type _ModelInfo = LLM.ModelInfo
    type _LLMClient = LLM.LLMClient
    type _Conversation = LLM.Conversation

    // If types are properly exported, this test passes
    expect(true).toBe(true)
  })
})
