<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import Button from "../components/ui/Button.vue";
import Card from "../components/ui/Card.vue";
import Badge from "../components/ui/Badge.vue";
import Switch from "../components/ui/Switch.vue";
import { clearStats, getState, openOptions, setStatePatch, subscribeState } from "../lib/extensionState";
import { fromNow } from "../lib/time";

const state = ref({ enabled: true, routes: [], stats: {} });
const loading = ref(true);
let unsub = null;
const expandedKey = ref(null);

onMounted(async () => {
  state.value = await getState();
  loading.value = false;
  unsub = subscribeState((s) => (state.value = s));
});

onUnmounted(() => {
  try {
    unsub?.();
  } catch {
    // ignore
  }
});

const enabledCount = computed(() => (state.value.routes || []).filter((r) => r?.enabled).length);
const routeCount = computed(() => (state.value.routes || []).length);

const routeById = computed(() => {
  const map = new Map();
  for (const r of state.value.routes || []) map.set(r.id, r);
  return map;
});

const recentEvents = computed(() => {
  const stats = state.value.stats || {};
  /** @type {any[]} */
  const all = [];
  for (const [routeId, s] of Object.entries(stats)) {
    for (const ev of s?.events || []) all.push({ routeId, ...ev });
  }
  all.sort((a, b) => (b.at || 0) - (a.at || 0));
  return all.slice(0, 8);
});

async function toggleGlobal(v) {
  await setStatePatch({ enabled: Boolean(v) });
}

async function doClearStats() {
  await clearStats();
}

function toggleExpanded(ev) {
  const key = String(ev.routeId) + ":" + String(ev.at);
  expandedKey.value = expandedKey.value === key ? null : key;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ""));
  } catch {
    // ignore (clipboard may be unavailable)
  }
}

function renderHeaders(obj) {
  if (!obj || typeof obj !== "object") return "";
  const entries = Object.entries(obj);
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
}

function getPathName(url) {
  return `/${url.split('/').pop()}`;
}
</script>

<template>
  <div class="h-full w-full p-3">
    <div class="h-full rounded-3xl border border-slate-800/60 bg-gradient-to-b from-slate-950/70 to-slate-950/30 p-3 shadow-xl shadow-black/40 flex flex-col">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-md shadow-black/30">
            <span class="text-sm font-extrabold tracking-wide">RM</span>
          </div>
          <div class="leading-tight">
            <div class="text-sm font-extrabold">Request Mocker</div>
            <div class="text-xs text-slate-400">Mock routes in this browser</div>
          </div>
        </div>

        <div class="flex flex-col items-end gap-1">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold text-slate-400">Enabled</span>
            <Switch :model-value="Boolean(state.enabled)" @update:model-value="toggleGlobal" />
          </div>
          <div class="text-[11px] text-slate-400">
            <span class="font-semibold text-slate-200">{{ enabledCount }}</span>
            <span> / {{ routeCount }} routes active</span>
          </div>
        </div>
      </div>

      <div class="mt-3 grid gap-2 flex-1 min-h-0">
        <Card class="p-3 flex flex-col min-h-0">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-extrabold text-slate-100">Recent activity</div>
            <div class="flex items-center gap-2">
              <Button size="sm" variant="outline" title="Clear monitoring stats" @click="doClearStats">Clear</Button>
              <Button size="sm" variant="secondary" title="Open full route management" @click="openOptions">Manage</Button>
            </div>
          </div>

          <div v-if="loading" class="mt-2 text-xs text-slate-400">Loading…</div>
          <div v-else-if="recentEvents.length === 0" class="mt-2 text-xs text-slate-400">
            No mocked requests yet. Open “Manage” to add a route.
          </div>

          <div v-else class="mt-2 grid gap-2 overflow-auto pr-1 flex-1 min-h-0 w-full">
            <div
              v-for="ev in recentEvents"
              :key="String(ev.routeId) + String(ev.at)"
              role="button"
              tabindex="0"
              class="rounded-2xl border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-left transition hover:bg-slate-950/40 cursor-pointer select-none"
              @click="toggleExpanded(ev)"
              @keydown.enter.prevent="toggleExpanded(ev)"
              @keydown.space.prevent="toggleExpanded(ev)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{{ (ev.method || "GET").toUpperCase() }}</Badge>
                    <Badge variant="outline">status {{ ev.status ?? "—" }}</Badge>
                    <Badge :variant="ev.ok ? 'success' : 'danger'">{{ ev.ok ? "MOCKED" : "ERROR" }}</Badge>
                    <Badge variant="outline">{{ ev.transport || "—" }}</Badge>
                  </div>
                  <div class="mt-1 truncate font-mono text-[11px] text-slate-200 break-all w-32" :title="ev.url || ''">
                    {{ getPathName(ev.url) || "—" }}
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span class="break-all" :title="routeById.get(ev.routeId)?.match || ''">
                      route: <span class="font-mono text-slate-300">{{ routeById.get(ev.routeId)?.match || "—" }}</span>
                    </span>
                    <span class="shrink-0">•</span>
                    <span class="shrink-0">{{ fromNow(ev.at) }}</span>
                  </div>
                </div>
                <div class="shrink-0 text-[11px] text-slate-500">
                  {{ expandedKey === String(ev.routeId) + ":" + String(ev.at) ? "Hide" : "Details" }}
                </div>
              </div>

              <div
                v-if="expandedKey === String(ev.routeId) + ':' + String(ev.at)"
                class="mt-3 grid gap-2 rounded-2xl border border-slate-800/60 bg-slate-950/30 p-3"
              >
                <div class="grid gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-[11px] font-extrabold text-slate-200">Request headers</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Copy request headers"
                      @click.stop="copyText(renderHeaders(ev.requestHeaders))"
                    >
                      Copy
                    </Button>
                  </div>
                  <pre class="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800/60 bg-black/30 p-2 text-[11px] text-slate-300">{{
                    renderHeaders(ev.requestHeaders) || "—"
                  }}</pre>
                </div>

                <div class="grid gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-[11px] font-extrabold text-slate-200">Response headers</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Copy response headers"
                      @click.stop="copyText(renderHeaders(ev.responseHeaders))"
                    >
                      Copy
                    </Button>
                  </div>
                  <pre class="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800/60 bg-black/30 p-2 text-[11px] text-slate-300">{{
                    renderHeaders(ev.responseHeaders) || "—"
                  }}</pre>
                </div>

                <div class="grid gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-[11px] font-extrabold text-slate-200">Response body (preview)</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Copy response body preview"
                      @click.stop="copyText(ev.responseBodyPreview || '')"
                    >
                      Copy
                    </Button>
                  </div>
                  <pre class="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800/60 bg-black/30 p-2 font-mono text-[11px] text-slate-300">{{
                    ev.responseBodyPreview || (ev.ok ? "—" : ev.error || "—")
                  }}</pre>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="openOptions" title="Open the full route management panel">Add / Edit routes</Button>
          <Button
            variant="secondary"
            title="Quick tip: use match type Includes for api.com/test"
            @click="openOptions"
          >
            Tips & Help
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

