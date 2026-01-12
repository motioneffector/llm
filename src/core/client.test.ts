import { describe, it, expect, vi } from 'vitest'
import { createLLMClient } from './client'
import { ValidationError } from '../errors'

describe('createLLMClient(options)', () => {
  it('creates client with apiKey and model', () => {
    const client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    expect(client).toBeDefined()
    expect(client.chat).toBeDefined()
    expect(client.stream).toBeDefined()
    expect(client.createConversation).toBeDefined()
  })

  it('throws ValidationError if apiKey is missing', () => {
    expect(() =>
      // @ts-expect-error - Testing runtime validation
      createLLMClient({ model: 'anthropic/claude-sonnet-4' })
    ).toThrow(ValidationError)
    expect(() =>
      // @ts-expect-error - Testing runtime validation
      createLLMClient({ model: 'anthropic/claude-sonnet-4' })
    ).toThrow(/apiKey/)
  })

  it('throws ValidationError if apiKey is empty string', () => {
    expect(() => createLLMClient({ apiKey: '', model: 'anthropic/claude-sonnet-4' })).toThrow(
      ValidationError
    )
  })

  it('throws ValidationError if model is missing', () => {
    expect(() =>
      // @ts-expect-error - Testing runtime validation
      createLLMClient({ apiKey: 'sk-test' })
    ).toThrow(ValidationError)
    expect(() =>
      // @ts-expect-error - Testing runtime validation
      createLLMClient({ apiKey: 'sk-test' })
    ).toThrow(/model/)
  })

  it('throws ValidationError if model is empty string', () => {
    expect(() => createLLMClient({ apiKey: 'sk-test', model: '' })).toThrow(ValidationError)
  })

  it('accepts custom baseUrl', () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'gpt-4',
      baseUrl: 'https://api.openai.com/v1',
    })
    expect(client).toBeDefined()
  })

  it('defaults baseUrl to OpenRouter', () => {
    const client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    expect(client).toBeDefined()
  })

  it('accepts defaultParams for generation settings', () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'x',
      defaultParams: { temperature: 0.7, maxTokens: 1000 },
    })
    expect(client).toBeDefined()
  })

  it('accepts referer option for OpenRouter header', () => {
    const client = createLLMClient({
      apiKey: 'sk-test',
      model: 'x',
      referer: 'https://myapp.com',
    })
    expect(client).toBeDefined()
  })

  it('accepts title option for OpenRouter header', () => {
    const client = createLLMClient({ apiKey: 'sk-test', model: 'x', title: 'My Application' })
    expect(client).toBeDefined()
  })

  it('does not make any network requests on creation', () => {
    createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
