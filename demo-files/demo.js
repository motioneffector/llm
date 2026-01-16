// Import library and expose globally for tests
import * as Library from '../dist/index.js'
window.Library = Library

const { createLLMClient, estimateTokens, getModelInfo } = Library

// ============================================
// API KEY MANAGEMENT
// ============================================

let apiKey = localStorage.getItem('openrouter-api-key') || ''
let currentClient = null

function getApiKey() {
  return apiKey
}

function setApiKey(key) {
  apiKey = key.trim()
  if (apiKey) {
    localStorage.setItem('openrouter-api-key', apiKey)
  } else {
    localStorage.removeItem('openrouter-api-key')
  }
  currentClient = null
  updateApiKeyUI()
}

function getClient(model = 'anthropic/claude-sonnet-4') {
  if (!apiKey) return null
  if (!currentClient || currentClient.model !== model) {
    currentClient = createLLMClient({ apiKey, model })
  }
  return currentClient
}

function updateApiKeyUI() {
  const indicator = document.getElementById('api-key-indicator')
  const input = document.getElementById('api-key-input')

  if (indicator) {
    indicator.textContent = apiKey ? '🔑 API Key Set' : '⚠️ No API Key'
    indicator.className = apiKey ? 'api-key-status active' : 'api-key-status'
  }
  if (input) {
    input.value = apiKey ? '••••••••' + apiKey.slice(-4) : ''
  }
}

// ============================================
// MODEL DATABASE (for display)
// ============================================

const MODELS = [
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3-opus',
  'openai/gpt-4o',
  'openai/gpt-4-turbo',
  'meta-llama/llama-3.1-405b'
]

// ============================================
// EXHIBIT 1: STREAM DECODER
// ============================================

