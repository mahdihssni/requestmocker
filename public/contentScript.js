// Runs in extension isolated world. Keeps the MAIN-world interceptor updated with
// route changes and forwards monitoring events back to the background worker.

const CHANNEL = "REQUEST_MOCKER_V1";

function safeSendMessage(message) {
  return new Promise((resolve) => {
    try {
      // When the extension reloads/updates, existing content scripts may keep running briefly.
      // Accessing chrome.runtime or sending messages can throw "Extension context invalidated".
      if (!chrome?.runtime?.id) return resolve(null);
      chrome.runtime.sendMessage(message, (response) => {
        // If runtime is invalidated mid-flight, lastError will be set.
        if (chrome.runtime?.lastError) return resolve(null);
        resolve(response ?? null);
      });
    } catch {
      resolve(null);
    }
  });
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
  if (ev.source !== window) return;
  const data = ev.data;
  if (!data || data.channel !== CHANNEL) return;

  if (data.type === "ROUTE_HIT") {
    // Fire-and-forget; never throw on extension reload.
    void safeSendMessage({
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

