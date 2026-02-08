<script setup>
import { cn } from "../../lib/cn";

defineProps({
  class: { type: String, default: "" }
});
</script>

<template>
  <div :class="cn('rounded-2xl border border-slate-800/80 bg-slate-950/40 shadow-sm shadow-black/30', $props.class)">
    <slot />
  </div>
</template>