const streamDecoder = {
  state: {
    running: false,
    paused: false,
    chunks: [],
    output: '',
    startTime: 0
  },

  init() {
    document.getElementById('stream-run')?.addEventListener('click', () => this.run())
    document.getElementById('stream-pause')?.addEventListener('click', () => this.togglePause())
    document.getElementById('stream-replay')?.addEventListener('click', () => this.replay())
    document.getElementById('stream-speed')?.addEventListener('input', (e) => {
      document.getElementById('stream-speed-value').textContent = e.target.value + 'ms'
    })
  },

  async run() {
    if (this.state.running) return
    this.reset()
    this.state.running = true
    this.state.startTime = Date.now()
    this.updateStatus('Streaming')

    const client = getClient()
    if (!client) {
      // Simulated streaming for demo without API key
      await this.runSimulated()
      return
    }

    // Real streaming with API
    try {
      const preset = document.getElementById('stream-preset').value
      const prompts = {
        short: 'Explain how a car engine works in 2 sentences.',
        code: 'Write a Python function to reverse a string',
        long: 'List 5 interesting facts about octopuses',
        emoji: 'Describe the seasons using only emojis and short phrases'
      }

      const response = await client.chat(
        [{ role: 'user', content: prompts[preset] }],
        {
          stream: true,
          onChunk: (chunk) => this.handleChunk(chunk)
        }
      )

      this.updateStatus('Complete')
    } catch (error) {
      this.updateStatus('Error: ' + error.message)
    }

    this.state.running = false
  },

  async runSimulated() {
    // Simulate SSE chunks for demonstration when no API key
    const preset = document.getElementById('stream-preset').value
    const responses = {
      short: "A car engine works by igniting a mixture of fuel and air inside cylinders, which pushes pistons up and down to create rotational force. This force is transferred through the transmission to the wheels, propelling the vehicle forward.",
      code: `def reverse_string(s):
    """Reverse a string using slicing."""
    return s[::-1]

# Example usage
text = "Hello, World!"
print(reverse_string(text))  # Output: !dlroW ,olleH`,
      long: `Here are 5 fascinating facts about octopuses:

1. **Three Hearts**: Octopuses have three hearts - two pump blood to the gills, while the third pumps it to the rest of the body.

2. **Blue Blood**: Their blood is copper-based (hemocyanin) rather than iron-based, making it blue.

3. **Master of Disguise**: They can change both color and texture in milliseconds.

4. **Problem Solvers**: Octopuses can open jars, navigate mazes, and use tools.

5. **Short Lives**: Despite their intelligence, most octopuses only live 1-2 years.`,
      emoji: `🌸 Spring: 🌷🐣🌈 - New beginnings, flowers blooming, rain showers

☀️ Summer: 🏖️🍦🌻 - Beach days, ice cream, long sunny days

🍂 Fall: 🎃🍁☕ - Colorful leaves, cozy sweaters, harvest time

❄️ Winter: ⛄🎄🔥 - Snow, holidays, warm fires`
    }

    const text = responses[preset]
    const delay = parseInt(document.getElementById('stream-speed').value)

    // Simulate SSE chunks
    const words = text.split(/(\s+)/)
    for (let i = 0; i < words.length && this.state.running; i++) {
      while (this.state.paused) {
        await new Promise(r => setTimeout(r, 100))
      }

      const chunk = words[i]
      const sseEvent = `data: {"choices":[{"delta":{"content":"${chunk.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"}}]}\n\n`

      this.showRawSSE(sseEvent)
      this.showParsedChunk(chunk)
      this.appendOutput(chunk)

      this.state.chunks.push(chunk)
      this.updateStats()

      await new Promise(r => setTimeout(r, delay))
    }

    this.updateStatus('Complete (Simulated)')
    this.state.running = false
  },

  handleChunk(chunk) {
    const sseEvent = `data: {"choices":[{"delta":{"content":"${chunk.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"}}]}\n\n`
    this.showRawSSE(sseEvent)
    this.showParsedChunk(chunk)
    this.appendOutput(chunk)
    this.state.chunks.push(chunk)
    this.updateStats()
  },

  showRawSSE(event) {
    const el = document.getElementById('sse-raw')
    const div = document.createElement('div')
    div.className = 'sse-event'
    div.textContent = event.trim()
    el.appendChild(div)
    el.scrollTop = el.scrollHeight
  },

  showParsedChunk(chunk) {
    const el = document.getElementById('sse-chunks')
    const span = document.createElement('span')
    span.className = 'chunk-block'
    span.textContent = chunk.replace(/\n/g, '↵')
    el.appendChild(span)
  },

  appendOutput(chunk) {
    this.state.output += chunk
    document.getElementById('sse-output').textContent = this.state.output
  },

  updateStats() {
    document.getElementById('stream-chunk-count').textContent = this.state.chunks.length
    document.getElementById('stream-bytes').textContent = this.state.output.length
    const elapsed = ((Date.now() - this.state.startTime) / 1000).toFixed(2)
    document.getElementById('stream-time').textContent = elapsed + 's'
  },

  updateStatus(status) {
    const el = document.getElementById('stream-status')
    el.textContent = status
    el.className = 'tag' + (status.includes('Error') ? ' error' : status === 'Streaming' ? ' active' : '')
  },

  togglePause() {
    this.state.paused = !this.state.paused
    document.getElementById('stream-pause').textContent = this.state.paused ? '▶ Resume' : '⏸ Pause'
  },

  reset() {
    this.state = { running: false, paused: false, chunks: [], output: '', startTime: 0 }
    document.getElementById('sse-raw').innerHTML = ''
    document.getElementById('sse-chunks').innerHTML = ''
    document.getElementById('sse-output').textContent = ''
    document.getElementById('stream-chunk-count').textContent = '0'
    document.getElementById('stream-bytes').textContent = '0'
    document.getElementById('stream-time').textContent = '0.00s'
    this.updateStatus('Ready')
  },

  replay() {
    this.reset()
    this.run()
  }
}

// ============================================
// EXHIBIT 2: RESILIENCE LAB
// ============================================

