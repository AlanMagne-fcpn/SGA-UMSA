<script setup lang="ts">
import { computed, watch } from 'vue';
import { aulaInicial, esPresencial, esquemaInicial, modoEvaluacion, modoPorTipo, permisosContenido, sumaEsquema, type ContentType, type TipoItem } from '@/utils/activityLearning';

const requisitos = defineModel<any>({ required: true });
const props = defineProps<{ activityType: string; modalidad?: string; busy?: boolean }>();
const modo = computed(() => modoEvaluacion(props.activityType, requisitos.value));
const permisos = computed(() => permisosContenido(props.activityType, requisitos.value));
const presencial = computed(() => modo.value === 'curso' && esPresencial(props.modalidad));
const esquema = computed(() => requisitos.value?.evaluacion);
const suma = computed(() => esquema.value ? sumaEsquema(esquema.value) : 0);
const opciones = computed(() => [
  { tipo: 'video', nombre: 'Permitir videos', descripcion: 'El ponente puede subir clases grabadas.' },
  { tipo: 'material', nombre: 'Permitir archivos de estudio', descripcion: 'El ponente puede adjuntar guías, lecturas y presentaciones.' },
  ...(modo.value === 'curso' ? [
    { tipo: 'practica', nombre: 'Permitir prácticas', descripcion: 'El ponente puede crear trabajos entregables y calificarlos.' },
    { tipo: 'examen', nombre: 'Permitir cuestionarios y exámenes', descripcion: 'El ponente puede crear evaluaciones y preguntas para los videos.' },
  ] : []),
]);
const bloquesOtro = [
  { tipo: 'secciones', nombre: 'Secciones con nota' },
  { tipo: 'practica', nombre: 'Prácticas' },
  { tipo: 'laboratorio', nombre: 'Laboratorios' },
  { tipo: 'examen', nombre: 'Exámenes con tiempo límite' },
];
const tiposItem: { tipo: TipoItem; nombre: string }[] = [
  { tipo: 'seccion', nombre: 'Sección' },
  { tipo: 'practica', nombre: 'Práctica' },
  { tipo: 'laboratorio', nombre: 'Laboratorio' },
  { tipo: 'examen', nombre: 'Examen' },
];

watch(() => props.activityType, () => {
  const siguiente = modoPorTipo(props.activityType);
  if (requisitos.value?.evaluacion?.modo === siguiente) return;
  requisitos.value = { ...requisitos.value, evaluacion: esquemaInicial(siguiente), aula: aulaInicial(siguiente) };
}, { immediate: true });

function cambiar(tipo: string, checked: boolean) {
  const actuales = permisos.value;
  const aula = {
    video: tipo === 'video' ? checked : actuales.video,
    material: tipo === 'material' ? checked : actuales.material,
    practica: tipo === 'practica' ? checked : actuales.practica,
    examen: tipo === 'examen' ? checked : actuales.examen,
  };
  const bloques = { ...(requisitos.value?.evaluacion?.bloques || {}) };
  if (tipo === 'video' || tipo === 'material') bloques.contenido = aula.video || aula.material;
  if (tipo === 'practica') bloques.practica = checked;
  if (tipo === 'examen') bloques.examen = checked;
  requisitos.value = { ...requisitos.value, aula, evaluacion: { ...requisitos.value.evaluacion, bloques } };
}

function cambiarBloque(tipo: string, checked: boolean) {
  const bloques = { ...esquema.value.bloques, [tipo]: checked };
  const items = (esquema.value.items || []).filter((item: any) => {
    const bloque = item.tipo === 'seccion' ? 'secciones' : item.tipo;
    return bloque === 'contenido' || bloques[bloque];
  });
  const aula = {
    ...(requisitos.value.aula || {}),
    practica: bloques.practica === true,
    examen: bloques.examen === true || bloques.secciones === true,
  };
  requisitos.value = { ...requisitos.value, aula, evaluacion: { ...esquema.value, bloques, items } };
}

function agregarItem() {
  const habilitado = tiposItem.find(item => {
    const bloque = item.tipo === 'seccion' ? 'secciones' : item.tipo;
    return esquema.value.bloques[bloque];
  });
  if (!habilitado) return;
  requisitos.value = {
    ...requisitos.value,
    evaluacion: { ...esquema.value, items: [...esquema.value.items, { tipo: habilitado.tipo, nombre: '', puntaje: 10, plazo: '' }] },
  };
}

