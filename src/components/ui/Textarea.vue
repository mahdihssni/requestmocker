<script setup>
import { computed } from "vue";
import { cn } from "../../lib/cn";

const props = defineProps({
  modelValue: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  rows: { type: [String, Number], default: 4 },
  disabled: { type: Boolean, default: false },
  class: { type: String, default: "" },
  mono: { type: Boolean, default: false }
});

const emit = defineEmits(["update:modelValue"]);

const classes = computed(() =>
  cn(
    "flex w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30",
    props.mono ? "font-mono" : "",
    props.class
  )
);
</script>

<template>
  <textarea
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="classes"
    :value="modelValue"
    @input="emit('update:modelValue', $event.target.value)"
  />
</template>

