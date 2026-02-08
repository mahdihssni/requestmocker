// Runs in extension isolated world. Keeps the MAIN-world interceptor updated with
// route changes and forwards monitoring events back to the background worker.

const CHANNEL = "REQUEST_MOCKER_V1";

let alive = true;

function isContextInvalidatedError(err) {
  const msg = String(err?.message || err || "");
  return msg.includes("Extension context invalidated") || msg.includes("context invalidated");
}

function stopForwarder() {
  if (!alive) return;
  alive = false;
  try {
    window.removeEventListener("message", onPageMessage);
  } catch {
    // ignore
  }
}

async function safeSendMessage(message) {
  if (!alive) return null;
  if (!chrome?.runtime?.id) {
    stopForwarder();
    return null;
  }
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (e) {
    // Happens when the extension is reloaded/updated while the page is open.
    // Don't spam console or crash the page; just stop forwarding.
    if (isContextInvalidatedError(e)) stopForwarder();
    return null;
  }
}

async function getState() {
  const res = await safeSendMessage({ type: "GET_STATE" });
  if (res?.ok) return res.state;
  return { enabled: true, routes: [] };
}

function postToPage(payload) {
  window.postMessage({ channel: CHANNEL, payload }, "*");
}

function onPageMessage(ev) {
  if (!alive) return;
  if (ev.source !== window) return;
  const data = ev.data;
  if (!data || data.channel !== CHANNEL) return;

  if (data.type === "ROUTE_HIT") {
    // Fire-and-forget; swallow context invalidation errors.
    safeSendMessage({
      type: "ROUTE_HIT",
      payload: data.payload
    });
  }
}

window.addEventListener("message", onPageMessage);

// Send initial state as soon as possible.
getState().then((state) => {
  if (!alive) return;
  postToPage({ type: "STATE", state: { enabled: Boolean(state.enabled), routes: state.routes || [] } });
});

// Stream updates.
chrome.storage.onChanged.addListener((changes, area) => {
  if (!alive) return;
  if (area !== "local") return;
  const changed = changes["request-mocker:state"];
  if (!changed) return;
  const next = changed.newValue || {};
  postToPage({ type: "STATE", state: { enabled: Boolean(next.enabled), routes: next.routes || [] } });
});

