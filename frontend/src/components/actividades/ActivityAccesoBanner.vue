<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { accesoTieneDatos, leerAcceso, modalidadPideAula, modalidadPideEnlace } from '@/utils/activityAcceso';

type Sesion = { dia: string; hora_inicio: string; hora_fin: string };
const props = defineProps<{
  requisitos?: any;
  modalidad?: string;
  compact?: boolean;
  editable?: boolean;
  sesiones?: Sesion[];
  guardando?: boolean;
}>();
const emit = defineEmits<{
  guardar: [payload: { aula_fisica: string; enlace_virtual: string; sesiones: Sesion[] }];
}>();

const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const acceso = computed(() => leerAcceso(props.requisitos));
const pideAula = computed(() => modalidadPideAula(props.modalidad));
const pideEnlace = computed(() => modalidadPideEnlace(props.modalidad));
const muestraAula = computed(() => props.editable ? pideAula.value : pideAula.value && !!acceso.value.aula_fisica);
const muestraEnlace = computed(() => props.editable ? pideEnlace.value : pideEnlace.value && !!acceso.value.enlace_virtual);
const visible = computed(() => props.editable ? (muestraAula.value || muestraEnlace.value) : accesoTieneDatos(acceso.value, props.modalidad));

const campo = ref<null | 'aula' | 'enlace' | 'horario'>(null);
const aulaLocal = ref('');
const enlaceLocal = ref('');
const sesionesLocal = ref<Sesion[]>([]);

watch(() => acceso.value.aula_fisica, (valor) => { if (campo.value !== 'aula') aulaLocal.value = valor; }, { immediate: true });
watch(() => acceso.value.enlace_virtual, (valor) => { if (campo.value !== 'enlace') enlaceLocal.value = valor; }, { immediate: true });
watch(() => props.sesiones, (lista) => {
  if (campo.value === 'horario') return;
  sesionesLocal.value = (lista || []).map((sesion) => ({ ...sesion }));
}, { immediate: true, deep: true });

const horarioTexto = computed(() => sesionesLocal.value.length
  ? sesionesLocal.value.map((sesion) => `${sesion.dia} ${sesion.hora_inicio}–${sesion.hora_fin}`).join(' · ')
  : 'Sin horario fijo');

function abrir(siguiente: 'aula' | 'enlace' | 'horario') {
  campo.value = campo.value === siguiente ? null : siguiente;
}

function confirmar() {
  emit('guardar', {
    aula_fisica: aulaLocal.value,
    enlace_virtual: enlaceLocal.value,
    sesiones: sesionesLocal.value.map((sesion) => ({ ...sesion })),
  });
  campo.value = null;
}
</script>

