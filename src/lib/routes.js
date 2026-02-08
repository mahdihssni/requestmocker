export const MATCH_TYPES = /** @type {const} */ (["includes", "exact", "regex"]);
export const METHODS = /** @type {const} */ (["ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

export function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return "r_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
}

export function defaultRoute() {
  return {
    id: newId(),
    enabled: true,
    match: "",
    matchType: "includes",
    method: "ANY",
    status: 200,
    statusText: "",
    contentType: "application/json; charset=utf-8",
    body: "{\n  \"ok\": true\n}\n",
    headers: {},
    delayMs: 0
  };
}

export function cloneRoute(route) {
  return JSON.parse(JSON.stringify(route || {}));
}

