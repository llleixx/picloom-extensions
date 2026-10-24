<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Check, ChevronDown } from "lucide-vue-next";
const props = defineProps<{
  format: string;
  formats: readonly string[];
  auto: boolean;
  t: (key: string) => string;
}>();
const emit = defineEmits<{ change: [format: string, auto: boolean] }>();
const root = ref<HTMLDetailsElement>();
function close() {
  if (!root.value) return;
  root.value.open = false;
  root.value.querySelector("summary")?.focus({ preventScroll: true });
}
function choose(format: string) {
  emit("change", format, props.auto);
  close();
}
function outside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node))
    root.value?.removeAttribute("open");
}
function escape(event: KeyboardEvent) {
  if (event.key !== "Escape" || !root.value?.open) return;
  event.preventDefault();
  event.stopPropagation();
  close();
}
function focusOut(event: FocusEvent) {
  if (event.relatedTarget && !root.value?.contains(event.relatedTarget as Node))
    root.value?.removeAttribute("open");
}
onMounted(() => {
  document.addEventListener("pointerdown", outside);
  document.addEventListener("keydown", escape, true);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", outside);
  document.removeEventListener("keydown", escape, true);
});
</script>
<template>
  <details ref="root" class="hz-copy" @focusout="focusOut">
    <summary role="button" :aria-label="`${t('copyFormat')}: ${format}`">
      {{ t("copyMode") }}: {{ format
      }}<ChevronDown :size="12" aria-hidden="true" />
    </summary>
    <div class="hz-copy-menu">
      <div role="group" :aria-label="t('copyFormat')">
        <button
          v-for="value in formats"
          :key="value"
          type="button"
          class="hz-copy-format"
          :aria-pressed="value === format"
          @click="choose(value)"
        >
          <span class="hz-copy-check" aria-hidden="true"
            ><Check v-if="value === format" :size="13"
          /></span>
          {{ value }}
        </button>
      </div>
      <label class="hz-copy-auto">
        <input
          type="checkbox"
          :checked="auto"
          @change="
            $emit('change', format, ($event.target as HTMLInputElement).checked)
          "
        />{{ t("autoCopy") }}
      </label>
    </div>
  </details>
</template>
<style scoped>
.hz-copy {
  position: relative;
  color: var(--muted);
  font-size: 11px;
}
.hz-copy summary {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 5px 7px;
  border-radius: 5px;
  list-style: none;
  cursor: pointer;
}
.hz-copy summary::-webkit-details-marker {
  display: none;
}
.hz-copy summary:hover,
.hz-copy[open] summary {
  color: var(--mint);
  background: color-mix(in srgb, var(--mint) 8%, transparent);
}
.hz-copy-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: min(224px, calc(100vw - 112px));
  padding: 8px;
  border: 1px solid var(--edge);
  border-radius: 10px;
  background: var(--popover);
  color: var(--paper);
  box-shadow: 0 12px 32px rgba(3, 12, 28, 0.25);
  backdrop-filter: blur(24px);
}
.hz-copy-format {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 7px 8px;
  border-radius: 5px;
  text-align: left;
  font-size: 12px;
}
.hz-copy-format:hover,
.hz-copy-format[aria-pressed="true"] {
  background: color-mix(in srgb, var(--mint) 10%, transparent);
  color: var(--mint);
}
.hz-copy-check {
  display: flex;
  width: 13px;
  flex-shrink: 0;
}
.hz-copy-auto {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  margin-top: 6px;
  padding: 10px 8px 4px;
  border-top: 1px solid var(--edge);
  font-size: 12px;
  cursor: pointer;
}
.hz-copy-auto input {
  margin: 0;
  accent-color: var(--mint);
}
@media (pointer: coarse) {
  .hz-copy summary,
  .hz-copy-format,
  .hz-copy-auto {
    min-height: 44px;
  }
}
</style>
