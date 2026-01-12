import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './src/core/client.ts'
import { AuthError } from './src/errors.ts'

describe('Debug Test', () => {
  let client

  beforeEach(() => {
    global.fetch = vi.fn()
    vi.mocked(fetch).mockReset()
    client = createLLMClient({ apiKey: 'sk-test', model: 'test' })
  })

  it('should throw AuthError on 401', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    }
    
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(AuthError)
  })
})
