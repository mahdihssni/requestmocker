<script setup>
import { computed } from "vue";
import { cn } from "../../lib/cn";

const props = defineProps({
  variant: { type: String, default: "default" }, // default|success|warning|danger|outline
  class: { type: String, default: "" }
});

const classes = computed(() => {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold";
  const variants = {
    default: "bg-slate-800 text-slate-100 border border-slate-700",
    outline: "bg-transparent text-slate-200 border border-slate-700",
    success: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
    danger: "bg-rose-500/15 text-rose-200 border border-rose-500/30"
  };
  return cn(base, variants[props.variant] || variants.default, props.class);
});
</script>

<template>
  <span :class="classes"><slot /></span>
</template>

