<script setup>
import { computed } from "vue";
import { cn } from "../../lib/cn";

const props = defineProps({
  modelValue: { type: [String, Number], default: "" },
  placeholder: { type: String, default: "" },
  type: { type: String, default: "text" },
  disabled: { type: Boolean, default: false },
  class: { type: String, default: "" }
});

const emit = defineEmits(["update:modelValue"]);

const classes = computed(() =>
  cn(
    "flex h-10 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30",
    props.class
  )
);
</script>

<template>
  <input
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="classes"
    :value="modelValue"
    @input="emit('update:modelValue', $event.target.value)"
  />
</template>

