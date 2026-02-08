// Runs in the page context (MAIN world). Intercepts fetch and XMLHttpRequest.
// Receives configuration from the extension via window.postMessage (from isolated contentScript.js).

(function () {
  const CHANNEL = "REQUEST_MOCKER_V1";

  /** @type {{ enabled: boolean, routes: any[] }} */
  let state = { enabled: true, routes: [] };

  function normalizeUrl(u) {
    if (typeof u !== "string") return "";
    return u.trim();
  }

  function resolveToAbsolute(u) {
    const s = normalizeUrl(u);
    if (!s) return "";
    try {
      // Handles relative URLs like "/api/test" or "api/test"
      return new URL(s, window.location.href).href;
    } catch {
      return s;
    }
  }

  function buildMatcher(route) {
    const match = normalizeUrl(route.match);
    const matchType = route.matchType || "includes";
    if (!match) return () => false;

    if (matchType === "exact") {
      return (url) => normalizeUrl(url) === match;
    }

    if (matchType === "regex") {
      try {
        const re = new RegExp(match);
        return (url) => re.test(String(url || ""));
      } catch {
        return () => false;
      }
    }

    // default includes
    return (url) => String(url || "").includes(match);
  }

  function routeAppliesToRequest(route, url, method) {
    if (!route || !route.enabled) return false;
    const m = (route.method || "ANY").toUpperCase();
    if (m !== "ANY" && m !== String(method || "GET").toUpperCase()) return false;
    const matchFn = route._matchFn || (route._matchFn = buildMatcher(route));
    return matchFn(url);
  }

  function findRoute(url, method) {
    if (!state.enabled) return null;
    const routes = Array.isArray(state.routes) ? state.routes : [];
    for (const r of routes) {
      if (routeAppliesToRequest(r, url, method)) return r;
    }
    return null;
  }

  function makeHeaders(route) {
    const headers = new Headers();
    const ct = route.contentType || "application/json; charset=utf-8";
    if (ct) headers.set("content-type", ct);

    if (route.headers && typeof route.headers === "object") {
      for (const [k, v] of Object.entries(route.headers)) {
        if (!k) continue;
        headers.set(String(k), String(v));
      }
    }
    return headers;
  }

  function toBodyString(route) {
    const body = route.body ?? "";
    if (typeof body === "string") return body;
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }

  function encodeUtf8(str) {
    try {
      return new TextEncoder().encode(String(str ?? ""));
    } catch {
      const s = String(str ?? "");
      const arr = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
      return arr;
    }
  }

  function computeXhrResponse(bodyStr, responseType, contentType) {
    const rt = String(responseType || "").toLowerCase();
    if (rt === "" || rt === "text") {
      return { responseText: String(bodyStr ?? ""), response: String(bodyStr ?? "") };
    }
    if (rt === "json") {
      const text = String(bodyStr ?? "");
      if (text.trim() === "") return { responseText: text, response: null };
      try {
        return { responseText: text, response: JSON.parse(text) };
      } catch {
        return { responseText: text, response: null };
      }
    }
    if (rt === "arraybuffer") {
      const u8 = encodeUtf8(bodyStr);
      return { responseText: "", response: u8.buffer };
    }
    if (rt === "blob") {
      const type = String(contentType || "application/octet-stream");
      return { responseText: "", response: new Blob([String(bodyStr ?? "")], { type }) };
    }
    return { responseText: String(bodyStr ?? ""), response: String(bodyStr ?? "") };
  }

  function notifyHit(routeId, url, ok, error) {
    window.postMessage(
      {
        channel: CHANNEL,
        type: "ROUTE_HIT",
        payload: { routeId, url, ok: Boolean(ok), error: error ? String(error) : null }
      },
      "*"
    );
  }

  // ---------------------------
  // fetch interception
  // ---------------------------
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;

  async function mockFetch(input, init) {
    const rawUrl = typeof input === "string" ? input : input?.url;
    const absUrl = resolveToAbsolute(rawUrl);
    const method = (init?.method || (typeof input !== "string" ? input?.method : null) || "GET").toUpperCase();
    const route = findRoute(absUrl || rawUrl, method);
    if (!route) return originalFetch(input, init);

    try {
      const status = Number(route.status || 200);
      const headers = makeHeaders(route);
      const bodyStr = toBodyString(route);
      notifyHit(route.id, String(absUrl || rawUrl || ""), true, null);
      return new Response(bodyStr, { status, headers });
    } catch (e) {
      notifyHit(route.id, String(absUrl || rawUrl || ""), false, e);
      throw e;
    }
  }

  if (originalFetch) {
    window.fetch = function (input, init) {
      return mockFetch(input, init);
    };
  }

  // ---------------------------
  // XMLHttpRequest interception
  // ---------------------------
  const OriginalXHR = window.XMLHttpRequest;

  function MockedXHR(route, url, method) {
    this._route = route;
    this._url = url;
    this._method = method;

    this.readyState = 0;
    this.status = 0;
    this.statusText = "";
    this.responseType = "";
    this.responseURL = url || "";
    this.responseText = "";
    this.response = "";

    this.onreadystatechange = null;
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    this.ontimeout = null;

    this._listeners = new Map();
    this._aborted = false;
    this._timeout = 0;
  }

  MockedXHR.prototype.addEventListener = function (type, cb) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(cb);
  };
  MockedXHR.prototype.removeEventListener = function (type, cb) {
    this._listeners.get(type)?.delete(cb);
  };
  MockedXHR.prototype._emit = function (type) {
    const evt = { type, target: this, currentTarget: this };
    const set = this._listeners.get(type);
    if (set) for (const cb of set) try { cb.call(this, evt); } catch {}
    const handler = this["on" + type];
    if (typeof handler === "function") try { handler.call(this, evt); } catch {}
  };

  MockedXHR.prototype.open = function () {};
  MockedXHR.prototype.setRequestHeader = function () {};

  MockedXHR.prototype.getResponseHeader = function (name) {
    const headers = makeHeaders(this._route);
    return headers.get(String(name || "").toLowerCase());
  };

  MockedXHR.prototype.getAllResponseHeaders = function () {
    const headers = makeHeaders(this._route);
    let out = "";
    headers.forEach((v, k) => {
      out += `${k}: ${v}\r\n`;
    });
    return out;
  };

  MockedXHR.prototype.abort = function () {
    this._aborted = true;
    this.readyState = 0;
    this._emit("abort");
    this._emit("loadend");
  };

  MockedXHR.prototype.send = function () {
    const route = this._route;
    const url = this._url;
    const delay = Number(route.delayMs || 0);
    const bodyStr = toBodyString(route);

    const finish = () => {
      if (this._aborted) return;
      try {
        const headers = makeHeaders(route);
        const contentType = headers.get("content-type") || route.contentType || "";
        const computed = computeXhrResponse(bodyStr, this.responseType, contentType);

        this.readyState = 4;
        this.status = Number(route.status || 200);
        this.statusText = String(route.statusText || "");
        this.responseText = computed.responseText;
        this.response = computed.response;
        notifyHit(route.id, String(url || ""), true, null);
        this._emit("readystatechange");
        this._emit("load");
        this._emit("loadend");
      } catch (e) {
        notifyHit(route.id, String(url || ""), false, e);
        this._emit("error");
        this._emit("loadend");
      }
    };

    this.readyState = 2;
    this._emit("readystatechange");
    this.readyState = 3;
    this._emit("readystatechange");

    if (delay > 0) setTimeout(finish, delay);
    else queueMicrotask(finish);
  };

  function XHRWrapper() {
    this._xhr = null;
    this._mock = null;
    this._opened = { method: "GET", url: "", async: true };
    this._stash = Object.create(null);
    this._listeners = new Map();

    this.onreadystatechange = null;
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    this.ontimeout = null;
  }

  XHRWrapper.prototype._target = function () {
    return this._mock || this._xhr;
  };

  XHRWrapper.prototype.open = function (method, url, async) {
    const absUrl = resolveToAbsolute(url);
    this._opened = { method: String(method || "GET"), url: absUrl || String(url || ""), async: async !== false };
    const route = findRoute(this._opened.url, this._opened.method);
    if (route) {
      this._mock = new MockedXHR(route, this._opened.url, this._opened.method);
      this._wireEvents(this._mock);
    } else {
      this._xhr = new OriginalXHR();
      this._wireEvents(this._xhr);
      this._xhr.open(method, url, async);
    }

    const t = this._target();
    if (t) {
      for (const [k, v] of Object.entries(this._stash)) {
        try {
          t[k] = v;
        } catch {}
      }
      for (const [type, set] of this._listeners.entries()) {
        for (const cb of set) {
          try {
            t.addEventListener?.(type, cb);
          } catch {}
        }
      }
    }
  };

  XHRWrapper.prototype.addEventListener = function (type, cb) {
    const t = this._target();
    if (t?.addEventListener) return t.addEventListener(type, cb);
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(cb);
  };

  XHRWrapper.prototype.removeEventListener = function (type, cb) {
    const t = this._target();
    if (t?.removeEventListener) return t.removeEventListener(type, cb);
    this._listeners.get(type)?.delete(cb);
  };

  XHRWrapper.prototype._wireEvents = function (t) {
    const forward = (type) => () => {
      try {
        if (type === "readystatechange" && typeof this.onreadystatechange === "function") this.onreadystatechange();
        if (type === "load" && typeof this.onload === "function") this.onload();
        if (type === "error" && typeof this.onerror === "function") this.onerror();
        if (type === "abort" && typeof this.onabort === "function") this.onabort();
        if (type === "timeout" && typeof this.ontimeout === "function") this.ontimeout();
      } catch {}
    };

    if (t && typeof t.addEventListener === "function") {
      t.addEventListener("readystatechange", forward("readystatechange"));
      t.addEventListener("load", forward("load"));
      t.addEventListener("error", forward("error"));
      t.addEventListener("abort", forward("abort"));
      t.addEventListener("timeout", forward("timeout"));
    }
  };

  XHRWrapper.prototype.send = function (body) {
    const t = this._target();
    if (!t) return;
    return t.send(body);
  };

  XHRWrapper.prototype.abort = function () {
    const t = this._target();
    if (!t) return;
    return t.abort();
  };

  XHRWrapper.prototype.setRequestHeader = function (k, v) {
    const t = this._target();
    if (!t) return;
    if (t.setRequestHeader) return t.setRequestHeader(k, v);
  };

  XHRWrapper.prototype.getResponseHeader = function (k) {
    const t = this._target();
    if (!t) return null;
    if (t.getResponseHeader) return t.getResponseHeader(k);
    return null;
  };

  XHRWrapper.prototype.getAllResponseHeaders = function () {
    const t = this._target();
    if (!t) return "";
    if (t.getAllResponseHeaders) return t.getAllResponseHeaders();
    return "";
  };

  [
    "readyState",
    "responseType",
    "responseURL",
    "status",
    "statusText",
    "response",
    "responseText",
    "timeout",
    "withCredentials"
  ].forEach((prop) => {
    Object.defineProperty(XHRWrapper.prototype, prop, {
      get() {
        const t = this._target();
        return t ? t[prop] : this._stash[prop];
      },
      set(v) {
        const t = this._target();
        this._stash[prop] = v;
        if (t) t[prop] = v;
      }
    });
  });

  window.XMLHttpRequest = XHRWrapper;

  // ---------------------------
  // Config updates
  // ---------------------------
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const msg = ev.data;
    if (!msg || msg.channel !== CHANNEL) return;
    const payload = msg.payload;
    if (!payload || payload.type !== "STATE") return;
    const next = payload.state || {};

    const routes = Array.isArray(next.routes) ? next.routes.map((r) => ({ ...r, _matchFn: null })) : [];
    state = { enabled: Boolean(next.enabled), routes };
  });
})();

