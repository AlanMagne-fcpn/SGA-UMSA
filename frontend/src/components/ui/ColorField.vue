<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { institutionalPalette } from '@/constants/institutionalPalette'

const props = withDefaults(defineProps<{
  modelValue: string
  label: string
}>(), { modelValue: '#0070B4' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function normalizeHex(value: string, allowShort = false): string | null {
  const raw = value.trim().replace(/^#/, '')
  if (/^[\da-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`
  if (allowShort && /^[\da-f]{3}$/i.test(raw)) {
    return `#${raw.split('').map(char => char + char).join('').toUpperCase()}`
  }
  return null
}

const menuOpen = ref(false)
const draft = ref(props.modelValue)
const colorActual = computed(() => normalizeHex(props.modelValue, true) || '#0070B4')
const colorNombrado = computed(() => institutionalPalette.find(color => color.value === colorActual.value))

watch(() => props.modelValue, value => { draft.value = value })
watch(menuOpen, open => { if (open) draft.value = colorActual.value })

function elegirColor(value: string, cerrar = false) {
  const normalized = normalizeHex(value, true)
  if (!normalized) return
  draft.value = normalized
  emit('update:modelValue', normalized)
  if (cerrar) menuOpen.value = false
}

function onHexInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value
  const normalized = normalizeHex(draft.value)
  if (normalized) emit('update:modelValue', normalized)
}

function onHexBlur() {
  const normalized = normalizeHex(draft.value, true)
  if (normalized) elegirColor(normalized)
  else draft.value = colorActual.value
}
</script>

<template>
  <div class="min-w-0 space-y-2">
    <span class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">{{ label }}</span>
    <VMenu v-model="menuOpen" :close-on-content-click="false" location="bottom start" :offset="6">
      <template #activator="{ props: activatorProps }">
        <button v-bind="activatorProps" type="button" :aria-label="`Elegir ${label.toLowerCase()}`"
          class="flex h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 text-left shadow-sm transition-colors hover:border-[#0070BB] focus:outline-none focus:ring-2 focus:ring-[#0070BB]/30 dark:border-slate-700 dark:bg-gray-800">
          <span class="h-7 w-7 shrink-0 rounded-md border border-slate-300 dark:border-slate-500" :style="{ backgroundColor: colorActual }"></span>
          <span class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-100">{{ colorNombrado?.name || colorActual }}</span>
          <VIcon class="material-symbols-outlined text-lg text-[#0070BB]" aria-hidden="true">palette</VIcon>
        </button>
      </template>
      <VCard class="w-72 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-gray-900">
        <p class="text-xs font-bold text-[#003B71] dark:text-sky-200">Paleta UMSA</p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Selecciona un color para {{ label.toLowerCase() }}.</p>
        <div class="mt-3 grid grid-cols-3 gap-2">
          <button v-for="color in institutionalPalette" :key="color.value" type="button"
            :aria-label="`Usar ${color.name} para ${label.toLowerCase()}`"
            class="rounded-lg border p-1 text-left transition-colors hover:border-[#0070BB] focus:outline-none focus:ring-2 focus:ring-[#0070BB]/30"
            :class="colorActual === color.value ? 'border-[#0070BB]' : 'border-slate-200 dark:border-slate-700'"
            @click="elegirColor(color.value, true)">
            <span class="block h-8 rounded border border-black/10" :style="{ backgroundColor: color.value }"></span>
            <span class="mt-1 block truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">{{ color.name }}</span>
          </button>
        </div>
        <div class="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Color personalizado</label>
          <div class="flex items-center gap-2">
            <input type="color" :value="colorActual" :aria-label="`Elegir color personalizado para ${label.toLowerCase()}`"
              class="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-slate-600"
              @input="elegirColor(($event.target as HTMLInputElement).value)" />
            <input :value="draft" type="text" maxlength="7" spellcheck="false"
              :aria-label="`Código hexadecimal de ${label.toLowerCase()}`"
              class="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs font-semibold uppercase text-slate-800 outline-none focus:border-[#0070BB] dark:border-slate-600 dark:bg-gray-800 dark:text-white"
              @input="onHexInput" @blur="onHexBlur" />
          </div>
        </div>
      </VCard>
    </VMenu>
  </div>
</template>
