<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import Button from "../components/ui/Button.vue";
import Input from "../components/ui/Input.vue";
import Textarea from "../components/ui/Textarea.vue";
import Card from "../components/ui/Card.vue";
import Badge from "../components/ui/Badge.vue";
import Switch from "../components/ui/Switch.vue";
import { clearStats, getState, setStatePatch, subscribeState } from "../lib/extensionState";
import { defaultRoute, cloneRoute, METHODS, MATCH_TYPES, newId } from "../lib/routes";
import { validateRouteDraft } from "../lib/validateRoute";
import { formatWhen, fromNow } from "../lib/time";

const state = ref({ enabled: true, routes: [], stats: {} });
const loading = ref(true);
let unsub = null;

const selectedId = ref(null);
const filter = ref("");

const draft = reactive(defaultRoute());
const headersJson = ref("{}");
const validation = ref({ errors: [], warnings: [] });
const banner = ref(null);

function findRouteById(id) {
  return (state.value.routes || []).find((r) => r?.id === id) || null;
}

function routeLabel(r) {
  const m = String(r?.match || "").trim();
  return m || "(untitled)";
}

const filteredRoutes = computed(() => {
  const q = String(filter.value || "").trim().toLowerCase();
  const routes = Array.isArray(state.value.routes) ? state.value.routes : [];
  if (!q) return routes;
  return routes.filter((r) => {
    const hay = `${r?.match || ""} ${r?.method || ""} ${r?.matchType || ""} ${r?.status || ""}`.toLowerCase();
    return hay.includes(q);
  });
});

const selectedRoute = computed(() => (selectedId.value ? findRouteById(selectedId.value) : null));

const statsRows = computed(() => {
  const stats = state.value.stats || {};
  const routes = state.value.routes || [];
  return routes.map((r) => {
    const s = stats[r.id] || null;
    return {
      route: r,
      hits: s?.hits || 0,
      lastHitAt: s?.lastHitAt || null,
      lastUrl: s?.lastUrl || null,
      lastOk: s?.lastOk,
      lastError: s?.lastError || null,
      events: s?.events || []
    };
  });
});

function refreshValidation() {
  validation.value = validateRouteDraft(
    { ...draft },
    { allRoutes: state.value.routes || [], existingId: draft.id }
  );
}

function loadDraftFromRoute(route) {
  const r = route ? cloneRoute(route) : defaultRoute();
  Object.assign(draft, r);
  headersJson.value = JSON.stringify(draft.headers || {}, null, 2);
  refreshValidation();
}

function newDraft() {
  selectedId.value = null;
  loadDraftFromRoute(defaultRoute());
}

async function saveDraft() {
  banner.value = null;

  let headersObj = {};
  const rawHeaders = String(headersJson.value || "").trim();
  if (rawHeaders) {
    try {
      const parsed = JSON.parse(rawHeaders);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Must be a JSON object");
      headersObj = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [String(k), typeof v === "string" ? v : JSON.stringify(v)])
      );
    } catch (e) {
      banner.value = { type: "error", text: `Headers JSON is invalid: ${String(e?.message || e)}` };
      return;
    }
  }
  draft.headers = headersObj;

  refreshValidation();
  if (validation.value.errors.length) {
    banner.value = { type: "error", text: "Fix validation errors before saving." };
    return;
  }

  const routes = Array.isArray(state.value.routes) ? state.value.routes.slice() : [];
  const idx = routes.findIndex((r) => r.id === draft.id);
  const normalized = {
    ...cloneRoute(draft),
    match: String(draft.match || "").trim(),
    status: Number(draft.status || 200),
    delayMs: Number(draft.delayMs || 0),
    enabled: Boolean(draft.enabled),
    method: String(draft.method || "ANY").toUpperCase(),
    matchType: String(draft.matchType || "includes")
  };

  if (idx >= 0) routes[idx] = normalized;
  else routes.unshift(normalized);

  const next = await setStatePatch({ routes });
  state.value = next;
  selectedId.value = normalized.id;
  banner.value = { type: "success", text: "Saved." };
}

async function deleteSelected() {
  if (!selectedRoute.value) return;
  const routes = (state.value.routes || []).filter((r) => r.id !== selectedRoute.value.id);
  const next = await setStatePatch({ routes });
  state.value = next;
  newDraft();
}

