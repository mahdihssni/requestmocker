<script setup>
import { computed } from "vue";
import { cn } from "../../lib/cn";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  class: { type: String, default: "" }
});

const emit = defineEmits(["update:modelValue"]);

const rootClass = computed(() =>
  cn(
    "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
    props.modelValue ? "bg-emerald-500/25 border-emerald-500/40" : "bg-slate-900 border-slate-700",
    props.disabled ? "opacity-50 pointer-events-none" : "cursor-pointer",
    props.class
  )
);

const thumbClass = computed(() =>
  cn(
    "inline-block h-5 w-5 transform rounded-full bg-slate-100 transition-transform",
    props.modelValue ? "translate-x-5" : "translate-x-1"
  )
);
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    :class="rootClass"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span :class="thumbClass" />
  </button>
</template>