const resilienceLab = {
  state: {
    running: false,
    aborted: false,
    attempt: 0,
    startTime: 0
  },

  scenarios: {
    success: { errors: [], description: 'Clean request with no errors' },
    'rate-limit': { errors: [429, 429, 0], description: 'Rate limited twice, then success' },
    'server-error': { errors: [503, 503, 0], description: 'Server errors with recovery' },
    timeout: { errors: ['timeout', 'timeout', 0], description: 'Network timeouts with retry' },
    auth: { errors: [401], description: 'Authentication failure (non-retriable)' },
    'max-retries': { errors: [503, 503, 503, 503], description: 'Exhausts all retries' }
  },

  init() {
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'))
        e.target.classList.add('active')
        this.runScenario(e.target.dataset.scenario)
      })
    })
    document.getElementById('resilience-abort')?.addEventListener('click', () => this.abort())
  },

  async runScenario(scenarioName) {
    if (this.state.running) return
    this.reset()
    this.state.running = true

    const scenario = this.scenarios[scenarioName]
    const accelerated = document.getElementById('resilience-accelerated')?.checked
    const baseDelay = accelerated ? 100 : 1000

    this.log('info', `Starting scenario: ${scenario.description}`)
    this.state.startTime = Date.now()

    document.getElementById('resilience-abort').disabled = false

    for (let i = 0; i < scenario.errors.length + 1 && !this.state.aborted; i++) {
      this.state.attempt = i + 1
      document.getElementById('resilience-attempt').textContent = this.state.attempt

      const error = scenario.errors[i]

      if (error === undefined || error === 0) {
        // Success
        this.addTimelineEvent('success', 'Request succeeded')
        this.log('success', 'Request completed successfully')
        document.getElementById('resilience-retriable').textContent = '-'
        break
      }

      // Error occurred
      const errorType = error === 'timeout' ? 'Network Timeout' : `HTTP ${error}`
      const retriable = error === 429 || error === 503 || error === 'timeout'

      this.addTimelineEvent('error', errorType)
      this.log('error', `${errorType} - ${retriable ? 'Retriable' : 'Non-retriable'}`)
      document.getElementById('resilience-retriable').textContent = retriable ? 'Yes' : 'No'

      if (!retriable) {
        this.log('error', 'Non-retriable error. Stopping.')
        break
      }

      if (i < scenario.errors.length - 1 || scenario.errors[i + 1] === 0) {
        // Calculate backoff with jitter
        const backoff = Math.min(baseDelay * Math.pow(2, i), baseDelay * 8)
        const jitter = Math.random() * backoff * 0.5
        const delay = backoff + jitter

        this.addTimelineEvent('wait', `Waiting ${(delay / 1000).toFixed(1)}s`)
        this.log('info', `Exponential backoff: waiting ${(delay / 1000).toFixed(2)}s (attempt ${i + 1})`)

        // Countdown
        const endTime = Date.now() + delay
        while (Date.now() < endTime && !this.state.aborted) {
          const remaining = ((endTime - Date.now()) / 1000).toFixed(1)
          document.getElementById('resilience-countdown').textContent = remaining + 's'
          document.getElementById('resilience-elapsed').textContent =
            ((Date.now() - this.state.startTime) / 1000).toFixed(2) + 's'
          await new Promise(r => setTimeout(r, 50))
        }
        document.getElementById('resilience-countdown').textContent = '-'
      }
    }

    document.getElementById('resilience-abort').disabled = true
    this.state.running = false
    document.getElementById('resilience-elapsed').textContent =
      ((Date.now() - this.state.startTime) / 1000).toFixed(2) + 's'
  },

  addTimelineEvent(type, label) {
    const timeline = document.getElementById('resilience-timeline')
    const event = document.createElement('div')
    event.className = `timeline-event ${type}`
    event.innerHTML = `<span class="event-dot"></span><span class="event-label">${label}</span>`
    timeline.appendChild(event)
  },

  log(type, message) {
    const log = document.getElementById('resilience-log')
    const entry = document.createElement('div')
    entry.className = `log-entry ${type}`
    const time = ((Date.now() - (this.state.startTime || Date.now())) / 1000).toFixed(2)
    entry.innerHTML = `<span class="log-time">[${time}s]</span> ${message}`
    log.appendChild(entry)
    log.scrollTop = log.scrollHeight
  },

  abort() {
    this.state.aborted = true
    this.log('warn', 'Aborted by user')
  },

  reset() {
    this.state = { running: false, aborted: false, attempt: 0, startTime: 0 }
    document.getElementById('resilience-timeline').innerHTML = ''
    document.getElementById('resilience-log').innerHTML = ''
    document.getElementById('resilience-attempt').textContent = '-'
    document.getElementById('resilience-countdown').textContent = '-'
    document.getElementById('resilience-elapsed').textContent = '0.00s'
    document.getElementById('resilience-retriable').textContent = '-'
  }
}

