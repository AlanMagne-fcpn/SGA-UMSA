<script setup lang="ts">
import { computed } from 'vue';
import { esCurso, permisosContenido, type ContentType } from '@/utils/activityLearning';

const requisitos = defineModel<any>({ required: true });
const props = defineProps<{ activityType: string; busy?: boolean }>();
const permisos = computed(() => permisosContenido(props.activityType, requisitos.value));
const opciones = computed(() => [
  { tipo: 'video', nombre: 'Permitir videos', descripcion: 'El ponente puede subir clases grabadas.' },
  { tipo: 'material', nombre: 'Permitir archivos de estudio', descripcion: 'El ponente puede adjuntar guías, lecturas y presentaciones.' },
  ...(esCurso(props.activityType) ? [
    { tipo: 'practica', nombre: 'Permitir prácticas', descripcion: 'El ponente puede crear trabajos entregables y calificarlos.' },
    { tipo: 'examen', nombre: 'Permitir cuestionarios y exámenes', descripcion: 'El ponente puede crear evaluaciones y preguntas para los videos.' },
  ] : []),
]);
function cambiar(tipo: string, checked: boolean) {
  requisitos.value = { ...requisitos.value, aula: { ...permisos.value, [tipo]: checked } };
}
</script>

<template>
  <section aria-label="Permisos de contenido del ponente" class="rounded-2xl border border-sky-300 bg-sky-50 p-5 text-slate-900 dark:border-sky-800 dark:bg-slate-800 dark:text-white">
    <h3 class="text-lg font-bold">Permisos de contenido del ponente</h3>
    <p class="mt-2 text-sm">Elige qué podrá preparar el ponente desde su panel. Estos permisos se aplican al guardar la actividad.</p>
    <p v-if="!esCurso(activityType)" class="mt-3 text-sm font-bold">Las prácticas, los cuestionarios y los exámenes solo están disponibles en actividades de tipo Curso.</p>
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <label v-for="item in opciones" :key="item.tipo" class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
        <input type="checkbox" :aria-label="item.nombre" :checked="permisos[item.tipo as ContentType]" :disabled="busy" class="mt-1 h-5 w-5 shrink-0 accent-[#0070bb]" @change="cambiar(item.tipo, ($event.target as HTMLInputElement).checked)">
        <span><strong class="block">{{ item.nombre }}</strong><span class="mt-2 block text-sm text-slate-600 dark:text-slate-300">{{ item.descripcion }}</span></span>
      </label>
    </div>
  </section>
</template>
