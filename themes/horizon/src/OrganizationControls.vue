<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { Folder, Tag, X } from "lucide-vue-next";
import type { OrganizationKind, ThemeContext } from "@picloom/theme-sdk";
import OrganizationPicker from "./OrganizationPicker.vue";
const { context: ctx } = defineProps<{
  context: ThemeContext;
  signedIn: boolean;
}>();
const root = ref<HTMLElement>(),
  dialog = ref<HTMLDialogElement>(),
  tagPicker = ref<InstanceType<typeof OrganizationPicker>>(),
  collectionPicker = ref<InstanceType<typeof OrganizationPicker>>();
const active = ref<OrganizationKind>("tags");
const groups = computed(() => [
  {
    kind: "tags" as const,
    icon: Tag,
    items: tagPicker.value?.selectedItems ?? [],
  },
  {
    kind: "collections" as const,
    icon: Folder,
    items: collectionPicker.value?.selectedItems ?? [],
  },
]);
const selected = computed(() =>
  groups.value.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      kind: group.kind,
      icon: group.icon,
    })),
  ),
);
function picker(kind: OrganizationKind) {
  return kind === "tags" ? tagPicker.value : collectionPicker.value;
}
function position() {
  if (!dialog.value?.open || !root.value) return;
  const anchor = root.value.getBoundingClientRect();
  const box = dialog.value.getBoundingClientRect();
  const left = Math.max(
    16,
    Math.min(anchor.right - box.width, innerWidth - box.width - 16),
  );
  const top = Math.max(
    16,
    Math.min(anchor.bottom + 8, innerHeight - box.height - 16),
  );
  dialog.value.style.setProperty("--organization-left", `${left}px`);
  dialog.value.style.setProperty("--organization-top", `${top}px`);
}
async function open(kind: OrganizationKind) {
  active.value = kind;
  await nextTick();
  if (!dialog.value?.open) dialog.value?.showModal();
  position();
  picker(kind)?.focusSearch();
}
function closeOutside(event: MouseEvent) {
  if (event.target !== dialog.value) return;
  const box = dialog.value.getBoundingClientRect();
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    dialog.value.close();
}
let observer: ResizeObserver;
onMounted(() => {
  observer = new ResizeObserver(position);
  if (dialog.value) observer.observe(dialog.value);
  window.addEventListener("resize", position);
});
onUnmounted(() => {
  observer.disconnect();
  window.removeEventListener("resize", position);
});
</script>
<template>
  <div ref="root" class="hz-organization">
    <div class="hz-organization-actions">
      <slot name="profile" />
      <template v-if="signedIn">
        <button
          v-for="group in groups"
          :key="group.kind"
          type="button"
          class="hz-organization-trigger"
          aria-haspopup="dialog"
          @click="open(group.kind)"
        >
          <component
            :is="group.icon"
            :size="14"
            :stroke-width="1.5"
            aria-hidden="true"
          />
          {{
            ctx.t(
              group.kind === "tags"
                ? "organization.addTags"
                : "organization.addCollections",
            )
          }}
        </button>
      </template>
    </div>
    <div v-if="selected.length" class="hz-organization-selected">
      <button
        v-for="item in selected.slice(0, 3)"
        :key="`${item.kind}:${item.id}`"
        type="button"
        class="hz-organization-chip"
        :title="item.name"
        :aria-label="ctx.t('organization.remove', { name: item.name })"
        @click="picker(item.kind)?.toggle(item.id)"
      >
        <component :is="item.icon" :size="12" aria-hidden="true" />
        <span>{{ item.name }}</span
        ><X :size="11" aria-hidden="true" />
      </button>
      <button
        v-if="selected.length > 3"
        type="button"
        class="hz-organization-more"
        aria-haspopup="dialog"
        @click="open(selected[3]!.kind)"
      >
        {{ ctx.t("organization.more", { count: selected.length - 3 }) }}
      </button>
    </div>
    <dialog
      ref="dialog"
      class="hz-organization-dialog"
      :aria-label="ctx.t('organization.title')"
      @click="closeOutside"
    >
      <div class="hz-organization-heading">
        <div
          class="hz-organization-tabs"
          role="group"
          :aria-label="ctx.t('organization.title')"
        >
          <button
            v-for="group in groups"
            :key="group.kind"
            type="button"
            :aria-pressed="active === group.kind"
            @click="open(group.kind)"
          >
            <component
              :is="group.icon"
              :size="14"
              :stroke-width="1.5"
              aria-hidden="true"
            />
            {{ ctx.t(`organization.${group.kind}`) }}
            <span v-if="group.items.length">{{ group.items.length }}</span>
          </button>
        </div>
        <button
          type="button"
          class="hz-organization-close"
          :aria-label="ctx.t('organization.close')"
          @click="dialog?.close()"
        >
          <X :size="17" aria-hidden="true" />
        </button>
      </div>
      <OrganizationPicker
        v-if="signedIn"
        v-show="active === 'tags'"
        ref="tagPicker"
        :context="ctx"
        kind="tags"
      />
      <OrganizationPicker
        v-if="signedIn"
        v-show="active === 'collections'"
        ref="collectionPicker"
        :context="ctx"
        kind="collections"
      />
    </dialog>
  </div>
