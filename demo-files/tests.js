// Import library to ensure it is available (also set by demo.js)
import * as Library from '../dist/index.js'
if (!window.Library) window.Library = Library

// Extract library exports for tests
const {
  createLLMClient,
  estimateTokens,
  MODELS,
  getModelInfo,
  ValidationError,
  RateLimitError,
  AuthError,
  NetworkError,
  LLMError
} = window.Library

// ============================================
// DEMO INTEGRITY TESTS
// These tests verify the demo itself is correctly structured.
// They are IDENTICAL across all @motioneffector demos.
// Do not modify, skip, or weaken these tests.
// ============================================

function registerIntegrityTests() {
  // ─────────────────────────────────────────────
  // STRUCTURAL INTEGRITY
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] Library is loaded', () => {
    if (typeof window.Library === 'undefined') {
      throw new Error('window.Library is undefined - library not loaded')
    }
  });

  testRunner.registerTest('[Integrity] Library has exports', () => {
    const exports = Object.keys(window.Library)
    if (exports.length === 0) {
      throw new Error('window.Library has no exports')
    }
  });

  testRunner.registerTest('[Integrity] Test runner exists', () => {
    const runner = document.getElementById('test-runner')
    if (!runner) {
      throw new Error('No element with id="test-runner"')
    }
  });

  testRunner.registerTest('[Integrity] Test runner is first section after header', () => {
    const main = document.querySelector('main')
    if (!main) {
      throw new Error('No <main> element found')
    }
    const firstSection = main.querySelector('section')
    if (!firstSection || firstSection.id !== 'test-runner') {
      throw new Error('Test runner must be the first <section> inside <main>')
    }
  });

  testRunner.registerTest('[Integrity] Run All Tests button exists with correct format', () => {
    const btn = document.getElementById('run-all-tests')
    if (!btn) {
      throw new Error('No button with id="run-all-tests"')
    }
    const text = btn.textContent.trim()
    if (!text.includes('Run All Tests')) {
      throw new Error(`Button text must include "Run All Tests", got: "${text}"`)
    }
    const icon = btn.querySelector('.btn-icon')
    if (!icon || !icon.textContent.includes('▶')) {
      throw new Error('Button must have play icon (▶) in .btn-icon element')
    }
  });

  testRunner.registerTest('[Integrity] Reset Page button exists', () => {
    const btn = document.getElementById('reset-page')
    if (!btn) {
      throw new Error('No button with id="reset-page"')
    }
  });

  testRunner.registerTest('[Integrity] At least one exhibit exists', () => {
    const exhibits = document.querySelectorAll('.exhibit')
    if (exhibits.length === 0) {
      throw new Error('No elements with class="exhibit"')
    }
  });

  testRunner.registerTest('[Integrity] All exhibits have unique IDs', () => {
    const exhibits = document.querySelectorAll('.exhibit')
    const ids = new Set()
    exhibits.forEach(ex => {
      if (!ex.id) {
        throw new Error('Exhibit missing id attribute')
      }
      if (ids.has(ex.id)) {
        throw new Error(`Duplicate exhibit id: ${ex.id}`)
      }
      ids.add(ex.id)
    })
  });

  testRunner.registerTest('[Integrity] All exhibits registered for walkthrough', () => {
    const exhibitElements = document.querySelectorAll('.exhibit')
    const registeredCount = testRunner.exhibits.length
    if (registeredCount < exhibitElements.length) {
      throw new Error(
        `Only ${registeredCount} exhibits registered for walkthrough, ` +
        `but ${exhibitElements.length} .exhibit elements exist`
      )
    }
  });

  testRunner.registerTest('[Integrity] CSS loaded from demo-files/', () => {
    const links = document.querySelectorAll('link[rel="stylesheet"]')
    const hasExternal = Array.from(links).some(link =>
      link.href.includes('demo-files/')
    )
    if (!hasExternal) {
      throw new Error('No stylesheet loaded from demo-files/ directory')
    }
  });

  testRunner.registerTest('[Integrity] No inline style tags', () => {
    const styles = document.querySelectorAll('style')
    if (styles.length > 0) {
      throw new Error(`Found ${styles.length} inline <style> tags - extract to demo-files/demo.css`)
    }
  });

  testRunner.registerTest('[Integrity] No inline onclick handlers', () => {
    const withOnclick = document.querySelectorAll('[onclick]')
    if (withOnclick.length > 0) {
      throw new Error(`Found ${withOnclick.length} elements with onclick - use addEventListener`)
    }
  });

  // ─────────────────────────────────────────────
  // NO AUTO-PLAY VERIFICATION
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] Output areas are empty on load', () => {
    const outputs = document.querySelectorAll('.exhibit-output, .output, [data-output]')
    outputs.forEach(output => {
      const hasPlaceholder = output.dataset.placeholder ||
        output.classList.contains('placeholder') ||
        output.querySelector('.placeholder')

      const text = output.textContent.trim()
      const children = output.children.length

      if ((text.length > 50 || children > 1) && !hasPlaceholder) {
        throw new Error(
          `Output area appears pre-populated: "${text.substring(0, 50)}..." - ` +
          `outputs must be empty until user interaction`
        )
      }
    })
  });

  testRunner.registerTest('[Integrity] No setTimeout calls on module load', () => {
    if (window.__suspiciousTimersDetected) {
      throw new Error(
        'Detected setTimeout/setInterval during page load - ' +
        'demos must not auto-run'
      )
    }
  });

  // ─────────────────────────────────────────────
  // VISUAL FEEDBACK VERIFICATION
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] CSS includes animation definitions', () => {
    const sheets = document.styleSheets
    let hasAnimations = false

    try {
      for (const sheet of sheets) {
        if (!sheet.href || sheet.href.includes('demo-files/')) {
          const rules = sheet.cssRules || sheet.rules
          for (const rule of rules) {
            if (rule.type === CSSRule.KEYFRAMES_RULE ||
                (rule.style && (
                  rule.style.animation ||
                  rule.style.transition ||
                  rule.style.animationName
                ))) {
              hasAnimations = true
              break
            }
          }
        }
        if (hasAnimations) break
      }
    } catch (e) {
      hasAnimations = true
    }

    if (!hasAnimations) {
      throw new Error('No CSS animations or transitions found - visual feedback required')
    }
  });

  testRunner.registerTest('[Integrity] Interactive elements have hover states', () => {
    const buttons = document.querySelectorAll('button, .btn')
    if (buttons.length === 0) return // No buttons to check

    // Check that enabled buttons have pointer cursor (disabled buttons should have not-allowed)
    const enabledBtn = Array.from(buttons).find(btn => !btn.disabled)
    if (!enabledBtn) return // All buttons are disabled, skip check

    const styles = window.getComputedStyle(enabledBtn)
    if (styles.cursor !== 'pointer') {
      throw new Error('Buttons should have cursor: pointer')
    }
  });

  // ─────────────────────────────────────────────
  // WALKTHROUGH REGISTRATION VERIFICATION
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] Walkthrough demonstrations are async functions', () => {
    testRunner.exhibits.forEach(exhibit => {
      if (typeof exhibit.demonstrate !== 'function') {
        throw new Error(`Exhibit "${exhibit.name}" has no demonstrate function`)
      }
    })
  });

  testRunner.registerTest('[Integrity] Each exhibit has required elements', () => {
    const exhibits = document.querySelectorAll('.exhibit')
    exhibits.forEach(exhibit => {
      const title = exhibit.querySelector('.exhibit-title, h2, h3')
      if (!title) {
        throw new Error(`Exhibit ${exhibit.id} missing title element`)
      }

      const interactive = exhibit.querySelector(
        '.exhibit-interactive, .exhibit-content, [data-interactive]'
      )
      if (!interactive) {
        throw new Error(`Exhibit ${exhibit.id} missing interactive area`)
      }
    })
  });
}

