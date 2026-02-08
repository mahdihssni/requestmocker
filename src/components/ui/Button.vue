<script setup>
import { computed } from "vue";
import { cn } from "../../lib/cn";

const props = defineProps({
  variant: { type: String, default: "default" }, // default | secondary | outline | destructive | ghost
  size: { type: String, default: "default" }, // default | sm | lg | icon
  disabled: { type: Boolean, default: false },
  type: { type: String, default: "button" }
});

const classes = computed(() => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    default:
      "bg-slate-50 text-slate-900 hover:bg-slate-100 shadow-sm shadow-black/20",
    secondary:
      "bg-slate-800 text-slate-50 hover:bg-slate-700 border border-slate-700",
    outline:
      "border border-slate-700 bg-transparent text-slate-50 hover:bg-slate-900",
    destructive:
      "bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-black/20",
    ghost: "bg-transparent text-slate-50 hover:bg-slate-900"
  };

  const sizes = {
    default: "h-10 px-4",
    sm: "h-9 px-3 rounded-lg text-xs",
    lg: "h-11 px-5",
    icon: "h-10 w-10 px-0"
  };

  return cn(base, variants[props.variant] || variants.default, sizes[props.size] || sizes.default);
});
</script>

<template>
  <button :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>

