// Runs in extension isolated world. Injects the actual interceptor into the page
// context and keeps it updated with route changes.

const CHANNEL = "REQUEST_MOCKER_V1";

function injectScript() {
  try {
    const el = document.createElement("script");
    el.src = chrome.runtime.getURL("injected.js");
    el.async = false;
    (document.documentElement || document.head || document.body).appendChild(el);
    el.remove();
  } catch {
    // If injection fails, we simply don't mock on this page.
  }
}

async function getState() {
  const res = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (res?.ok) return res.state;
  return { enabled: true, routes: [] };
}

function postToPage(payload) {
  window.postMessage({ channel: CHANNEL, payload }, "*");
}

function onPageMessage(ev) {
  if (ev.source !== window) return;
  const data = ev.data;
  if (!data || data.channel !== CHANNEL) return;

  if (data.type === "ROUTE_HIT") {
    chrome.runtime.sendMessage({
      type: "ROUTE_HIT",
      payload: data.payload
    });
  }
}

injectScript();

window.addEventListener("message", onPageMessage);

// Send initial state as soon as possible.
getState().then((state) => {
  postToPage({ type: "STATE", state: { enabled: Boolean(state.enabled), routes: state.routes || [] } });
});

// Stream updates.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const changed = changes["request-mocker:state"];
  if (!changed) return;
  const next = changed.newValue || {};
  postToPage({ type: "STATE", state: { enabled: Boolean(next.enabled), routes: next.routes || [] } });
});

