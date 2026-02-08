function bytesOf(str) {
  try {
    return new Blob([String(str || "")]).size;
  } catch {
    return String(str || "").length;
  }
}

function isJsonContentType(ct) {
  return String(ct || "").toLowerCase().includes("json");
}

function methodOverlaps(a, b) {
  const A = String(a || "ANY").toUpperCase();
  const B = String(b || "ANY").toUpperCase();
  if (A === "ANY" || B === "ANY") return true;
  return A === B;
}

function mightOverlap(a, b) {
  // Heuristic; keep it simple and conservative.
  if (!methodOverlaps(a.method, b.method)) return false;
  if (!a.enabled || !b.enabled) return false;

  const am = String(a.match || "").trim();
  const bm = String(b.match || "").trim();
  if (!am || !bm) return false;

  const at = a.matchType || "includes";
  const bt = b.matchType || "includes";

  if (at === "exact" && bt === "exact") return am === bm;
  if (at === "includes" && bt === "includes") return am === bm || am.includes(bm) || bm.includes(am);
  if (at === "exact" && bt === "includes") return am.includes(bm);
  if (at === "includes" && bt === "exact") return bm.includes(am);

  // regex overlap is not reliably checkable; only flag exact duplicates
  if (at === "regex" && bt === "regex") return am === bm;

  return false;
}

export function validateRouteDraft(draft, { allRoutes = [], existingId = null } = {}) {
  /** @type {{ errors: string[], warnings: string[] }} */
  const out = { errors: [], warnings: [] };

  const match = String(draft.match || "").trim();
  if (!match) out.errors.push("Route match is required.");
  if (match && match.length < 4) out.warnings.push("Match is very short; it may accidentally mock unrelated requests.");

  const status = Number(draft.status);
  if (!Number.isFinite(status) || status < 100 || status > 599) out.errors.push("Status must be a number between 100 and 599.");

  const matchType = draft.matchType || "includes";
  if (matchType === "regex") {
    try {
      // eslint-disable-next-line no-new
      new RegExp(match);
    } catch (e) {
      out.errors.push(`Regex is invalid: ${String(e?.message || e)}`);
    }
  }

  const contentType = String(draft.contentType || "");
  const bodyStr = typeof draft.body === "string" ? draft.body : JSON.stringify(draft.body ?? "");

  if (isJsonContentType(contentType)) {
    if (String(bodyStr || "").trim() !== "") {
      try {
        JSON.parse(bodyStr);
      } catch (e) {
        out.errors.push(`Body is not valid JSON for Content-Type "${contentType}". (${String(e?.message || e)})`);
      }
    }
  }

  const size = bytesOf(bodyStr);
  if (size > 250_000) out.warnings.push(`Body is large (${Math.round(size / 1024)} KB). This may hit storage limits or slow pages.`);

  if (draft.headers && typeof draft.headers === "object") {
    // ok
  } else if (draft.headers != null) {
    out.errors.push("Extra headers must be an object.");
  }

  // Conflicts/overlaps
  const peers = (Array.isArray(allRoutes) ? allRoutes : []).filter((r) => r && r.id !== existingId);
  const overlaps = peers.filter((r) => mightOverlap(draft, r));
  if (overlaps.length) {
    const exactDup = overlaps.find(
      (r) =>
        String(r.matchType || "includes") === String(draft.matchType || "includes") &&
        String(r.match || "").trim() === String(draft.match || "").trim() &&
        methodOverlaps(r.method, draft.method)
    );
    if (exactDup) out.errors.push("This route duplicates another enabled route (same match + method overlap).");
    else out.warnings.push("This route may overlap another enabled route. Remember: first match wins.");
  }

  return out;
}

