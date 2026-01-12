export const mockSuccessResponse = {
  ok: true,
  status: 200,
  json: async () => ({
    id: 'chatcmpl-test123',
    model: 'anthropic/claude-sonnet-4',
    choices: [
      {
        message: { role: 'assistant', content: 'Hello! How can I help?' },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
  }),
}

export function createMockResponse(overrides?: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'chatcmpl-test123',
      model: 'anthropic/claude-sonnet-4',
      choices: [
        {
          message: { role: 'assistant', content: 'Response' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
      ...overrides,
    }),
  } as Response
}

export function createMockStream(chunks: string[]): ReadableStream {
  const encoder = new TextEncoder()
  let index = 0

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        const data = `data: ${JSON.stringify({
          choices: [{ delta: { content: chunks[index] } }],
        })}\n\n`
        controller.enqueue(encoder.encode(data))
        index++
      } else {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}

export function createMockErrorResponse(
  status: number,
  message = 'Error message'
): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      error: { message },
    }),
  } as Response
}
