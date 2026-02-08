const KEY = "request-mocker:state";

export async function getState() {
  const res = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (res?.ok) return res.state;
  // Fallback (should be rare)
  const local = await chrome.storage.local.get(KEY);
  return local?.[KEY] || { enabled: true, routes: [], stats: {} };
}

export async function setStatePatch(patch) {
  const res = await chrome.runtime.sendMessage({ type: "SET_STATE", payload: { patch } });
  if (!res?.ok) throw new Error(res?.error || "Failed to update state");
  return res.state;
}

export async function clearStats() {
  const res = await chrome.runtime.sendMessage({ type: "CLEAR_STATS" });
  if (!res?.ok) throw new Error(res?.error || "Failed to clear stats");
  return true;
}

export function subscribeState(callback) {
  const handler = (changes, area) => {
    if (area !== "local") return;
    const changed = changes[KEY];
    if (!changed) return;
    callback(changed.newValue || { enabled: true, routes: [], stats: {} });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export async function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    await chrome.runtime.openOptionsPage();
    return;
  }
  // Fallback for older Chromium
  const url = chrome.runtime.getURL("options.html");
  chrome.tabs.create({ url });
}

