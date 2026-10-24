<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-vue-next";
import type {
  ThemeContext,
  OrganizationItem,
  OrganizationKind,
} from "@picloom/theme-sdk";
const props = defineProps<{ context: ThemeContext; kind: OrganizationKind }>();
const ctx = props.context,
  snapshot = shallowRef(ctx.getSnapshot());
const stop = ctx.subscribe((value) => {
  snapshot.value = value;
});
onUnmounted(stop);
const input = ref<HTMLInputElement>(),
  search = ref(""),
  offset = ref(0),
  items = ref<OrganizationItem[]>([]),
  total = ref(0),
  known = ref(new Map<string, string>()),
  error = ref(""),
  loading = ref(false),
  busy = ref(false);
const selected = computed(() =>
  props.kind === "tags"
    ? snapshot.value.organization.tagIds
    : snapshot.value.organization.collectionIds,
);
const selectedItems = computed(() =>
  selected.value.map((id) => ({ id, name: known.value.get(id) ?? id })),
);
let generation = 0;
async function load() {
  const request = ++generation;
  loading.value = true;
  error.value = "";
  try {
    const result = await ctx.organization.list(props.kind, {
      q: search.value,
      limit: 50,
      offset: offset.value,
    });
    if (request !== generation) return;
    items.value = result.items;
    total.value = result.total;
    for (const item of items.value) known.value.set(item.id, item.name);
  } catch (e) {
    if (request === generation)
      error.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (request === generation) loading.value = false;
  }
}
watch(search, () => {
  offset.value = 0;
});
watch([search, offset], load, { immediate: true });
function toggle(id: string) {
  const value = selected.value.includes(id)
    ? selected.value.filter((item) => item !== id)
    : selected.value.length < 100
      ? [...selected.value, id]
      : [...selected.value];
  ctx.organization.select({
    ...snapshot.value.organization,
    [props.kind === "tags" ? "tagIds" : "collectionIds"]: value,
  });
}
async function create() {
  if (!search.value.trim() || busy.value || selected.value.length >= 100)
    return;
  busy.value = true;
  error.value = "";
  try {
    const item = await ctx.organization.create(props.kind, search.value);
    known.value.set(item.id, item.name);
    if (!selected.value.includes(item.id)) toggle(item.id);
    search.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
function focusSearch() {
  input.value?.focus({ preventScroll: true });
}
defineExpose({ selectedItems, toggle, focusSearch });
</script>
<template>
  <fieldset class="organization-picker" :disabled="busy">
    <div
      v-if="selectedItems.length"
      class="organization-selected"
      :aria-label="ctx.t('organization.selected')"
    >
      <button
        v-for="item in selectedItems"
        :key="item.id"
        type="button"
        class="organization-chip"
        :aria-label="ctx.t('organization.remove', { name: item.name })"
        @click="toggle(item.id)"
      >
        <span>{{ item.name }}</span
        ><X :size="12" aria-hidden="true" />
      </button>
    </div>
    <div class="organization-search">
      <input
        ref="input"
        v-model="search"
        :placeholder="ctx.t('organization.search')"
        :aria-label="
          ctx.t(
            kind === 'tags'
              ? 'organization.searchTags'
              : 'organization.searchCollections',
          )
        "
        @keydown.enter.prevent="create"
      /><button
        type="button"
        :disabled="!search.trim() || selected.length >= 100"
        @click="create"
      >
        {{ ctx.t("organization.create") }}
      </button>
    </div>
    <div class="organization-options" :aria-busy="loading">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        :aria-pressed="selected.includes(item.id)"
        :disabled="!selected.includes(item.id) && selected.length >= 100"
        @click="toggle(item.id)"
      >
        <Check
          v-if="selected.includes(item.id)"
          :size="12"
          aria-hidden="true"
        />
        <span>{{ item.name }}</span>
      </button>
    </div>
    <p v-if="loading" class="organization-status" role="status">
      {{ ctx.t("loading") }}
    </p>
    <p v-else-if="!items.length && !error" class="organization-status">
      {{ ctx.t("organization.empty") }}
    </p>
    <div v-if="total > 50" class="organization-pagination">
      <button
        type="button"
        :aria-label="ctx.t('previous')"
        :disabled="offset === 0"
        @click="offset -= 50"
      >
        <ChevronLeft :size="16" aria-hidden="true" />
      </button>
      <span>{{ offset + 1 }}–{{ offset + items.length }} / {{ total }}</span>
      <button
        type="button"
        :aria-label="ctx.t('next')"
        :disabled="offset + 50 >= total"
        @click="offset += 50"
      >
        <ChevronRight :size="16" aria-hidden="true" />
      </button>
    </div>
    <p v-if="error" class="organization-error" role="alert">{{ error }}</p>
  </fieldset>
</template>
<style scoped>
.organization-picker {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  font-size: 12px;
}
.organization-selected,
.organization-options {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.organization-selected {
  max-height: 112px;
  margin-bottom: 12px;
}
.organization-picker button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 8px;
  border: 1px solid var(--edge);
  border-radius: 5px;
  color: var(--muted);
  font-size: 12px;
  text-align: left;
  overflow-wrap: anywhere;
  max-width: 100%;
}
.organization-picker button svg {
  flex-shrink: 0;
}
.organization-picker button:hover {
  color: var(--paper);
  background: color-mix(in srgb, var(--mint) 7%, transparent);
}
.organization-picker button[aria-pressed="true"],
.organization-picker .organization-chip {
  color: var(--mint);
  background: color-mix(in srgb, var(--mint) 10%, transparent);
  border-color: color-mix(in srgb, var(--mint) 25%, transparent);
}
.organization-search {
  display: flex;
  gap: 8px;
}
.organization-search input {
  flex: 1;
  min-width: 0;
  width: 0;
  border: 1px solid var(--edge);
  border-radius: 6px;
  padding: 9px 10px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--paper);
}
.organization-search input::placeholder {
  color: var(--muted);
  opacity: 0.8;
}
.organization-search button {
  flex-shrink: 0;
}
.organization-options {
  max-height: 192px;
  margin-top: 12px;
}
.organization-options button {
  justify-content: flex-start;
}
.organization-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.organization-status,
.organization-error {
  margin-top: 10px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.organization-status {
  color: var(--muted);
}
.organization-error {
  color: #ffbbb0;
}
@media (pointer: coarse) {
  .organization-picker button {
    min-height: 44px;
    min-width: 44px;
  }
  .organization-search input {
    font-size: 16px;
  }
}
</style>