</template>
<style scoped>
:global(html:has(.hz-organization-dialog[open])) {
  overflow: hidden;
}
.hz-organization {
  margin-top: 20px;
  min-width: 0;
}
.hz-organization-actions,
.hz-organization-selected,
.hz-organization-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}
.hz-organization-trigger {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 6px 7px;
  border: 1px solid var(--edge);
  border-radius: 6px;
  color: var(--muted);
  font-size: 11px;
}
.hz-organization-trigger:hover,
.hz-organization-more:hover {
  color: var(--mint);
  background: color-mix(in srgb, var(--mint) 7%, transparent);
}
.hz-organization-selected {
  gap: 6px;
  margin-top: 9px;
}
.hz-organization-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 4px 7px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--mint) 9%, transparent);
  color: var(--mint);
  font-size: 11px;
}
.hz-organization-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hz-organization-chip svg {
  flex-shrink: 0;
}
.hz-organization-chip:hover {
  background: color-mix(in srgb, var(--mint) 16%, transparent);
}
.hz-organization-more {
  padding: 4px 6px;
  border-radius: 5px;
  color: var(--muted);
  font-size: 11px;
}
.hz-organization-dialog {
  position: fixed;
  inset: var(--organization-top, 16px) auto auto var(--organization-left, 16px);
  margin: 0;
  width: min(340px, calc(100vw - 32px));
  max-width: none;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  border: 1px solid var(--edge);
  border-radius: 12px;
  background: var(--popover);
  color: var(--paper);
  font: inherit;
  box-shadow: 0 16px 48px rgba(3, 12, 28, 0.3);
  backdrop-filter: blur(24px);
  scrollbar-width: thin;
}
.hz-organization-dialog::backdrop {
  background: transparent;
}
.hz-organization-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.hz-organization-tabs {
  gap: 4px;
}
.hz-organization-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 5px;
  color: var(--muted);
  font-size: 12px;
}
.hz-organization-tabs button[aria-pressed="true"] {
  color: var(--mint);
  background: color-mix(in srgb, var(--mint) 10%, transparent);
}
.hz-organization-tabs span {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.hz-organization-close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 5px;
  color: var(--muted);
}
.hz-organization-close:hover {
  background: color-mix(in srgb, var(--mint) 8%, transparent);
  color: var(--paper);
}
@media (max-width: 720px) {
  .hz-organization-dialog {
    inset: auto 0 0;
    width: 100%;
    max-height: calc(100dvh - 24px);
    padding: 18px 20px max(20px, env(safe-area-inset-bottom));
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
  }
  .hz-organization-dialog::backdrop {
    background: rgba(4, 12, 25, 0.45);
  }
}
@media (pointer: coarse) {
  .hz-organization-trigger,
  .hz-organization-chip,
  .hz-organization-more,
  .hz-organization-tabs button,
  .hz-organization-close {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>