// Call this function at the start, before library-specific tests
registerIntegrityTests()

// ============================================
// LIBRARY-SPECIFIC TESTS
// ============================================

// Client creation validation tests - these actually test the library
testRunner.registerTest('createLLMClient throws ValidationError without apiKey', () => {
  try {
    createLLMClient({ model: 'test-model' })
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof ValidationError)) {
      throw new Error(`Expected ValidationError, got ${e.constructor.name}: ${e.message}`)
    }
    if (!e.message.includes('apiKey')) {
      throw new Error('Error should mention apiKey')
    }
  }
});

testRunner.registerTest('createLLMClient throws ValidationError without model', () => {
  try {
    createLLMClient({ apiKey: 'test-key' })
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof ValidationError)) {
      throw new Error(`Expected ValidationError, got ${e.constructor.name}: ${e.message}`)
    }
    if (!e.message.includes('model')) {
      throw new Error('Error should mention model')
    }
  }
});

testRunner.registerTest('createLLMClient throws ValidationError for empty apiKey', () => {
  try {
    createLLMClient({ apiKey: '', model: 'test-model' })
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof ValidationError)) {
      throw new Error(`Expected ValidationError, got ${e.constructor.name}`)
    }
  }
});

testRunner.registerTest('createLLMClient throws ValidationError for empty model', () => {
  try {
    createLLMClient({ apiKey: 'test-key', model: '' })
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof ValidationError)) {
      throw new Error(`Expected ValidationError, got ${e.constructor.name}`)
    }
  }
});

