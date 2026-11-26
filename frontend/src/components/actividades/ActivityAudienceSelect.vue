<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import {
  PUBLICOS_OBJETIVO,
  PUBLICO_OBJETIVO_OTROS,
  esPublicoOtros,
  parsePublicoObjetivo,
  serializarPublicoObjetivo,
} from '@/utils/activityAudience';

const model = defineModel<string>({ default: '' });
const authStore = useAuthStore();
const pendiente = ref('');
const textoOtros = ref('');
const pidiendoOtros = ref(false);

const seleccion = computed({
  get: () => parsePublicoObjetivo(model.value),
  set: (valor: string[]) => {
    model.value = serializarPublicoObjetivo(valor);
  },
});

const disponibles = computed(() => {
  const base = PUBLICOS_OBJETIVO.filter((item) => !seleccion.value.includes(item.label));
  if (!authStore.esSuperUsuario) return [...base];
  if (seleccion.value.some((item) => esPublicoOtros(item))) return [...base];
  return [...base, { id: 'otros', label: PUBLICO_OBJETIVO_OTROS }];
});

function agregar() {
  const label = pendiente.value.trim();
  pendiente.value = '';
  if (!label) return;

  if (label === PUBLICO_OBJETIVO_OTROS) {
    if (!authStore.esSuperUsuario) return;
    pidiendoOtros.value = true;
    textoOtros.value = '';
    return;
  }

  if (seleccion.value.includes(label)) return;
  seleccion.value = [...seleccion.value, label];
}

function confirmarOtros() {
  if (!authStore.esSuperUsuario) {
    pidiendoOtros.value = false;
    return;
  }
  const detalle = textoOtros.value.trim();
  const label = detalle
    ? `${PUBLICO_OBJETIVO_OTROS}: ${detalle}`
    : PUBLICO_OBJETIVO_OTROS;
  if (!seleccion.value.some((item) => esPublicoOtros(item) || item === label)) {
    seleccion.value = [...seleccion.value, label];
  }
  textoOtros.value = '';
  pidiendoOtros.value = false;
}

function cancelarOtros() {
  textoOtros.value = '';
  pidiendoOtros.value = false;
}

function quitar(label: string) {
  seleccion.value = seleccion.value.filter((item) => item !== label);
}
</script>

<template>
  <div class="space-y-3" aria-label="A quién está dirigido">
    <select
      v-model="pendiente"
      aria-label="Seleccionar público objetivo"
      class="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold uppercase text-primary-dark transition-all focus:ring-2 focus:ring-umsa-blue dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      @change="agregar"
    >
      <option value="" disabled>Seleccione un perfil...</option>
      <option v-for="opcion in disponibles" :key="opcion.id" :value="opcion.label">
        {{ opcion.label }}
      </option>
    </select>

    <div
      v-if="pidiendoOtros"
      class="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30"
    >
      <p class="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
        Otros (solo Super Usuario)
      </p>
      <input
        v-model="textoOtros"
        type="text"
        maxlength="180"
        placeholder="Describe a quién se dirige..."
        class="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-primary-dark outline-none focus:border-amber-400 dark:border-amber-800 dark:bg-gray-900 dark:text-white"
        @keydown.enter.prevent="confirmarOtros"
      >
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg bg-[#003B71] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
          @click="confirmarOtros"
        >
          Agregar
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-gray-700"
          @click="cancelarOtros"
        >
          Cancelar
        </button>
      </div>
    </div>

    <div
      v-if="seleccion.length"
      class="rounded-xl border border-[#0070bb]/30 bg-[#0070bb]/5 p-3 dark:border-sky-500/40 dark:bg-sky-950/40"
    >
      <p class="mb-2 text-[10px] font-black uppercase tracking-widest text-[#0070bb] dark:text-sky-300">
        Seleccionados ({{ seleccion.length }})
      </p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="perfil in seleccion"
          :key="perfil"
          class="inline-flex max-w-full items-center gap-2 rounded-lg bg-[#0070bb] px-3 py-2 text-xs font-bold leading-snug text-white shadow-sm dark:bg-sky-600"
        >
          <span class="min-w-0 break-words">{{ perfil }}</span>
          <button
            type="button"
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm leading-none text-white transition hover:bg-white/35"
            :aria-label="`Quitar ${perfil}`"
            @click="quitar(perfil)"
          >
            ×
          </button>
        </span>
      </div>
    </div>
    <p v-else class="text-xs font-bold text-amber-700 dark:text-amber-300">Aún no ha seleccionado un público objetivo.</p>
  </div>
</template>
