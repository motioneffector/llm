import { describe, it, expect } from 'vitest'
import * as LLM from './index'

describe('Module Exports', () => {
  it('exports createLLMClient function', () => {
    expect(LLM.createLLMClient).toBeDefined()
    expect(typeof LLM.createLLMClient).toBe('function')
  })

  it('exports estimateTokens function', () => {
    expect(LLM.estimateTokens).toBeDefined()
    expect(typeof LLM.estimateTokens).toBe('function')
  })

  it('exports getModelInfo function', () => {
    expect(LLM.getModelInfo).toBeDefined()
    expect(typeof LLM.getModelInfo).toBe('function')
  })

  it('exports error classes', () => {
    expect(LLM.ValidationError).toBeDefined()
    expect(LLM.RateLimitError).toBeDefined()
    expect(LLM.AuthError).toBeDefined()
    expect(LLM.ModelError).toBeDefined()
    expect(LLM.ServerError).toBeDefined()
    expect(LLM.NetworkError).toBeDefined()
    expect(LLM.ParseError).toBeDefined()
    expect(LLM.ConcurrencyError).toBeDefined()

    expect(typeof LLM.ValidationError).toBe('function')
    expect(typeof LLM.RateLimitError).toBe('function')
    expect(typeof LLM.AuthError).toBe('function')
    expect(typeof LLM.ModelError).toBe('function')
    expect(typeof LLM.ServerError).toBe('function')
    expect(typeof LLM.NetworkError).toBe('function')
    expect(typeof LLM.ParseError).toBe('function')
    expect(typeof LLM.ConcurrencyError).toBe('function')
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
