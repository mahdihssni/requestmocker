import { getState, setState, upsertRouteStats, pruneStatsForRoutes } from "./storage.js";

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  // Ensure defaults exist.
  const next = {
    enabled: state.enabled ?? true,
    routes: Array.isArray(state.routes) ? state.routes : [],
    stats: state.stats && typeof state.stats === "object" ? state.stats : {}
  };
  next.stats = pruneStatsForRoutes(next.stats, next.routes);
  await setState(next);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "ROUTE_HIT") {
      const payload = msg.payload || {};
      const { routeId, url, ok, error } = payload;
      const state = await getState();
      const nextStats = upsertRouteStats(state.stats || {}, routeId, { ...payload, url, ok, error });
      await setState({ ...state, stats: nextStats });
      return;
    }

    if (msg.type === "GET_STATE") {
      const state = await getState();
      sendResponse({ ok: true, state });
      return;
    }

    if (msg.type === "SET_STATE") {
      const { patch } = msg.payload || {};
      const state = await getState();
      const next = { ...state, ...(patch || {}) };
      next.routes = Array.isArray(next.routes) ? next.routes : [];
      next.enabled = Boolean(next.enabled);
      next.stats = pruneStatsForRoutes(next.stats || {}, next.routes);
      await setState(next);
      sendResponse({ ok: true, state: next });
      return;
    }

    if (msg.type === "CLEAR_STATS") {
      const state = await getState();
      await setState({ ...state, stats: {} });
      sendResponse({ ok: true });
      return;
    }
  })().catch((err) => {
    // Avoid crashing the SW; also return a response for request/response style messages.
    try {
      sendResponse({ ok: false, error: String(err?.message || err) });
    } catch {
      // ignore
    }
  });

  // Keep the message channel open for async sendResponse.
  return true;
});