testRunner.registerTest('createLLMClient returns client with valid config', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  if (!client) throw new Error('Expected client to be created')
  if (typeof client.chat !== 'function') throw new Error('Expected chat method')
  if (typeof client.stream !== 'function') throw new Error('Expected stream method')
  if (typeof client.getModel !== 'function') throw new Error('Expected getModel method')
  if (typeof client.setModel !== 'function') throw new Error('Expected setModel method')
});

testRunner.registerTest('client.getModel returns configured model', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'anthropic/claude-sonnet-4' })
  const model = client.getModel()
  if (model !== 'anthropic/claude-sonnet-4') {
    throw new Error(`Expected 'anthropic/claude-sonnet-4', got '${model}'`)
  }
});

testRunner.registerTest('client.setModel changes the model', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'old-model' })
  client.setModel('new-model')
  const model = client.getModel()
  if (model !== 'new-model') {
    throw new Error(`Expected 'new-model', got '${model}'`)
  }
});

testRunner.registerTest('client.setModel throws ValidationError for empty model', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  try {
    client.setModel('')
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof ValidationError)) {
      throw new Error(`Expected ValidationError, got ${e.constructor.name}`)
    }
  }
});

// Token estimation tests - these test real library functions
testRunner.registerTest('estimateTokens returns number', () => {
  const result = estimateTokens('hello world')
  if (typeof result !== 'number') throw new Error(`Expected number, got ${typeof result}`)
});

testRunner.registerTest('estimateTokens handles empty string', () => {
  const result = estimateTokens('')
  if (result !== 0) throw new Error(`Expected 0 for empty string, got ${result}`)
});

testRunner.registerTest('estimateTokens approximates ~4 chars per token', () => {
  const text = 'hello world' // 11 chars
  const tokens = estimateTokens(text)
  if (tokens < 2 || tokens > 5) {
    throw new Error(`Token estimate ${tokens} out of expected range [2-5] for 11 chars`)
  }
});

testRunner.registerTest('estimateTokens increases with longer text', () => {
  const short = estimateTokens('hi')
  const long = estimateTokens('This is a much longer sentence with many more words and characters.')
  if (long <= short) {
    throw new Error(`Longer text (${long} tokens) should have more tokens than short (${short})`)
  }
});

// Error class tests - testing actual library error classes
testRunner.registerTest('ValidationError is properly exported', () => {
  if (typeof ValidationError !== 'function') {
    throw new Error('ValidationError should be a constructor')
  }
  const error = new ValidationError('test message', 'testField')
  if (error.name !== 'ValidationError') throw new Error(`Wrong name: ${error.name}`)
  if (error.message !== 'test message') throw new Error(`Wrong message: ${error.message}`)
  if (error.field !== 'testField') throw new Error(`Wrong field: ${error.field}`)
});

testRunner.registerTest('RateLimitError includes status and retryAfter', () => {
  if (typeof RateLimitError !== 'function') {
    throw new Error('RateLimitError should be a constructor')
  }
  const error = new RateLimitError('Rate limited', 429, 60)
  if (error.name !== 'RateLimitError') throw new Error(`Wrong name: ${error.name}`)
  if (error.status !== 429) throw new Error(`Wrong status: ${error.status}`)
  if (error.retryAfter !== 60) throw new Error(`Wrong retryAfter: ${error.retryAfter}`)
});

