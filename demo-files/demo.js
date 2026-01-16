// Import library and expose globally for tests
import * as Library from '../dist/index.js'
window.Library = Library

// ============================================
// SIMULATED DATA (since this is a demo without real library calls)
// ============================================

const PRESETS = {
  stream: {
    short: {
      prompt: "Explain how a car engine works in 2 sentences.",
      response: "A car engine works by igniting a mixture of fuel and air inside cylinders, which pushes pistons up and down to create rotational force. This force is transferred through the transmission to the wheels, propelling the vehicle forward."
    },
    code: {
      prompt: "Write a Python function to reverse a string",
      response: `def reverse_string(s):
    """Reverse a string using slicing."""
    return s[::-1]

# Example usage
text = "Hello, World!"
print(reverse_string(text))  # Output: !dlroW ,olleH`
    },
    long: {
      prompt: "List 5 interesting facts about octopuses",
      response: `Here are 5 fascinating facts about octopuses:

1. **Three Hearts**: Octopuses have three hearts - two pump blood to the gills, while the third pumps it to the rest of the body.

2. **Blue Blood**: Their blood is copper-based (hemocyanin) rather than iron-based, making it blue and more efficient at transporting oxygen in cold, low-oxygen environments.

3. **Master of Disguise**: They can change both color and texture in milliseconds, thanks to specialized cells called chromatophores, allowing them to blend perfectly with their surroundings.

4. **Distributed Intelligence**: About two-thirds of their neurons are located in their arms, meaning each arm can taste, touch, and even make decisions semi-independently.

5. **Short Lifespan**: Despite their intelligence, most octopuses live only 1-2 years. Females often die shortly after their eggs hatch, having stopped eating to guard them.`
    },
    emoji: {
      prompt: "Describe the seasons using only emojis",
      response: "🌸🌷🐣🌈☔ → ☀️🏖️🌊🍦🕶️ → 🍂🎃🍁🌰🦃 → ❄️⛄🎄🧣☕"
    }
  },
  conversation: {
    coding: {
      system: "You are a helpful coding assistant. Be concise.",
      messages: [
        { role: "user", content: "What's the difference between let and const in JavaScript?" },
        { role: "assistant", content: "let allows reassignment, const doesn't. Both are block-scoped, unlike var which is function-scoped." },
        { role: "user", content: "Show me an example" },
        { role: "assistant", content: "let x = 1; x = 2; // OK\nconst y = 1; y = 2; // Error" }
      ]
    },
    creative: {
      system: "You are a poet who writes in haiku format.",
      messages: [
        { role: "user", content: "Write a haiku about programming" },
        { role: "assistant", content: "Code flows like water\nBugs emerge from the shadows\nDebug, compile, run" }
      ]
    },
    long: {
      system: "You are a helpful assistant.",
      messages: [
        { role: "user", content: "What is TypeScript?" },
        { role: "assistant", content: "TypeScript is a strongly typed superset of JavaScript that compiles to plain JavaScript." },
        { role: "user", content: "Why should I use it?" },
        { role: "assistant", content: "It catches errors at compile time, provides better IDE support, and makes refactoring safer." },
        { role: "user", content: "How do I get started?" },
        { role: "assistant", content: "Install it with npm: npm install -g typescript. Then create a .ts file and compile with tsc." },
        { role: "user", content: "What about with React?" },
        { role: "assistant", content: "Use create-react-app with the TypeScript template: npx create-react-app my-app --template typescript" }
      ]
    },
    empty: {
      system: "You are a helpful assistant.",
      messages: []
    }
  },
  token: {
    pangram: "The quick brown fox jumps over the lazy dog. This classic pangram contains every letter of the English alphabet at least once, making it perfect for testing fonts and keyboards.",
    code: "function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }",
    long: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.`,
    minimal: "Hello",
    unicode: "Hello 世界! 🌍🚀 Привет мир! مرحبا بالعالم"
  }
};

const MODELS = [
  { id: 'anthropic/claude-sonnet-4', name: 'claude-sonnet-4', context: 200000, promptCost: 3, completionCost: 15 },
  { id: 'anthropic/claude-3-opus', name: 'claude-3-opus', context: 200000, promptCost: 15, completionCost: 75 },
  { id: 'openai/gpt-4o', name: 'gpt-4o', context: 128000, promptCost: 5, completionCost: 15 },
  { id: 'openai/gpt-4-turbo', name: 'gpt-4-turbo', context: 128000, promptCost: 10, completionCost: 30 },
  { id: 'meta-llama/llama-3.1-405b', name: 'llama-3.1-405b', context: 128000, promptCost: 3, completionCost: 3 }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function formatCost(tokens, costPerMillion) {
  return (tokens * costPerMillion / 1000000).toFixed(6);
}

// ============================================
// EXHIBIT 1: STREAM DECODER
// ============================================

const streamDecoder = {
  running: false,
  paused: false,
  speed: 100,
  currentPreset: 'short',

  init() {
    document.getElementById('stream-run').addEventListener('click', () => this.run());
    document.getElementById('stream-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('stream-replay').addEventListener('click', () => this.run());
    document.getElementById('stream-speed').addEventListener('input', (e) => {
      this.speed = parseInt(e.target.value);
      document.getElementById('stream-speed-value').textContent = `${this.speed}ms`;
    });
    document.getElementById('stream-preset').addEventListener('change', (e) => {
      this.currentPreset = e.target.value;
    });

    // REMOVED AUTO-PLAY - outputs start empty
  },

  togglePause() {
    this.paused = !this.paused;
    document.getElementById('stream-pause').textContent = this.paused ? '▶ Resume' : '⏸ Pause';
  },

  async run() {
    if (this.running) return;
    this.running = true;
    this.paused = false;

    const preset = PRESETS.stream[this.currentPreset];
    const response = preset.response;

    // Clear previous
    document.getElementById('sse-raw').innerHTML = '';
    document.getElementById('sse-chunks').innerHTML = '';
    document.getElementById('sse-output').innerHTML = '';
    document.getElementById('stream-chunk-count').textContent = '0';
    document.getElementById('stream-bytes').textContent = '0';
    document.getElementById('stream-status').textContent = 'Streaming';
    document.getElementById('stream-status').className = 'tag tag-yellow';

    // Split response into chunks (2-5 words)
    const words = response.split(/(\s+)/);
    const chunks = [];
    let current = '';
    let wordCount = 0;
    const chunkSize = 2 + Math.floor(Math.random() * 3);

    for (const word of words) {
      current += word;
      if (!word.match(/^\s+$/)) wordCount++;
      if (wordCount >= chunkSize) {
        chunks.push(current);
        current = '';
        wordCount = 0;
      }
    }
    if (current) chunks.push(current);

    let totalBytes = 0;
    let output = '';
    const startTime = Date.now();

    // Stream chunks
    for (let i = 0; i < chunks.length; i++) {
      while (this.paused) {
        await sleep(100);
      }

      const chunk = chunks[i];
      const sseData = {
        choices: [{ delta: { content: chunk } }]
      };
      const sseString = `data: ${JSON.stringify(sseData)}`;
      totalBytes += sseString.length;

      // Add to raw panel
      const rawEl = document.getElementById('sse-raw');
      const sseLine = document.createElement('div');
      sseLine.className = 'sse-line highlight';
      sseLine.innerHTML = `<span class="sse-key">data:</span> <span class="sse-value">${escapeHtml(JSON.stringify(sseData))}</span>`;
      rawEl.appendChild(sseLine);
      rawEl.scrollTop = rawEl.scrollHeight;
      setTimeout(() => sseLine.classList.remove('highlight'), 200);

      // Add to chunks panel
      const chunksEl = document.getElementById('sse-chunks');
      const chipEl = document.createElement('span');
      chipEl.className = 'chunk-chip';
      chipEl.textContent = `"${chunk}"`;
      chunksEl.appendChild(chipEl);

      // Add to output
      output += chunk;
      document.getElementById('sse-output').innerHTML = escapeHtml(output) + '<span class="cursor"></span>';

      // Update stats
      document.getElementById('stream-chunk-count').textContent = i + 1;
      document.getElementById('stream-bytes').textContent = totalBytes;
      document.getElementById('stream-time').textContent = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

      await sleep(this.speed);
    }

    // Add [DONE]
    const rawEl = document.getElementById('sse-raw');
    const doneLine = document.createElement('div');
    doneLine.className = 'sse-line';
    doneLine.innerHTML = '<span class="sse-key">data:</span> <span class="sse-value">[DONE]</span>';
    rawEl.appendChild(doneLine);

    // Final output without cursor
    document.getElementById('sse-output').innerHTML = escapeHtml(output);
    document.getElementById('stream-status').textContent = 'Done';
    document.getElementById('stream-status').className = 'tag tag-green';
    document.getElementById('stream-time').textContent = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

    this.running = false;
  }
};

// ============================================
// EXHIBIT 2: RESILIENCE LAB
// ============================================

const resilienceLab = {
  running: false,
  aborted: false,
  accelerated: true,
  currentScenario: 'success',

  scenarios: {
    success: [
      { type: 'request', time: 0 },
      { type: 'success', time: 150, status: 200 }
    ],
    'rate-limit': [
      { type: 'request', time: 0 },
      { type: 'error', time: 150, status: 429, retryAfter: 1000 },
      { type: 'wait', time: 150, duration: 1000 },
      { type: 'request', time: 1150, retry: 1 },
      { type: 'success', time: 1300, status: 200 }
    ],
    'server-error': [
      { type: 'request', time: 0 },
      { type: 'error', time: 150, status: 503 },
      { type: 'wait', time: 150, duration: 1000 },
      { type: 'request', time: 1150, retry: 1 },
      { type: 'error', time: 1300, status: 503 },
      { type: 'wait', time: 1300, duration: 2000 },
      { type: 'request', time: 3300, retry: 2 },
      { type: 'success', time: 3450, status: 200 }
    ],
    timeout: [
      { type: 'request', time: 0 },
      { type: 'error', time: 5000, status: 0, message: 'Network Timeout' },
      { type: 'wait', time: 5000, duration: 1000 },
      { type: 'request', time: 6000, retry: 1 },
      { type: 'success', time: 6150, status: 200 }
    ],
    auth: [
      { type: 'request', time: 0 },
      { type: 'error', time: 150, status: 401, message: 'Unauthorized', retriable: false }
    ],
    'max-retries': [
      { type: 'request', time: 0 },
      { type: 'error', time: 150, status: 503 },
      { type: 'wait', time: 150, duration: 1000 },
      { type: 'request', time: 1150, retry: 1 },
      { type: 'error', time: 1300, status: 503 },
      { type: 'wait', time: 1300, duration: 2000 },
      { type: 'request', time: 3300, retry: 2 },
      { type: 'error', time: 3450, status: 503 },
      { type: 'wait', time: 3450, duration: 4000 },
      { type: 'request', time: 7450, retry: 3 },
      { type: 'error', time: 7600, status: 503, final: true, message: 'Max retries exceeded' }
    ]
  },

  init() {
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentScenario = btn.dataset.scenario;
        this.run();
      });
    });

    document.getElementById('resilience-abort').addEventListener('click', () => {
      this.aborted = true;
    });

    document.getElementById('resilience-accelerated').addEventListener('change', (e) => {
      this.accelerated = e.target.checked;
    });

    // REMOVED AUTO-PLAY - timeline starts empty
  },

  async run() {
    if (this.running) return;
    this.running = true;
    this.aborted = false;

    const scenario = this.scenarios[this.currentScenario];
    const timeline = document.getElementById('resilience-timeline');
    const log = document.getElementById('resilience-log');
    const abortBtn = document.getElementById('resilience-abort');

    timeline.innerHTML = '';
    log.innerHTML = '';
    abortBtn.disabled = false;

    document.getElementById('resilience-attempt').textContent = '1';
    document.getElementById('resilience-countdown').textContent = '-';
    document.getElementById('resilience-elapsed').textContent = '0.00s';
    document.getElementById('resilience-retriable').textContent = '-';

    const speedMultiplier = this.accelerated ? 0.1 : 1;
    const startTime = Date.now();
    let currentAttempt = 1;

    // Create timeline nodes
    const nodes = scenario.filter(e => e.type === 'request' || e.type === 'success' || (e.type === 'error' && e.final));
    nodes.forEach((node, i) => {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'timeline-node';
      nodeEl.innerHTML = `
        <div class="timeline-dot pending" id="dot-${i}"></div>
        <div class="timeline-label" id="label-${i}">-</div>
        <div class="timeline-time" id="time-${i}">-</div>
      `;
      timeline.appendChild(nodeEl);
    });

    let nodeIndex = 0;

    for (const event of scenario) {
      if (this.aborted) {
        this.addLogEntry(log, 'error', 'Aborted by user', Date.now() - startTime);
        break;
      }

      const elapsed = (Date.now() - startTime) / 1000;
      document.getElementById('resilience-elapsed').textContent = elapsed.toFixed(2) + 's';

      if (event.type === 'request') {
        const dot = document.getElementById(`dot-${nodeIndex}`);
        const label = document.getElementById(`label-${nodeIndex}`);
        const time = document.getElementById(`time-${nodeIndex}`);

        dot.className = 'timeline-dot active';
        label.textContent = event.retry ? `Retry ${event.retry}` : 'Request';
        time.textContent = elapsed.toFixed(2) + 's';

        currentAttempt = (event.retry || 0) + 1;
        document.getElementById('resilience-attempt').textContent = currentAttempt;

        this.addLogEntry(log, 'pending', `POST /chat/completions${event.retry ? ` (retry ${event.retry}/3)` : ''}`, Date.now() - startTime);

        await sleep(150 * speedMultiplier);
      }
      else if (event.type === 'error') {
        const dot = document.getElementById(`dot-${nodeIndex}`);
        const label = document.getElementById(`label-${nodeIndex}`);

        if (event.final) {
          dot.className = 'timeline-dot error';
          label.textContent = 'Failed';
          nodeIndex++;
        }

        const retriable = event.retriable !== false && event.status >= 500 || event.status === 429;
        document.getElementById('resilience-retriable').textContent = retriable ? 'Yes' : 'No';

        const message = event.status === 429 ? `429 Too Many Requests (Retry-After: ${event.retryAfter}ms)` :
                       event.status === 503 ? '503 Service Unavailable' :
                       event.status === 401 ? '401 Unauthorized' :
                       event.status === 0 ? 'Network Timeout' :
                       event.message || `${event.status} Error`;

        this.addLogEntry(log, 'error', message, Date.now() - startTime);

        if (!event.final) nodeIndex++;
      }
      else if (event.type === 'wait') {
        const duration = event.duration * speedMultiplier;
        const jitter = Math.floor(Math.random() * 200);

        this.addLogEntry(log, 'waiting', `Waiting ${event.duration}ms + ${jitter}ms jitter...`, Date.now() - startTime);

        // Countdown
        const totalWait = duration + (jitter * speedMultiplier);
        const steps = 10;
        const stepTime = totalWait / steps;

        for (let i = steps; i > 0; i--) {
          if (this.aborted) break;
          document.getElementById('resilience-countdown').textContent = (i * stepTime / 1000).toFixed(1) + 's';
          await sleep(stepTime);
        }
        document.getElementById('resilience-countdown').textContent = '-';
      }
      else if (event.type === 'success') {
        const dot = document.getElementById(`dot-${nodeIndex}`);
        const label = document.getElementById(`label-${nodeIndex}`);
        const time = document.getElementById(`time-${nodeIndex}`);

        dot.className = 'timeline-dot success';
        label.textContent = '200 OK';
        time.textContent = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

        this.addLogEntry(log, 'success', '200 OK - Response received', Date.now() - startTime);
      }
    }

    abortBtn.disabled = true;
    this.running = false;
  },

  addLogEntry(log, type, message, elapsed) {
    const icons = { pending: '●', error: '✗', waiting: '◐', success: '✓' };
    const entry = document.createElement('div');
    entry.className = `event-log-entry ${type}`;
    entry.innerHTML = `
      <span class="icon">${icons[type]}</span>
      <span class="time">${(elapsed / 1000).toFixed(2)}s</span>
      <span class="message">${escapeHtml(message)}</span>
    `;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }
};

// ============================================
// EXHIBIT 3: CONVERSATION STATE MACHINE
// ============================================

const conversationMachine = {
  messages: [],
  systemPrompt: "You are a helpful coding assistant. Be concise.",
  selectedIndex: -1,

  init() {
    this.loadPreset('coding');

    document.getElementById('conv-send').addEventListener('click', () => this.send());
    document.getElementById('conv-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.send();
    });
    document.getElementById('conv-input').addEventListener('input', () => this.updateJson());
    document.getElementById('conv-clear').addEventListener('click', () => this.clear());
    document.getElementById('conv-clear-all').addEventListener('click', () => this.clearAll());
    document.getElementById('conv-load-preset').addEventListener('click', () => {
      const preset = document.getElementById('conv-preset').value;
      this.loadPreset(preset);
    });
  },

  loadPreset(name) {
    const preset = PRESETS.conversation[name];
    this.systemPrompt = preset.system;
    this.messages = [
      { role: 'system', content: preset.system },
      ...preset.messages
    ];
    this.render();
  },

  send() {
    const input = document.getElementById('conv-input');
    const content = input.value.trim();
    if (!content) return;

    // Add user message
    this.messages.push({ role: 'user', content });
    input.value = '';

    // Simulate response
    setTimeout(() => {
      const responses = [
        "That's a great question! Let me explain...",
        "Here's what I know about that:",
        "Interesting! The answer depends on context, but generally:",
        "Sure, I can help with that."
      ];
      const response = responses[Math.floor(Math.random() * responses.length)];
      this.messages.push({ role: 'assistant', content: response });
      this.render();
    }, 500);

    this.render();
  },

  clear() {
    this.messages = [{ role: 'system', content: this.systemPrompt }];
    this.render();
  },

  clearAll() {
    this.messages = [];
    this.systemPrompt = '';
    this.render();
  },

  render() {
    const container = document.getElementById('conv-messages');
    container.innerHTML = '';

    this.messages.forEach((msg, i) => {
      const el = document.createElement('div');
      el.className = `message ${msg.role}${i === this.selectedIndex ? ' selected' : ''}`;
      el.innerHTML = `
        <div class="message-role">${msg.role}</div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
      `;
      el.addEventListener('click', () => {
        this.selectedIndex = i;
        this.render();
      });
      container.appendChild(el);
    });

    this.updateJson();
    this.updateTokenCount();
  },

  updateJson() {
    const input = document.getElementById('conv-input').value;
    const inspector = document.getElementById('conv-json').querySelector('pre');

    let displayMessages = [...this.messages];
    if (input) {
      displayMessages.push({ role: 'user', content: input + '█' });
    }

    let json = JSON.stringify(displayMessages, null, 2);

    // Syntax highlight
    json = json
      .replace(/"(role|content)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/: "(system|user|assistant)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/: "([^"]+)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/[\[\]{}]/g, '<span class="json-bracket">$&</span>');

    inspector.innerHTML = json;
  },

  updateTokenCount() {
    const totalContent = this.messages.map(m => m.content).join('');
    const tokens = estimateTokens(totalContent) + (this.messages.length * 3); // overhead per message
    const maxTokens = 200000;

    document.getElementById('conv-token-count').textContent = `${tokens.toLocaleString()} / ${maxTokens.toLocaleString()}`;
    document.getElementById('conv-context-fill').style.width = `${Math.min(100, (tokens / maxTokens) * 100)}%`;
  }
};

// ============================================
// EXHIBIT 4: TOKEN VISUALIZER
// ============================================

const tokenVisualizer = {
  selectedModel: MODELS[0],

  init() {
    this.renderModelTable();
    this.updateTokens();

    document.getElementById('token-input').addEventListener('input', () => this.updateTokens());
    document.getElementById('token-load-preset').addEventListener('click', () => {
      const preset = document.getElementById('token-preset').value;
      document.getElementById('token-input').value = PRESETS.token[preset];
      this.updateTokens();
    });
    document.getElementById('token-reset').addEventListener('click', () => {
      document.getElementById('token-input').value = '';
      this.updateTokens();
    });
  },

  renderModelTable() {
    const tbody = document.getElementById('model-table').querySelector('tbody');
    tbody.innerHTML = '';

    MODELS.forEach((model, i) => {
      const tr = document.createElement('tr');
      tr.className = i === 0 ? 'selected' : '';
      tr.innerHTML = `
        <td>${model.name}</td>
        <td>${model.context.toLocaleString()}</td>
        <td>$${model.promptCost.toFixed(2)}</td>
        <td>$${model.completionCost.toFixed(2)}</td>
      `;
      tr.addEventListener('click', () => {
        this.selectedModel = model;
        document.querySelectorAll('#model-table tbody tr').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        this.updateTokens();
      });
      tbody.appendChild(tr);
    });
  },

  updateTokens() {
    const text = document.getElementById('token-input').value;
    const chars = text.length;
    const tokens = estimateTokens(text);

    document.getElementById('token-chars').textContent = chars.toLocaleString();
    document.getElementById('token-count').textContent = tokens.toLocaleString();

    const cost = formatCost(tokens, this.selectedModel.promptCost);
    document.getElementById('token-cost').textContent = `$${cost}`;

    // Render token blocks
    const blocksContainer = document.getElementById('token-blocks');
    blocksContainer.innerHTML = '';

    if (text.length === 0) {
      blocksContainer.innerHTML = '<span class="text-muted">Type text to see token blocks...</span>';
      return;
    }

    // Split into ~4 char chunks
    const chunkSize = 4;
    const maxBlocks = 50; // Limit for performance
    const chunks = [];

    for (let i = 0; i < text.length && chunks.length < maxBlocks; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    chunks.forEach((chunk, i) => {
      const block = document.createElement('span');
      block.className = 'token-block';
      block.innerHTML = `
        <span class="token-block-text">${escapeHtml(chunk)}</span>
        <span class="token-block-num">${i + 1}</span>
      `;
      blocksContainer.appendChild(block);
    });

    if (text.length > maxBlocks * chunkSize) {
      const more = document.createElement('span');
      more.className = 'text-muted';
      more.textContent = `... +${tokens - maxBlocks} more tokens`;
      blocksContainer.appendChild(more);
    }
  }
};

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Verify library is loaded (simulated check)
  if (typeof window.Library === 'undefined') {
    console.warn('Library not loaded. This is a simulated demo.');
  }

  streamDecoder.init();
  resilienceLab.init();
  conversationMachine.init();
  tokenVisualizer.init();
});
