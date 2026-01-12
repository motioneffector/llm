import { NetworkError, ParseError } from '../errors'

interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
}

export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (!response.body) {
    throw new NetworkError('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel()
        throw new DOMException('The operation was aborted', 'AbortError')
      }

      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()

        if (!trimmedLine || trimmedLine.startsWith(':')) {
          continue
        }

        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6)

          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data) as StreamChunk

            const content = parsed.choices?.[0]?.delta?.content

            if (content && content.length > 0) {
              yield content
            }
          } catch (error) {
            throw new ParseError(
              `Failed to parse SSE chunk: ${(error as Error).message}`,
              error as Error
            )
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    if (error instanceof ParseError) {
      throw error
    }

    throw new NetworkError(`Stream reading failed: ${(error as Error).message}`, error as Error)
  } finally {
    reader.releaseLock()
  }
}