// ============================================
// EXHIBIT 3: CONVERSATION STATE MACHINE
// ============================================

const conversationMachine = {
  messages: [],

  presets: {
    coding: [
      { role: 'system', content: 'You are a helpful coding assistant.' },
      { role: 'user', content: 'How do I reverse a string in Python?' },
      { role: 'assistant', content: 'You can reverse a string using slicing: `s[::-1]`' }
    ],
    creative: [
      { role: 'system', content: 'You are a creative writing assistant with a poetic style.' },
      { role: 'user', content: 'Describe a sunset' }
    ],
    long: [
      { role: 'system', content: 'You are an AI assistant.' },
      ...Array(10).fill(null).map((_, i) => [
        { role: 'user', content: `Question ${i + 1}: What is ${i + 1} + ${i + 1}?` },
        { role: 'assistant', content: `The answer is ${(i + 1) * 2}.` }
      ]).flat()
    ],
    empty: []
  },

  init() {
    document.getElementById('conv-send')?.addEventListener('click', () => this.sendMessage())
    document.getElementById('conv-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage()
    })
    document.getElementById('conv-load-preset')?.addEventListener('click', () => this.loadPreset())
    document.getElementById('conv-clear')?.addEventListener('click', () => this.clearLast())
    document.getElementById('conv-clear-all')?.addEventListener('click', () => this.clearAll())

    this.loadPreset()
  },

  loadPreset() {
    const preset = document.getElementById('conv-preset').value
    this.messages = [...this.presets[preset]]
    this.render()
  },

  async sendMessage() {
    const input = document.getElementById('conv-input')
    const content = input.value.trim()
    if (!content) return

    this.messages.push({ role: 'user', content })
    input.value = ''
    this.render()

    // Try to get real response if API key is set
    const client = getClient()
    if (client) {
      try {
        const response = await client.chat(this.messages)
        this.messages.push({ role: 'assistant', content: response.content })
        this.render()
      } catch (error) {
        this.messages.push({ role: 'assistant', content: `[Error: ${error.message}]` })
        this.render()
      }
    } else {
      // Simulated response when no API key
      this.messages.push({
        role: 'assistant',
        content: '[Set an OpenRouter API key to get real responses]'
      })
      this.render()
    }
  },

  clearLast() {
    if (this.messages.length > 0) {
      this.messages.pop()
      this.render()
    }
  },

  clearAll() {
    this.messages = []
    this.render()
  },

  render() {
    // Render messages
    const container = document.getElementById('conv-messages')
    container.innerHTML = this.messages.map(m => `
      <div class="message ${m.role}">
        <div class="message-role">${m.role}</div>
        <div class="message-content">${this.escapeHtml(m.content)}</div>
      </div>
    `).join('')
    container.scrollTop = container.scrollHeight

    // Render JSON state
    const json = document.getElementById('conv-json').querySelector('pre')
    json.textContent = JSON.stringify(this.messages, null, 2)

    // Update token count using real estimateTokens
    const totalText = this.messages.map(m => m.content).join(' ')
    const tokens = estimateTokens(totalText)
    const maxTokens = 200000

    document.getElementById('conv-token-count').textContent = `${tokens.toLocaleString()} / ${maxTokens.toLocaleString()}`
    document.getElementById('conv-context-fill').style.width = `${Math.min(100, (tokens / maxTokens) * 100)}%`
  },

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

// ============================================
// EXHIBIT 4: TOKEN VISUALIZER
// ============================================