testRunner.registerTest('AuthError has status code', () => {
  if (typeof AuthError !== 'function') {
    throw new Error('AuthError should be a constructor')
  }
  const error = new AuthError('Unauthorized', 401)
  if (error.name !== 'AuthError') throw new Error(`Wrong name: ${error.name}`)
  if (error.status !== 401) throw new Error(`Wrong status: ${error.status}`)
});

testRunner.registerTest('NetworkError wraps underlying error', () => {
  if (typeof NetworkError !== 'function') {
    throw new Error('NetworkError should be a constructor')
  }
  const cause = new Error('connection timeout')
  const error = new NetworkError('Network request failed', cause)
  if (error.name !== 'NetworkError') throw new Error(`Wrong name: ${error.name}`)
  if (error.cause !== cause) throw new Error('cause not preserved')
});

testRunner.registerTest('All error classes extend LLMError', () => {
  const errors = [
    new ValidationError('test'),
    new RateLimitError('test', 429),
    new AuthError('test', 401),
    new NetworkError('test')
  ]
  for (const error of errors) {
    if (!(error instanceof LLMError)) {
      throw new Error(`${error.constructor.name} should extend LLMError`)
    }
  }
});

// Model info tests - testing actual library functions
testRunner.registerTest('MODELS is an array with entries', () => {
  if (!Array.isArray(MODELS)) throw new Error('MODELS should be an array')
  if (MODELS.length === 0) throw new Error('MODELS should not be empty')
});

testRunner.registerTest('getModelInfo returns undefined for unknown model', () => {
  const info = getModelInfo('unknown/nonexistent-model')
  if (info !== undefined) throw new Error('Expected undefined for unknown model')
});

testRunner.registerTest('getModelInfo returns info for known model', () => {
  const model = 'anthropic/claude-sonnet-4'
  const info = getModelInfo(model)
  if (!info) throw new Error(`Expected model info for ${model}`)
});

testRunner.registerTest('model info includes contextLength', () => {
  const info = MODELS[0]
  if (typeof info.contextLength !== 'number') {
    throw new Error(`Expected contextLength to be a number, got ${typeof info.contextLength}`)
  }
  if (info.contextLength <= 0) {
    throw new Error(`contextLength should be positive, got ${info.contextLength}`)
  }
});

testRunner.registerTest('model info includes pricing', () => {
  const info = MODELS[0]
  if (!info.pricing || typeof info.pricing !== 'object') {
    throw new Error('Expected pricing to be an object')
  }
  if (typeof info.pricing.prompt !== 'number') {
    throw new Error(`Expected pricing.prompt to be a number, got ${typeof info.pricing?.prompt}`)
  }
  if (typeof info.pricing.completion !== 'number') {
    throw new Error(`Expected pricing.completion to be a number, got ${typeof info.pricing?.completion}`)
  }
});

testRunner.registerTest('model entries have id field', () => {
  for (const model of MODELS) {
    if (typeof model.id !== 'string' || model.id === '') {
      throw new Error('Each model entry should have a non-empty id string')
    }
  }
});

// Client method structure tests
testRunner.registerTest('client has createConversation method', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  if (typeof client.createConversation !== 'function') {
    throw new Error('Expected createConversation method')
  }
});

testRunner.registerTest('client has estimateChat method', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  if (typeof client.estimateChat !== 'function') {
    throw new Error('Expected estimateChat method')
  }
});

testRunner.registerTest('estimateChat returns prompt and available tokens', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'anthropic/claude-sonnet-4' })
  const estimate = client.estimateChat([{ role: 'user', content: 'Hello!' }])
  if (typeof estimate.prompt !== 'number') {
    throw new Error(`Expected prompt to be a number, got ${typeof estimate.prompt}`)
  }
  if (typeof estimate.available !== 'number') {
    throw new Error(`Expected available to be a number, got ${typeof estimate.available}`)
  }
  if (estimate.prompt <= 0) {
    throw new Error(`Expected positive prompt tokens, got ${estimate.prompt}`)
  }
  if (estimate.available <= 0) {
    throw new Error(`Expected positive available tokens, got ${estimate.available}`)
  }
});

