/**
 * Estimates the number of tokens in a text string.
 *
 * Uses a simple heuristic (1 token ≈ 4 characters) for fast estimation.
 * This is an approximation and may differ from actual tokenization.
 *
 * @param text - The text to estimate tokens for
 * @returns The estimated number of tokens
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens('Hello, world!')
 * console.log(tokens) // 4
 * ```
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0
  return Math.ceil(text.length / 4)
}