const tokenVisualizer = {
  presets: {
    pangram: 'The quick brown fox jumps over the lazy dog. This classic pangram contains every letter of the English alphabet at least once, making it perfect for testing fonts and keyboards.',
    code: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`,
    long: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    minimal: 'Hi',
    unicode: '你好世界！🌍 Здравствуй мир! مرحبا بالعالم 🎉'
  },

  init() {
    const input = document.getElementById('token-input')
    input?.addEventListener('input', () => this.visualize())

    document.getElementById('token-load-preset')?.addEventListener('click', () => this.loadPreset())
    document.getElementById('token-reset')?.addEventListener('click', () => {
      document.getElementById('token-input').value = this.presets.pangram
      this.visualize()
    })

    this.renderModelTable()
    this.visualize()
  },

  loadPreset() {
    const preset = document.getElementById('token-preset').value
    document.getElementById('token-input').value = this.presets[preset]
    this.visualize()
  },

  visualize() {
    const text = document.getElementById('token-input').value
    const tokens = estimateTokens(text)

    // Update stats
    document.getElementById('token-chars').textContent = text.length.toLocaleString()
    document.getElementById('token-count').textContent = tokens.toLocaleString()

    // Calculate cost using Claude Sonnet pricing
    const info = getModelInfo('anthropic/claude-sonnet-4')
    const cost = info ? (tokens / 1000000) * info.pricing.prompt : 0
    document.getElementById('token-cost').textContent = '$' + cost.toFixed(6)

    // Visualize token blocks (approximation: ~4 chars per token)
    const blocksContainer = document.getElementById('token-blocks')
    blocksContainer.innerHTML = ''

    // Split into ~4 character chunks
    const chunks = []
    for (let i = 0; i < text.length; i += 4) {
      chunks.push(text.slice(i, i + 4))
    }

    chunks.forEach((chunk, i) => {
      const span = document.createElement('span')
      span.className = 'token-block'
      span.style.backgroundColor = `hsl(${(i * 37) % 360}, 70%, 85%)`
      span.textContent = chunk.replace(/\n/g, '↵').replace(/ /g, '·')
      span.title = `Token ${i + 1}: "${chunk}"`
      blocksContainer.appendChild(span)
    })
  },

  renderModelTable() {
    const tbody = document.getElementById('model-table').querySelector('tbody')
    tbody.innerHTML = MODELS.map(modelId => {
      const info = getModelInfo(modelId)
      if (!info) return ''
      return `
        <tr>
          <td>${modelId}</td>
          <td>${(info.contextLength / 1000).toFixed(0)}k</td>
          <td>$${info.pricing.prompt.toFixed(2)}</td>
          <td>$${info.pricing.completion.toFixed(2)}</td>
        </tr>
      `
    }).join('')
  }
}

// ============================================
// API KEY UI SETUP
// ============================================

function setupApiKeyUI() {
  // Create API key input in header if not exists
  const header = document.querySelector('.header-links')
  if (header && !document.getElementById('api-key-section')) {
    const section = document.createElement('div')
    section.id = 'api-key-section'
    section.className = 'api-key-section'
    section.innerHTML = `
      <span id="api-key-indicator" class="api-key-status">⚠️ No API Key</span>
      <input type="password" id="api-key-input" class="api-key-input" placeholder="OpenRouter API Key">
      <button id="api-key-set" class="btn btn-small btn-secondary">Set Key</button>
    `
    header.parentNode.insertBefore(section, header)

    document.getElementById('api-key-set')?.addEventListener('click', () => {
      const input = document.getElementById('api-key-input')
      if (input.value && !input.value.startsWith('••••')) {
        setApiKey(input.value)
      }
    })

    document.getElementById('api-key-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const input = e.target
        if (input.value && !input.value.startsWith('••••')) {
          setApiKey(input.value)
        }
      }
    })
  }

  updateApiKeyUI()
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupApiKeyUI()
  streamDecoder.init()
  resilienceLab.init()
  conversationMachine.init()
  tokenVisualizer.init()
})

// Export for tests
window.streamDecoder = streamDecoder
window.resilienceLab = resilienceLab
window.conversationMachine = conversationMachine
window.tokenVisualizer = tokenVisualizer