<template>
  <section
    v-if="visible"
    class="rounded-xl border border-[#028191] bg-white shadow-sm dark:border-sky-700 dark:bg-slate-900"
    :class="compact ? 'p-3' : 'p-4 md:p-5'"
    aria-label="Lugar y acceso a la actividad"
  >
    <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[#028191]">
      {{ modalidad || 'Actividad' }} — acceso para participantes
    </p>
    <div
      class="mt-2 grid gap-2"
      :class="editable && muestraAula && muestraEnlace ? 'lg:grid-cols-3' : (muestraAula && muestraEnlace ? 'md:grid-cols-2' : '')"
    >
      <div v-if="muestraAula" class="flex items-center gap-2.5 rounded-lg border border-[#028191]/40 bg-[#f3f8fa] px-3 py-2 dark:border-sky-800 dark:bg-slate-900/70">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#003B71] text-white">
          <VIcon class="material-symbols-outlined text-[18px]">meeting_room</VIcon>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Aula / lugar</p>
          <input v-if="campo === 'aula'" v-model="aulaLocal" type="text" maxlength="200" class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-[#003B71] outline-none focus:border-[#0070BB]" />
          <p v-else class="mt-0.5 break-words text-sm font-black text-[#003B71] dark:text-white">{{ aulaLocal || 'Sin aula' }}</p>
        </div>
        <button v-if="editable && campo !== 'aula'" type="button" class="btn-hint-pulse flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#003B71] hover:bg-sky-50" aria-label="Editar aula" @click="abrir('aula')">
          <VIcon class="material-symbols-outlined text-[18px]">edit</VIcon>
        </button>
        <button v-else-if="editable" type="button" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#003B71] hover:bg-sky-50 disabled:opacity-50" aria-label="Guardar aula" :disabled="guardando" @click="confirmar">
          <VIcon class="material-symbols-outlined text-[18px]">check</VIcon>
        </button>
      </div>
      <div v-if="muestraEnlace" class="flex items-center gap-2.5 rounded-lg border border-[#028191]/40 bg-[#f3f8fa] px-3 py-2 dark:border-sky-800 dark:bg-slate-900/70">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0070bb] text-white">
          <VIcon class="material-symbols-outlined text-[18px]">videocam</VIcon>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Enlace virtual</p>
          <input v-if="campo === 'enlace'" v-model="enlaceLocal" type="url" maxlength="500" placeholder="https://" class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-[#0070BB] outline-none focus:border-[#0070BB]" />
          <a v-else-if="enlaceLocal" :href="enlaceLocal" target="_blank" rel="noopener noreferrer" class="mt-0.5 inline-flex max-w-full items-center break-all text-xs font-bold text-[#0070bb] underline-offset-2 hover:underline dark:text-sky-300">{{ enlaceLocal }}</a>
          <p v-else class="mt-0.5 text-sm font-black text-[#003B71] dark:text-white">Sin enlace</p>
        </div>
        <button v-if="editable && campo !== 'enlace'" type="button" class="btn-hint-pulse flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#003B71] hover:bg-sky-50" aria-label="Editar enlace" @click="abrir('enlace')">
          <VIcon class="material-symbols-outlined text-[18px]">edit</VIcon>
        </button>
        <button v-else-if="editable" type="button" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#003B71] hover:bg-sky-50 disabled:opacity-50" aria-label="Guardar enlace" :disabled="guardando" @click="confirmar">
          <VIcon class="material-symbols-outlined text-[18px]">check</VIcon>
        </button>
      </div>
      <div v-if="editable" class="rounded-lg border border-[#028191]/40 bg-[#f3f8fa] px-3 py-2 dark:border-sky-800 dark:bg-slate-900/70" :class="campo === 'horario' ? 'lg:col-span-3' : ''">
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1A4756] text-white">
            <VIcon class="material-symbols-outlined text-[18px]">schedule</VIcon>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Horario</p>
            <p v-if="campo !== 'horario'" class="mt-0.5 line-clamp-2 text-xs font-bold text-[#003B71] dark:text-white">{{ horarioTexto }}</p>
          </div>
          <button v-if="campo !== 'horario'" type="button" class="btn-hint-pulse flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#003B71] hover:bg-sky-50" aria-label="Editar horario" @click="abrir('horario')">
            <VIcon class="material-symbols-outlined text-[18px]">edit</VIcon>
          </button>
          <button v-else type="button" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#003B71] hover:bg-sky-50 disabled:opacity-50" aria-label="Guardar horario" :disabled="guardando" @click="confirmar">
            <VIcon class="material-symbols-outlined text-[18px]">check</VIcon>
          </button>
        </div>
        <div v-if="campo === 'horario'" class="mt-3 space-y-2">
          <div v-for="(sesion, indice) in sesionesLocal" :key="indice" class="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
            <select v-model="sesion.dia" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
              <option v-for="dia in diasSemana" :key="dia" :value="dia">{{ dia }}</option>
            </select>
            <input v-model="sesion.hora_inicio" type="time" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            <input v-model="sesion.hora_fin" type="time" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            <button type="button" class="px-2 text-xs font-bold uppercase text-rose-700" @click="sesionesLocal.splice(indice, 1)">Quitar</button>
          </div>
          <button type="button" class="text-sm font-bold text-[#0070BB]" @click="sesionesLocal.push({ dia: 'Lunes', hora_inicio: '19:00', hora_fin: '21:00' })">+ Agregar sesión</button>
        </div>
      </div>
    </div>
  </section>
</template>
