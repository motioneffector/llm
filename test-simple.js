import { createLLMClient } from './src/core/client.ts'
import { vi } from 'vitest'

const client = createLLMClient({ apiKey: 'test', model: 'test' })

global.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 401,
  json: async () => ({ error: { message: 'Auth error' } }),
  headers: new Map()
})

try {
  await client.chat([{ role: 'user', content: 'test' }])
} catch (e) {
  console.log('Error caught:', e.constructor.name)
}
