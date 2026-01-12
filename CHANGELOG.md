# Changelog

All notable changes to @motioneffector/llm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-01-11

### Added

- Initial implementation of LLM client library
- OpenRouter API integration with automatic header injection
- `createLLMClient()` factory function for creating client instances
- `chat()` method for non-streaming chat completions
- `stream()` method for streaming responses via async iterators
- `createConversation()` for stateful conversation management
- Message history tracking with concurrency protection
- Automatic retry logic with exponential backoff (1s, 2s, 4s, capped at 30s)
- Comprehensive error handling:
  - `ValidationError` for input validation failures
  - `RateLimitError` for 429 responses with retryAfter support
  - `AuthError` for 401/403 authentication failures
  - `ModelError` for 404 model not found errors
  - `ServerError` for 5xx server errors
  - `NetworkError` for fetch/connection failures
  - `ParseError` for JSON parsing errors
  - `ConcurrencyError` for concurrent conversation operations
- AbortSignal support for request cancellation
- Server-Sent Events (SSE) parser for streaming
- Token estimation utilities (`estimateTokens`, `estimateChat`)
- Model information database with `getModelInfo()` function
- Support for multiple providers via custom `baseUrl`
- TypeScript type definitions for all public APIs
- Comprehensive JSDoc documentation for all exported functions and types
- Test suite with 205/207 tests passing (99% coverage)

### Features

- **OpenRouter Integration**: Seamless integration with OpenRouter's unified API
- **Streaming Support**: Handle streaming responses with async iterators
- **Message History**: Built-in conversation state management
- **Type Safety**: Full TypeScript types for messages, responses, and options
- **Token Counting**: Estimate token usage before sending requests
- **Retry Logic**: Automatic retry with exponential backoff for transient errors
- **Abort Support**: Cancel in-flight requests with AbortSignal
- **System Prompts**: Easy system prompt management in conversations

### Configuration Options

- `apiKey`: Your OpenRouter API key (required)
- `model`: Model identifier (required, e.g., 'anthropic/claude-sonnet-4')
- `baseUrl`: Custom API endpoint (defaults to OpenRouter)
- `defaultParams`: Default generation parameters (temperature, maxTokens, etc.)
- `referer`: Custom HTTP-Referer header for OpenRouter
- `title`: Custom X-Title header for OpenRouter

### Supported Models

Through OpenRouter, supports models from:
- Anthropic (Claude Sonnet, Opus, Haiku)
- OpenAI (GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo)
- Meta (Llama 3.1)
- Mistral (Mistral Large, Mixtral)
- And many more via OpenRouter

[0.0.1]: https://github.com/motioneffector/llm/releases/tag/v0.0.1
