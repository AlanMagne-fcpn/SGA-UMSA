<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api';
import Swal from '@/services/dialogs';
import NotasRubricaGrid from '@/components/actividades/NotasRubricaGrid.vue';

const route = useRoute();
const router = useRouter();
const actividadId = ref(String(route.params.actividadId || ''));
const loading = ref(false);
const actividadInfo = ref({ nombre: 'Cargando...', evento: '...', min_nota: 51 });

const fetchInfo = async () => {
  if (!actividadId.value) return;
  loading.value = true;
  try {
    const actRes = await api.get(`/actividades-academicas/${actividadId.value}`);
    if (Number(actRes.data.estado) === -1) {
      Swal.fire({
        icon: 'warning',
        title: 'Actividad Inhabilitada',
        text: 'No se pueden gestionar calificaciones para una actividad inhabilitada.',
        confirmButtonColor: '#003B71',
      });
      router.push({ name: 'ponente-eventos' });
      return;
    }
    actividadInfo.value.nombre = actRes.data.nombre;
    actividadInfo.value.evento = actRes.data.evento?.nombre || 'Evento';
    actividadInfo.value.min_nota = actRes.data.modalidades?.[0]?.min_nota ?? actRes.data.min_nota ?? 51;
  } catch (error: any) {
    Swal.fire('Error', error.response?.data?.message || 'No se pudo cargar la actividad.', 'error');
  } finally {
    loading.value = false;
  }
};

onMounted(fetchInfo);
</script>

<template>
  <div class="animate-in fade-in duration-500 space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <button type="button" class="btn-hint-pulse text-[11px] font-bold uppercase tracking-widest text-slate-500" @click="router.back()">
        Volver al detalle
      </button>
      <RouterLink
        v-if="actividadId"
        :to="`/ponente/curso/${actividadId}/aula?tipo=practica`"
        class="border border-[#003B71] bg-[#003B71] px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-white"
      >
        Aula · prácticas (Classroom)
      </RouterLink>
    </div>

    <header class="overflow-hidden border border-slate-300 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div class="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="border-b border-slate-200 p-8 dark:border-gray-800 lg:border-b-0 lg:border-r">
          <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#BC9C31]">{{ actividadInfo.evento }}</p>
          <h1 class="mt-3 font-serif text-4xl leading-none text-[#003B71] dark:text-white">{{ actividadInfo.nombre }}</h1>
          <p class="mt-4 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Aquí ves los porcentajes asignados, puedes corregirlos y cargar notas por rubro.
            Las prácticas con enunciado y entrega se publican en el aula, organizadas por sección.
          </p>
        </div>
        <div class="bg-[#003B71] p-8 text-white">
          <p class="text-[10px] uppercase tracking-[0.24em] text-[#BC9C31]">Umbral</p>
          <p class="mt-3 font-serif text-5xl leading-none">{{ actividadInfo.min_nota }}</p>
          <p class="mt-2 text-sm text-white/70">Nota mínima de aprobación</p>
        </div>
      </div>
    </header>

    <div v-if="loading" class="p-16 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Cargando...</div>
    <NotasRubricaGrid v-else-if="actividadId" :actividad-id="actividadId" />
  </div>
</template>
