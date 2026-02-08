const KEY = "request-mocker:state";

export async function getState() {
  const res = await chrome.storage.local.get(KEY);
  return res?.[KEY] || { enabled: true, routes: [], stats: {} };
}

export async function setState(state) {
  await chrome.storage.local.set({ [KEY]: state });
}

export function pruneStatsForRoutes(stats, routes) {
  const allowed = new Set((routes || []).map((r) => r.id));
  const out = {};
  for (const [k, v] of Object.entries(stats || {})) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

export function upsertRouteStats(stats, routeId, hit) {
  if (!routeId) return stats;
  const now = Date.now();
  const cur = stats[routeId] || {
    hits: 0,
    lastHitAt: null,
    lastUrl: null,
    lastOk: null,
    lastError: null,
    events: []
  };
  const nextEvents = Array.isArray(cur.events) ? cur.events.slice(0) : [];
  nextEvents.unshift({
    at: now,
    url: hit?.url || null,
    ok: Boolean(hit?.ok),
    error: hit?.ok ? null : (hit?.error || "Unknown error")
  });
  if (nextEvents.length > 20) nextEvents.length = 20;
  const next = {
    ...cur,
    hits: (cur.hits || 0) + 1,
    lastHitAt: now,
    lastUrl: hit?.url || cur.lastUrl,
    lastOk: Boolean(hit?.ok),
    lastError: hit?.ok ? null : (hit?.error || "Unknown error"),
    events: nextEvents
  };
  return { ...stats, [routeId]: next };
}