async function duplicateSelected() {
  const r = selectedRoute.value;
  if (!r) return;
  const copy = cloneRoute(r);
  copy.id = newId();
  copy.match = `${copy.match}`; // keep same
  const routes = Array.isArray(state.value.routes) ? state.value.routes.slice() : [];
  routes.unshift(copy);
  const next = await setStatePatch({ routes });
  state.value = next;
  selectedId.value = copy.id;
  loadDraftFromRoute(copy);
  banner.value = { type: "success", text: "Duplicated." };
}

async function moveSelected(delta) {
  const r = selectedRoute.value;
  if (!r) return;
  const routes = Array.isArray(state.value.routes) ? state.value.routes.slice() : [];
  const idx = routes.findIndex((x) => x.id === r.id);
  if (idx < 0) return;
  const j = idx + delta;
  if (j < 0 || j >= routes.length) return;
  const [item] = routes.splice(idx, 1);
  routes.splice(j, 0, item);
  const next = await setStatePatch({ routes });
  state.value = next;
}

async function toggleGlobal(v) {
  await setStatePatch({ enabled: Boolean(v) });
}

async function toggleRoute(id, v) {
  const routes = Array.isArray(state.value.routes) ? state.value.routes.slice() : [];
  const idx = routes.findIndex((r) => r.id === id);
  if (idx < 0) return;
  routes[idx] = { ...routes[idx], enabled: Boolean(v) };
  const next = await setStatePatch({ routes });
  state.value = next;
}

async function exportRoutes() {
  const payload = JSON.stringify({ enabled: state.value.enabled, routes: state.value.routes || [] }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "request-mocker-routes.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importRoutesFromFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    banner.value = { type: "error", text: `Import failed: invalid JSON (${String(e?.message || e)})` };
    return;
  }
  const routes = Array.isArray(parsed?.routes) ? parsed.routes : Array.isArray(parsed) ? parsed : null;
  if (!routes) {
    banner.value = { type: "error", text: "Import failed: expected { routes: [...] } or an array of routes." };
    return;
  }
  // Ensure ids
  const normalized = routes.map((r) => ({
    ...cloneRoute(r),
    id: r?.id || newId(),
    enabled: r?.enabled !== false,
    method: String(r?.method || "ANY").toUpperCase(),
    matchType: String(r?.matchType || "includes")
  }));
  const next = await setStatePatch({ routes: normalized });
  state.value = next;
  banner.value = { type: "success", text: "Imported routes." };
  selectedId.value = normalized[0]?.id || null;
  loadDraftFromRoute(normalized[0] || null);
}

function pickImport() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) importRoutesFromFile(file);
  };
  input.click();
}

async function doClearStats() {
  await clearStats();
  banner.value = { type: "success", text: "Cleared stats." };
}

watch(
  () => [draft.match, draft.matchType, draft.method, draft.status, draft.contentType, draft.body, draft.enabled],
  refreshValidation,
  { deep: false }
);

onMounted(async () => {
  state.value = await getState();
  loading.value = false;
  unsub = subscribeState((s) => {
    state.value = s;
    // If selected route changed elsewhere, keep editor in sync.
    if (selectedId.value) {
      const r = findRouteById(selectedId.value);
      if (r) loadDraftFromRoute(r);
    }
  });

  // Load first route or new draft
  const first = (state.value.routes || [])[0] || null;
  if (first) {
    selectedId.value = first.id;
    loadDraftFromRoute(first);
  } else {
    newDraft();
  }
});

onUnmounted(() => {
  try {
    unsub?.();
  } catch {
    // ignore
  }
});
</script>

