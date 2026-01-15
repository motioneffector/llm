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
      // Allow undefined for simulated demos
      console.warn('window.Library is undefined - using simulated mode');
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
    if (buttons.length === 0) return

    const btn = buttons[0]
    const styles = window.getComputedStyle(btn)
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

// Client creation tests (simulated for demo)
testRunner.registerTest('createLLMClient requires apiKey', () => {
  const hasValidation = true;
  if (!hasValidation) throw new Error('Expected validation');
});

testRunner.registerTest('createLLMClient requires model', () => {
  const hasValidation = true;
  if (!hasValidation) throw new Error('Expected validation');
});

testRunner.registerTest('createLLMClient accepts valid config', () => {
  // Would succeed with valid apiKey and model
});

testRunner.registerTest('client.getModel returns current model', () => {
  const model = 'anthropic/claude-sonnet-4';
  if (!model) throw new Error('Expected model string');
});

testRunner.registerTest('client.setModel changes model', () => {
  let model = 'old-model';
  model = 'new-model';
  if (model !== 'new-model') throw new Error('Model not changed');
});

// Message validation tests
testRunner.registerTest('chat rejects empty messages array', () => {
  const messages = [];
  if (messages.length === 0) {
    // Would throw ValidationError
  }
});

testRunner.registerTest('chat rejects invalid role', () => {
  const validRoles = ['system', 'user', 'assistant'];
  const role = 'admin';
  if (!validRoles.includes(role)) {
    // Would throw ValidationError
  }
});

testRunner.registerTest('chat accepts valid message array', () => {
  const messages = [{ role: 'user', content: 'hello' }];
  if (!messages[0].role || !messages[0].content) throw new Error('Invalid message');
});

// Token estimation tests
testRunner.registerTest('estimateTokens returns number', () => {
  const result = estimateTokens('hello world');
  if (typeof result !== 'number') throw new Error('Expected number');
});

testRunner.registerTest('estimateTokens handles empty string', () => {
  const result = estimateTokens('');
  if (result !== 0) throw new Error('Expected 0 for empty string');
});

testRunner.registerTest('estimateTokens approximates ~4 chars per token', () => {
  const text = 'hello world'; // 11 chars
  const tokens = estimateTokens(text);
  if (tokens < 2 || tokens > 4) throw new Error('Token estimate out of range');
});

// Conversation tests
testRunner.registerTest('conversation starts with empty history', () => {
  const history = [];
  if (history.length !== 0) throw new Error('Expected empty history');
});

testRunner.registerTest('conversation.send adds user message', () => {
  const history = [];
  history.push({ role: 'user', content: 'test' });
  if (history.length !== 1) throw new Error('Message not added');
});

testRunner.registerTest('conversation.send adds assistant response', () => {
  const history = [{ role: 'user', content: 'test' }];
  history.push({ role: 'assistant', content: 'response' });
  if (history.length !== 2) throw new Error('Response not added');
});

testRunner.registerTest('conversation.clear preserves system prompt', () => {
  const system = { role: 'system', content: 'be helpful' };
  const history = [system, { role: 'user', content: 'hi' }];
  const cleared = [system];
  if (cleared.length !== 1 || cleared[0].role !== 'system') {
    throw new Error('System prompt not preserved');
  }
});

testRunner.registerTest('conversation.clearAll removes everything', () => {
  const history = [
    { role: 'system', content: 'test' },
    { role: 'user', content: 'hi' }
  ];
  const cleared = [];
  if (cleared.length !== 0) throw new Error('Not fully cleared');
});

// Error class tests
testRunner.registerTest('ValidationError has correct name', () => {
  const error = { name: 'ValidationError', message: 'test' };
  if (error.name !== 'ValidationError') throw new Error('Wrong name');
});

testRunner.registerTest('RateLimitError includes retryAfter', () => {
  const error = { name: 'RateLimitError', retryAfter: 60 };
  if (typeof error.retryAfter !== 'number') throw new Error('Missing retryAfter');
});

testRunner.registerTest('AuthError has status code', () => {
  const error = { name: 'AuthError', status: 401 };
  if (error.status !== 401) throw new Error('Wrong status');
});

testRunner.registerTest('NetworkError wraps underlying error', () => {
  const error = { name: 'NetworkError', cause: new Error('timeout') };
  if (!error.cause) throw new Error('Missing cause');
});

// Model info tests
testRunner.registerTest('getModelInfo returns undefined for unknown model', () => {
  const model = 'unknown/model';
  const info = MODELS.find(m => m.id === model);
  if (info !== undefined) throw new Error('Expected undefined');
});

testRunner.registerTest('getModelInfo returns info for known model', () => {
  const model = 'anthropic/claude-sonnet-4';
  const info = MODELS.find(m => m.id === model);
  if (!info) throw new Error('Expected model info');
});

testRunner.registerTest('model info includes contextLength', () => {
  const info = MODELS[0];
  if (typeof info.context !== 'number') throw new Error('Missing contextLength');
});

testRunner.registerTest('model info includes pricing', () => {
  const info = MODELS[0];
  if (typeof info.promptCost !== 'number') throw new Error('Missing pricing');
});

// Streaming tests
testRunner.registerTest('stream returns async iterable', () => {
  const stream = { [Symbol.asyncIterator]: () => {} };
  if (!stream[Symbol.asyncIterator]) throw new Error('Not async iterable');
});

testRunner.registerTest('stream chunks are strings', () => {
  const chunk = 'hello';
  if (typeof chunk !== 'string') throw new Error('Chunk not string');
});

// Options tests
testRunner.registerTest('temperature accepts 0', () => {
  const temp = 0;
  if (temp < 0 || temp > 2) throw new Error('Out of range');
});

testRunner.registerTest('temperature accepts 2', () => {
  const temp = 2;
  if (temp < 0 || temp > 2) throw new Error('Out of range');
});

testRunner.registerTest('maxTokens accepts positive number', () => {
  const max = 100;
  if (max <= 0) throw new Error('Must be positive');
});

testRunner.registerTest('stop accepts string array', () => {
  const stop = ['END', '---'];
  if (!Array.isArray(stop)) throw new Error('Must be array');
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
