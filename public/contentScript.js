// Runs in extension isolated world. Keeps the MAIN-world interceptor updated with
// route changes and forwards monitoring events back to the background worker.

const CHANNEL = "REQUEST_MOCKER_V1";

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