<template>
  <div class="mx-auto max-w-6xl p-6">
    <div class="flex flex-col gap-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="text-2xl font-extrabold tracking-tight">Request Mocker</div>
          <div class="mt-1 text-sm text-slate-400">
            Add routes and return mock responses (JSON, text, XML, etc.). First match wins.
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <span class="text-xs font-semibold text-slate-400">Enabled</span>
            <Switch :model-value="Boolean(state.enabled)" @update:model-value="toggleGlobal" />
          </div>
          <Button variant="outline" @click="pickImport" title="Import routes from JSON">Import</Button>
          <Button variant="outline" @click="exportRoutes" title="Export all routes as JSON">Export</Button>
          <Button variant="secondary" @click="newDraft" title="Create a new route">+ New route</Button>
        </div>
      </div>

      <div
        v-if="banner"
        class="rounded-2xl border px-4 py-3 text-sm"
        :class="banner.type === 'error' ? 'border-rose-500/40 bg-rose-500/10 text-rose-100' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'"
      >
        {{ banner.text }}
      </div>

      <div class="grid grid-cols-12 gap-5">
        <!-- LEFT: ROUTES -->
        <Card class="col-span-12 md:col-span-5">
          <div class="flex items-center justify-between border-b border-slate-800/70 px-4 py-3">
            <div class="text-sm font-extrabold">Routes</div>
            <Badge variant="outline">{{ (state.routes || []).length }} total</Badge>
          </div>
          <div class="p-4">
            <Input v-model="filter" placeholder="Search match/method/status…" />
            <div class="mt-3 max-h-[520px] overflow-auto pr-1">
              <div v-if="loading" class="text-sm text-slate-400">Loading…</div>
              <div v-else-if="filteredRoutes.length === 0" class="text-sm text-slate-400">No routes.</div>

              <button
                v-for="r in filteredRoutes"
                :key="r.id"
                class="mt-2 w-full rounded-2xl border p-3 text-left transition"
                :class="selectedId === r.id ? 'border-violet-500/50 bg-violet-500/10' : 'border-slate-800/70 bg-slate-950/20 hover:bg-slate-950/35'"
                @click="
                  selectedId = r.id;
                  loadDraftFromRoute(r);
                "
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate font-mono text-xs text-slate-200" :title="routeLabel(r)">{{ routeLabel(r) }}</div>
                    <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <Badge variant="outline">{{ String(r.method || "ANY").toUpperCase() }}</Badge>
                      <Badge variant="outline">{{ r.matchType || "includes" }}</Badge>
                      <Badge :variant="r.enabled ? 'success' : 'warning'">{{ r.enabled ? "enabled" : "disabled" }}</Badge>
                      <Badge variant="outline">status {{ r.status || 200 }}</Badge>
                    </div>
                  </div>
                  <div class="shrink-0 pt-1">
                    <Switch :model-value="Boolean(r.enabled)" @update:model-value="(v) => toggleRoute(r.id, v)" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </Card>

        <!-- RIGHT: EDITOR -->
        <Card class="col-span-12 md:col-span-7">
          <div class="flex items-center justify-between border-b border-slate-800/70 px-4 py-3">
            <div class="text-sm font-extrabold">Route editor</div>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" :disabled="!selectedRoute" title="Move up (higher priority)" @click="moveSelected(-1)">Up</Button>
              <Button variant="outline" size="sm" :disabled="!selectedRoute" title="Move down (lower priority)" @click="moveSelected(1)">Down</Button>
              <Button variant="outline" size="sm" :disabled="!selectedRoute" title="Duplicate this route" @click="duplicateSelected">Duplicate</Button>
              <Button variant="destructive" size="sm" :disabled="!selectedRoute" title="Delete this route" @click="deleteSelected">Delete</Button>
            </div>
          </div>

          <div class="grid gap-4 p-4">
            <div class="grid grid-cols-12 gap-3">
              <div class="col-span-12">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  Route match
                  <span class="text-[11px] text-slate-500" title="Includes is recommended: api.com/test">ⓘ</span>
                </div>
                <Input v-model="draft.match" placeholder="api.com/test" />
              </div>

              <div class="col-span-12 md:col-span-4">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  Match type <span class="text-[11px] text-slate-500" title="Includes / Exact / Regex">ⓘ</span>
                </div>
                <select
                  v-model="draft.matchType"
                  class="h-10 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 text-sm text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30"
                >
                  <option v-for="t in MATCH_TYPES" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>

              <div class="col-span-12 md:col-span-4">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  Method <span class="text-[11px] text-slate-500" title="Use a method filter to reduce side effects">ⓘ</span>
                </div>
                <select
                  v-model="draft.method"
                  class="h-10 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 text-sm text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30"
                >
                  <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>

              <div class="col-span-12 md:col-span-4">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  Status <span class="text-[11px] text-slate-500" title="HTTP status code 100–599">ⓘ</span>
                </div>
                <Input v-model="draft.status" type="number" />
              </div>

              <div class="col-span-12 md:col-span-8">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  Content-Type <span class="text-[11px] text-slate-500" title="Examples: application/json, text/plain, application/xml">ⓘ</span>
                </div>
                <Input v-model="draft.contentType" placeholder="application/json; charset=utf-8" />
              </div>
              <div class="col-span-12 md:col-span-4">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  Enabled <span class="text-[11px] text-slate-500" title="Disable without deleting">ⓘ</span>
                </div>
                <div class="flex h-10 items-center rounded-xl border border-slate-800/70 bg-slate-950/20 px-3">
                  <Switch :model-value="Boolean(draft.enabled)" @update:model-value="(v) => (draft.enabled = v)" />
                </div>
              </div>

              <div class="col-span-12">
                <div class="mb-1 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    Body <span class="text-[11px] text-slate-500" title="Any text: JSON, XML, plain text, etc.">ⓘ</span>
                  </div>
                  <div class="text-[11px] text-slate-500">
                    Tip: For JSON content-types, the body is validated.
                  </div>
                </div>
                <Textarea v-model="draft.body" :rows="10" mono placeholder='{"ok":true}' />
              </div>

              <div class="col-span-12 md:col-span-6">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  Extra headers (JSON)
                  <span class="text-[11px] text-slate-500" title='Example: {"Cache-Control":"no-store"}'>ⓘ</span>
                </div>
                <Textarea v-model="headersJson" :rows="6" mono placeholder='{"Cache-Control":"no-store"}' />
              </div>

              <div class="col-span-12 md:col-span-6">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  Delay (ms) <span class="text-[11px] text-slate-500" title="Simulate network latency">ⓘ</span>
                </div>
                <Input v-model="draft.delayMs" type="number" />

                <div class="mt-4">
                  <div class="text-xs font-extrabold text-slate-200">Validation</div>
                  <div v-if="validation.errors.length === 0 && validation.warnings.length === 0" class="mt-2 text-sm text-slate-400">
                    Looks good.
                  </div>
                  <div v-if="validation.errors.length" class="mt-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
                    <div class="font-semibold">Errors</div>
                    <ul class="mt-1 list-disc pl-5">
                      <li v-for="e in validation.errors" :key="e">{{ e }}</li>
                    </ul>
                  </div>
                  <div v-if="validation.warnings.length" class="mt-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <div class="font-semibold">Warnings</div>
                    <ul class="mt-1 list-disc pl-5">
                      <li v-for="w in validation.warnings" :key="w">{{ w }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2">
              <Button variant="outline" @click="newDraft" title="Reset editor to a new route">New</Button>
              <Button @click="saveDraft" title="Save this route">Save</Button>
            </div>
          </div>
        </Card>
      </div>

      <!-- MONITORING -->
      <Card>
        <div class="flex items-center justify-between border-b border-slate-800/70 px-4 py-3">
          <div class="text-sm font-extrabold">Monitoring</div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="doClearStats">Clear stats</Button>
          </div>
        </div>

        <div class="overflow-auto p-4">
          <table class="w-full border-collapse text-left text-sm">
            <thead class="text-xs text-slate-400">
              <tr>
                <th class="border-b border-slate-800/70 px-2 py-2">Route</th>
                <th class="border-b border-slate-800/70 px-2 py-2">Hits</th>
                <th class="border-b border-slate-800/70 px-2 py-2">Last</th>
                <th class="border-b border-slate-800/70 px-2 py-2">Result</th>
                <th class="border-b border-slate-800/70 px-2 py-2">Last URL</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in statsRows" :key="row.route.id" class="align-top">
                <td class="border-b border-slate-800/40 px-2 py-3">
                  <div class="min-w-0">
                    <div class="truncate font-mono text-xs text-slate-200" :title="row.route.match">{{ row.route.match }}</div>
                    <div class="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <Badge variant="outline">{{ row.route.method }}</Badge>
                      <Badge variant="outline">status {{ row.route.status }}</Badge>
                      <Badge :variant="row.route.enabled ? 'success' : 'warning'">{{ row.route.enabled ? "enabled" : "disabled" }}</Badge>
                    </div>
                  </div>
                </td>
                <td class="border-b border-slate-800/40 px-2 py-3 font-semibold text-slate-200">{{ row.hits }}</td>
                <td class="border-b border-slate-800/40 px-2 py-3 text-slate-300">
                  <div :title="row.lastHitAt ? formatWhen(row.lastHitAt) : ''">{{ fromNow(row.lastHitAt) }}</div>
                </td>
                <td class="border-b border-slate-800/40 px-2 py-3">
                  <Badge v-if="row.lastOk === true" variant="success">ok</Badge>
                  <Badge v-else-if="row.lastOk === false" variant="danger" :title="row.lastError || ''">error</Badge>
                  <span v-else class="text-slate-500">—</span>
                </td>
                <td class="border-b border-slate-800/40 px-2 py-3">
                  <div class="max-w-[520px] truncate font-mono text-xs text-slate-400" :title="row.lastUrl || ''">
                    {{ row.lastUrl || "—" }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="mt-3 text-xs text-slate-500">
            Tip: If a route isn’t being hit, tighten/loosen its match or check method filters. Conflicts are resolved by order: first match wins.
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