function numero(index: unknown) {
  return Number(index) + 1;
}

function quitarItem(index: number) {
  const items = esquema.value.items.filter((_: any, i: number) => i !== index);
  requisitos.value = { ...requisitos.value, evaluacion: { ...esquema.value, items } };
}
</script>

<template>
  <section aria-label="Permisos de contenido del ponente" class="rounded-2xl border border-sky-300 bg-sky-50 p-5 text-slate-900 dark:border-sky-800 dark:bg-slate-800 dark:text-white">
    <h3 class="text-lg font-bold">Permisos de contenido del ponente</h3>
    <p v-if="modo === 'asistencia'" class="mt-2 text-sm font-bold">La nota de esta actividad es solo la asistencia (100 puntos). Se puede subir video y archivos. Una sesión vale todo o nada; varias sesiones se reparten según el porcentaje marcado.</p>
    <p v-else class="mt-2 text-sm">Elige qué podrá preparar el ponente y cómo se reparte la nota. La asistencia es obligatoria y los puntajes deben sumar 100.</p>
    <p v-if="presencial" class="mt-3 text-sm">En modalidad presencial se publican el lugar y los materiales. El aula de lecciones, con exámenes y prácticas, se usa cuando la modalidad es virtual o híbrida.</p>
    <div v-if="modo === 'configurable'" class="mt-4 grid gap-3 sm:grid-cols-2">
      <label v-for="item in bloquesOtro" :key="item.tipo" class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
        <input type="checkbox" :aria-label="item.nombre" :checked="esquema?.bloques?.[item.tipo] === true" :disabled="busy" class="mt-1 h-5 w-5 shrink-0 accent-[#0070bb]" @change="cambiarBloque(item.tipo, ($event.target as HTMLInputElement).checked)">
        <span><strong class="block">{{ item.nombre }}</strong></span>
      </label>
    </div>
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <label v-for="item in opciones" :key="item.tipo" class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
        <input type="checkbox" :aria-label="item.nombre" :checked="permisos[item.tipo as ContentType]" :disabled="busy" class="mt-1 h-5 w-5 shrink-0 accent-[#0070bb]" @change="cambiar(item.tipo, ($event.target as HTMLInputElement).checked)">
        <span><strong class="block">{{ item.nombre }}</strong><span class="mt-2 block text-sm text-slate-600 dark:text-slate-300">{{ item.descripcion }}</span></span>
      </label>
    </div>
    <div v-if="modo !== 'asistencia' && esquema" class="mt-5 space-y-3">
      <label class="block text-sm font-bold">Puntaje de asistencia
        <input :value="esquema.asistencia" type="number" min="1" max="100" step="0.01" aria-label="Puntaje de asistencia" class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900" :disabled="busy" @input="requisitos = { ...requisitos, evaluacion: { ...esquema, asistencia: Number(($event.target as HTMLInputElement).value) } }">
      </label>
      <div v-for="(item, index) in esquema.items" :key="index" class="grid gap-2 rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900 sm:grid-cols-4">
        <label class="text-sm font-bold">Tipo<select :aria-label="`Tipo del ítem ${numero(index)}`" :value="item.tipo" class="mt-1 w-full" @change="item.tipo = ($event.target as HTMLSelectElement).value"><option v-for="opcion in tiposItem" :key="opcion.tipo" :value="opcion.tipo">{{ opcion.nombre }}</option></select></label>
        <label class="text-sm font-bold">Nombre<input :aria-label="`Nombre del ítem ${numero(index)}`" v-model="item.nombre" class="mt-1 w-full"></label>
        <label class="text-sm font-bold">Puntaje<input :aria-label="`Puntaje del ítem ${numero(index)}`" v-model.number="item.puntaje" type="number" min="1" max="100" step="0.01" class="mt-1 w-full"></label>
        <label class="text-sm font-bold">Plazo<input :aria-label="`Plazo del ítem ${numero(index)}`" v-model="item.plazo" type="date" class="mt-1 w-full"></label>
        <button type="button" class="text-sm font-bold text-red-700 dark:text-red-300" @click="quitarItem(Number(index))">Quitar ítem</button>
      </div>
      <button type="button" class="font-bold text-[#0070bb]" :disabled="busy" @click="agregarItem">Agregar ítem de calificación</button>
      <p class="text-sm" :class="suma === 100 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'">Suma actual: {{ suma }} puntos. Los puntajes, incluida la asistencia, deben sumar 100.</p>
    </div>
  </section>
</template>
