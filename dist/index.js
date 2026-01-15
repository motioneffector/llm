class R extends Error {
  constructor(e) {
    super(e), this.name = "LLMError", Object.setPrototypeOf(this, new.target.prototype);
  }
}
class T extends R {
  constructor(e, r) {
    super(e), this.field = r, this.name = "ValidationError";
  }
}
class v extends R {
  constructor(e, r, i) {
    super(e), this.status = r, this.retryAfter = i, this.name = "RateLimitError";
  }
}
class K extends R {
  constructor(e, r) {
    super(e), this.status = r, this.name = "AuthError";
  }
}
class U extends R {
  constructor(e, r) {
    super(e), this.status = r, this.name = "ModelError";
  }
}
class P extends R {
  constructor(e, r) {
    super(e), this.status = r, this.name = "ServerError";
  }
}
class L extends R {
  constructor(e, r) {
    super(e), this.cause = r, this.name = "NetworkError";
  }
}
class M extends R {
  constructor(e, r) {
    super(e), this.cause = r, this.name = "ParseError";
  }
}
class V extends R {
  constructor(e) {
    super(e), this.name = "ConcurrencyError";
  }
}
function G(t) {
  return t === 429 || t >= 500;
}
function S(t, e) {
  if (e !== void 0) {
    const n = e * 1e3;
    if (!Number.isFinite(n) || n < 0) {
      const l = 1e3 * Math.pow(2, t), m = Math.random() * 200;
      return Math.min(l + m, 3e4);
    }
    return Math.min(n, 3e4);
  }
  const i = 1e3 * Math.pow(2, t), s = Math.random() * 200;
  return Math.min(i + s, 3e4);
}
async function _(t, e) {
  return new Promise((r, i) => {
    if (e != null && e.aborted) {
      i(new DOMException("The operation was aborted", "AbortError"));
      return;
    }
    const s = setTimeout(() => {
      e && e.removeEventListener("abort", n), r();
    }, t), n = () => {
      clearTimeout(s), i(new DOMException("The operation was aborted", "AbortError"));
    };
    e && e.addEventListener("abort", n, { once: !0 });
  });
}
async function z(t) {
  var i, s;
  let e = `HTTP ${t.status}`;
  try {
    const n = await t.json();
    (i = n == null ? void 0 : n.error) != null && i.message && (e = n.error.message);
  } catch {
    try {
      const n = await t.text();
      n && (e = n);
    } catch {
    }
  }
  const r = t.status;
  if (r === 429) {
    let n;
    try {
      const l = (s = t.headers) == null ? void 0 : s.get("Retry-After");
      n = l ? parseInt(l, 10) : void 0;
    } catch {
      n = void 0;
    }
    throw new v(e, r, n);
  }
  throw r === 401 || r === 403 ? new K(e, r) : r === 404 ? new U(e, r) : new P(e, r);
}
async function N(t, e, r) {
  var f;
  const { maxRetries: i, shouldRetry: s, signal: n } = r;
  if (n != null && n.aborted)
    throw new DOMException("The operation was aborted", "AbortError");
  let l;
  const m = s ? i + 1 : 1;
  for (let w = 0; w < m; w++)
    try {
      const c = {
        method: e.method,
        headers: e.headers,
        ...e.body && { body: e.body },
        ...n && { signal: n }
      }, d = await fetch(t, c);
      if (!d)
        throw new Error("fetch returned undefined");
      if (!d.ok) {
        const y = d.status;
        if (s && G(y) && w < m - 1) {
          let p;
          if (y === 429)
            try {
              const a = (f = d.headers) == null ? void 0 : f.get("Retry-After");
              p = a ? parseInt(a, 10) : void 0;
            } catch {
              p = void 0;
            }
          const u = S(w, p);
          await _(u, n);
          continue;
        }
        await z(d);
      }
      return d;
    } catch (c) {
      if (c instanceof DOMException && c.name === "AbortError")
        throw c;
      if (c instanceof v || c instanceof K || c instanceof U || c instanceof P) {
        const d = c instanceof v || c instanceof P && c.status >= 500;
        if (s && d && w < m - 1) {
          const y = c instanceof v ? c.retryAfter : void 0, p = S(w, y);
          await _(p, n), l = c;
          continue;
        }
        throw c;
      }
      if (w < m - 1 && s) {
        l = c;
        const d = S(w);
        await _(d, n);
        continue;
      }
      throw new L(`Network request failed: ${c.message}`, c);
    }
  throw l || new L("Request failed after retries");
}
function Q(t) {
  if (!t || typeof t != "object")
    throw new M("Response is not a valid object");
  const e = t;
  if (!e.choices || !Array.isArray(e.choices) || e.choices.length === 0)
    throw new M("Response missing choices array");
  const r = e.choices[0];
  if (!r || typeof r != "object")
    throw new M("Invalid choice object in response");
  if (!r.message || typeof r.message != "object")
    throw new M("Response missing message object");
  const i = r.message;
  if (i.content === void 0 && i.content !== null && i.content !== "")
    throw new M("Response missing content field");
  return t;
}
async function* Z(t, e) {
  var n, l, m;
  if (!t.body)
    throw new L("Response body is null");
  const r = t.body.getReader(), i = new TextDecoder();
  let s = "";
  try {
    for (; ; ) {
      if (e != null && e.aborted)
        throw r.cancel(), new DOMException("The operation was aborted", "AbortError");
      const { done: f, value: w } = await r.read();
      if (f)
        break;
      s += i.decode(w, { stream: !0 });
      const c = s.split(`
`);
      s = c.pop() ?? "";
      for (const d of c) {
        const y = d.trim();
        if (!(!y || y.startsWith(":")) && y.startsWith("data: ")) {
          const p = y.slice(6);
          if (p === "[DONE]")
            return;
          try {
            const a = (m = (l = (n = JSON.parse(p).choices) == null ? void 0 : n[0]) == null ? void 0 : l.delta) == null ? void 0 : m.content;
            a && a.length > 0 && (yield a);
          } catch (u) {
            throw new M(
              `Failed to parse SSE chunk: ${u.message}`,
              u
            );
          }
        }
      }
    }
  } catch (f) {
    throw f instanceof DOMException && f.name === "AbortError" || f instanceof M ? f : new L(`Stream reading failed: ${f.message}`, f);
  } finally {
    r.releaseLock();
  }
}
function O(t, e, r) {
  let i = r == null ? void 0 : r.system;
  const s = [...(r == null ? void 0 : r.initialMessages) ?? []];
  let n = !1;
  function l() {
    if (n)
      throw new V("Cannot perform operation while a request is in progress");
  }
  function m() {
    const u = [];
    return i && u.push({ role: "system", content: i }), u.push(...s), u;
  }
  function f() {
    const u = [];
    return i && u.push({ role: "system", content: i }), u.push(...s), u;
  }
  async function w(u, a) {
    l(), n = !0;
    try {
      s.push({ role: "user", content: u });
      const o = m(), h = await t(o, a);
      return s.push({ role: "assistant", content: h.content }), h.content;
    } finally {
      n = !1;
    }
  }
  function c(u, a) {
    l(), n = !0, s.push({ role: "user", content: u });
    const o = m(), h = e(o, a);
    let E = "", A = !1, b;
    return {
      async *[Symbol.asyncIterator]() {
        try {
          for await (const g of h)
            E += g, yield g;
          A = !0;
        } catch (g) {
          throw b = g, g;
        } finally {
          n = !1, A && !b ? s.push({ role: "assistant", content: E }) : b && s.pop();
        }
      }
    };
  }
  function d(u, a) {
    if (l(), u === "system")
      throw new T(
        "Cannot add system messages manually, use constructor for system prompt",
        "role"
      );
    if (u !== "user" && u !== "assistant")
      throw new T(`Invalid role: ${u}. Must be 'user' or 'assistant'.`, "role");
    if (typeof a != "string")
      throw new TypeError("Message content must be a string");
    s.push({ role: u, content: a });
  }
  function y() {
    l(), s.length = 0;
  }
  function p() {
    l(), s.length = 0, i = void 0;
  }
  return {
    send: w,
    sendStream: c,
    get history() {
      return [...f()];
    },
    addMessage: d,
    clear: y,
    clearAll: p
  };
}
function ee(t) {
  return t.length === 0 ? 0 : Math.ceil(t.length / 4);
}
const Y = {
  "anthropic/claude-sonnet-4": {
    contextLength: 2e5,
    pricing: {
      prompt: 3,
      completion: 15
    }
  },
  "anthropic/claude-3-opus": {
    contextLength: 2e5,
    pricing: {
      prompt: 15,
      completion: 75
    }
  },
  "openai/gpt-4o": {
    contextLength: 128e3,
    pricing: {
      prompt: 5,
      completion: 15
    }
  },
  "openai/gpt-4-turbo": {
    contextLength: 128e3,
    pricing: {
      prompt: 10,
      completion: 30
    }
  },
  "meta-llama/llama-3.1-405b": {
    contextLength: 128e3,
    pricing: {
      prompt: 3,
      completion: 3
    }
  }
};
function te(t) {
  if (!(t === "__proto__" || t === "constructor" || t === "prototype") && Object.hasOwn(Y, t))
    return Y[t];
}
const re = "https://openrouter.ai/api/v1", oe = 3;
function ne(t) {
  if (!t.apiKey || t.apiKey.trim() === "")
    throw new T("apiKey is required and cannot be empty", "apiKey");
  if (!t.model || t.model.trim() === "")
    throw new T("model is required and cannot be empty", "model");
}
function $(t) {
  if (!Array.isArray(t) || t.length === 0)
    throw new T("messages array cannot be empty", "messages");
  for (const e of t) {
    if (!e.role || !["system", "user", "assistant"].includes(e.role))
      throw new T(
        `Invalid message role: ${e.role}. Must be 'system', 'user', or 'assistant'.`,
        "role"
      );
    if (typeof e.content != "string")
      throw new TypeError("Message content must be a string");
  }
}
function H(t) {
  if (t && t.temperature !== void 0 && (typeof t.temperature != "number" || t.temperature < 0 || t.temperature > 2))
    throw new T("temperature must be between 0 and 2", "temperature");
}
function q(t, e) {
  const r = { ...t };
  return e && (e.temperature !== void 0 && (r.temperature = e.temperature), e.maxTokens !== void 0 && (r.maxTokens = e.maxTokens), e.topP !== void 0 && (r.topP = e.topP), e.stop !== void 0 && (r.stop = e.stop)), r;
}
function F(t, e, r, i) {
  const s = {
    model: e,
    messages: t,
    stream: i
  };
  return r.temperature !== void 0 && (s.temperature = r.temperature), r.maxTokens !== void 0 && (s.max_tokens = r.maxTokens), r.topP !== void 0 && (s.top_p = r.topP), r.stop !== void 0 && (s.stop = r.stop), JSON.stringify(s);
}
function se(t) {
  return t.includes("openrouter");
}
function ie(t) {
  ne(t);
  const e = t.baseUrl ?? re, r = t.apiKey;
  let i = t.model;
  const s = t.defaultParams, n = t.referer ?? "https://github.com/motioneffector/llm", l = t.title ?? "LLM Client";
  function m() {
    const a = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${r}`
    };
    return se(e) && (a["HTTP-Referer"] = n, a["X-Title"] = l), a;
  }
  function f() {
    return `${e.endsWith("/") ? e.slice(0, -1) : e}/chat/completions`;
  }
  async function w(a, o) {
    var j;
    if ($(a), H(o), (j = o == null ? void 0 : o.signal) != null && j.aborted)
      throw new DOMException("The operation was aborted", "AbortError");
    const h = Date.now(), E = (o == null ? void 0 : o.model) ?? i, A = q(s, o), b = F(a, E, A, !1), g = (o == null ? void 0 : o.maxRetries) ?? oe, k = (o == null ? void 0 : o.retry) !== !1, X = await N(
      f(),
      {
        method: "POST",
        headers: m(),
        body: b,
        signal: o == null ? void 0 : o.signal
      },
      {
        maxRetries: g,
        shouldRetry: k,
        signal: o == null ? void 0 : o.signal
      }
    ), I = Date.now() - h;
    let C;
    try {
      C = await X.json();
    } catch (J) {
      throw new M("Failed to parse JSON response", J);
    }
    const x = Q(C), D = x.choices[0];
    if (!D)
      throw new M("No choices in response");
    const W = D.message.content ?? "", B = x.usage ? {
      promptTokens: x.usage.prompt_tokens,
      completionTokens: x.usage.completion_tokens,
      totalTokens: x.usage.total_tokens
    } : {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
    return {
      content: W,
      usage: B,
      model: x.model,
      id: x.id,
      finishReason: D.finish_reason ?? null,
      latency: I
    };
  }
  function c(a, o) {
    var g;
    if ($(a), H(o), (g = o == null ? void 0 : o.signal) != null && g.aborted)
      throw new DOMException("The operation was aborted", "AbortError");
    const h = (o == null ? void 0 : o.model) ?? i, E = q(s, o), A = F(a, h, E, !0);
    let b = !1;
    return {
      async *[Symbol.asyncIterator]() {
        if (b)
          return;
        b = !0;
        const k = await N(
          f(),
          {
            method: "POST",
            headers: m(),
            body: A,
            signal: o == null ? void 0 : o.signal
          },
          {
            maxRetries: 0,
            shouldRetry: !1,
            signal: o == null ? void 0 : o.signal
          }
        );
        yield* Z(k, o == null ? void 0 : o.signal);
      }
    };
  }
  function d() {
    return i;
  }
  function y(a) {
    if (!a || a.trim() === "")
      throw new T("model cannot be empty", "model");
    i = a;
  }
  function p(a) {
    return O(w, c, a);
  }
  function u(a) {
    let h = 0;
    for (const g of a)
      h += ee(g.content), h += 3;
    const E = te(i), A = (E == null ? void 0 : E.contextLength) ?? 128e3, b = Math.max(0, A - h);
    return { prompt: h, available: b };
  }
  return {
    chat: w,
    stream: c,
    createConversation: p,
    getModel: d,
    setModel: y,
    estimateChat: u
  };
}
export {
  K as AuthError,
  V as ConcurrencyError,
  R as LLMError,
  U as ModelError,
  L as NetworkError,
  M as ParseError,
  v as RateLimitError,
  P as ServerError,
  T as ValidationError,
  ie as createLLMClient,
  ee as estimateTokens,
  te as getModelInfo
};