testRunner.registerTest('createConversation returns conversation object', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  const conversation = client.createConversation()
  if (typeof conversation.send !== 'function') throw new Error('Expected send method')
  if (typeof conversation.sendStream !== 'function') throw new Error('Expected sendStream method')
  if (!Array.isArray(conversation.history)) throw new Error('Expected history array')
  if (typeof conversation.clear !== 'function') throw new Error('Expected clear method')
  if (typeof conversation.clearAll !== 'function') throw new Error('Expected clearAll method')
});

testRunner.registerTest('createConversation accepts system prompt', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  const conversation = client.createConversation({ system: 'You are helpful.' })
  if (conversation.history.length !== 1) {
    throw new Error(`Expected 1 system message, got ${conversation.history.length}`)
  }
  if (conversation.history[0].role !== 'system') {
    throw new Error(`Expected system role, got ${conversation.history[0].role}`)
  }
  if (conversation.history[0].content !== 'You are helpful.') {
    throw new Error('System message content mismatch')
  }
});

testRunner.registerTest('conversation.addMessage adds to history', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  const conversation = client.createConversation()
  conversation.addMessage('user', 'Hello')
  conversation.addMessage('assistant', 'Hi there!')
  if (conversation.history.length !== 2) {
    throw new Error(`Expected 2 messages, got ${conversation.history.length}`)
  }
  if (conversation.history[0].content !== 'Hello') {
    throw new Error('First message content mismatch')
  }
  if (conversation.history[1].content !== 'Hi there!') {
    throw new Error('Second message content mismatch')
  }
});

testRunner.registerTest('conversation.clear preserves system prompt', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  const conversation = client.createConversation({ system: 'Be helpful' })
  conversation.addMessage('user', 'test')
  conversation.addMessage('assistant', 'response')
  conversation.clear()
  if (conversation.history.length !== 1) {
    throw new Error(`Expected 1 message (system) after clear, got ${conversation.history.length}`)
  }
  if (conversation.history[0].role !== 'system') {
    throw new Error('System prompt should be preserved')
  }
});

testRunner.registerTest('conversation.clearAll removes everything', () => {
  const client = createLLMClient({ apiKey: 'test-key', model: 'test-model' })
  const conversation = client.createConversation({ system: 'Be helpful' })
  conversation.addMessage('user', 'test')
  conversation.clearAll()
  if (conversation.history.length !== 0) {
    throw new Error(`Expected 0 messages after clearAll, got ${conversation.history.length}`)
  }
});

// ============================================
// REGISTER EXHIBITS FOR WALKTHROUGH
// ============================================

testRunner.registerExhibit(
  'Stream Decoder',
  document.getElementById('exhibit-stream-decoder'),
  async () => {
    const preset = document.getElementById('stream-preset')
    const button = document.getElementById('stream-run')

    preset.value = 'code'
    streamDecoder.currentPreset = 'code'
    await testRunner.delay(200)

    button.click()
    await testRunner.delay(800)
  }
)

testRunner.registerExhibit(
  'Resilience Lab',
  document.getElementById('exhibit-resilience-lab'),
  async () => {
    const scenarioBtn = document.querySelector('[data-scenario="rate-limit"]')

    scenarioBtn.click()
    await testRunner.delay(1200)
  }
)

testRunner.registerExhibit(
  'Conversation State Machine',
  document.getElementById('exhibit-conversation'),
  async () => {
    const preset = document.getElementById('conv-preset')
    const loadBtn = document.getElementById('conv-load-preset')
    const input = document.getElementById('conv-input')
    const sendBtn = document.getElementById('conv-send')

    preset.value = 'creative'
    await testRunner.delay(200)
    loadBtn.click()
    await testRunner.delay(400)

    input.value = 'Write a haiku about TypeScript'
    await testRunner.delay(300)
    sendBtn.click()
    await testRunner.delay(800)
  }
)

testRunner.registerExhibit(
  'Token Visualizer',
  document.getElementById('exhibit-token-visualizer'),
  async () => {
    const preset = document.getElementById('token-preset')
    const loadBtn = document.getElementById('token-load-preset')

    preset.value = 'code'
    await testRunner.delay(200)
    loadBtn.click()
    await testRunner.delay(400)

    preset.value = 'unicode'
    await testRunner.delay(200)
    loadBtn.click()
    await testRunner.delay(400)
  }
)
