<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { resolveMediaUrl } from '@/services/api';
import { esCurso, esPresencial, type ContentType } from '@/utils/activityLearning';
import FileDropzone from '@/components/ui/FileDropzone.vue';

type Pregunta = { enunciado: string; opciones: string[]; correcta?: number };
type Recurso = { nombre: string; url: string };
type Leccion = { id: number; tipo: 'video' | 'examen' | 'material' | 'practica' | 'laboratorio'; titulo: string; descripcion: string; orden: number; video_url: string | null; preguntas: Pregunta[]; recursos?: Recurso[]; peso?: number; plazo?: string | null; disponible_desde?: string | null; clave_item?: string | null; abierta?: boolean; vencida?: boolean; tiempo_limite_minutos?: number | null; publicado?: boolean; completado_en?: string | null; nota?: number | null; entrega?: { texto: string; archivo?: { nombre: string } }; retroalimentacion?: string };
const props = defineProps<{ activityId?: number; embedded?: boolean; initialType?: Leccion['tipo'] }>();
const route = useRoute();
const router = useRouter();
const id = computed(() => props.activityId || Number(route.params.id));
const tipoInicial = (): Leccion['tipo'] => {
  const pedido = props.initialType || (['material', 'practica', 'examen', 'laboratorio'].includes(String(route.query.tipo)) ? route.query.tipo as Leccion['tipo'] : 'material');
  return pedido === 'video' ? 'material' : pedido;
};
const ACCEPT_ARCHIVOS = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp';
const enlaceMaterial = ref('');
const editor = computed(() => !route.path.startsWith('/estudiante/'));
const lecciones = ref<Leccion[]>([]);
const seleccionada = ref<Leccion | null>(null);
const cargando = ref(false);
const guardando = ref(false);
const error = ref('');
const aviso = ref('');
const videoTerminado = ref(false);
const respuestas = ref<number[]>([]);
const archivo = ref<File | null>(null);
const formulario = ref({ id: 0, tipo: tipoInicial(), titulo: '', descripcion: '', orden: 0, video_url: '', publicado: false, preguntas: [] as Pregunta[], recursos: [] as Recurso[], peso: 1, plazo: '', disponible_desde: '', clave_item: '', tiempo_limite_minutos: null as number | null });
const yaUbicoSeccion = ref(false);
const formularioAbierto = ref(false);
const seccionDestacada = ref('');
const ORDEN_SECCIONES = [
  { clave: 'material', titulo: 'Material', detalle: 'Archivos y enlaces, en el orden de la clase.', tipos: ['material', 'video'], tipoNuevo: 'material' as const },
  { clave: 'practicas', titulo: 'Prácticas', detalle: 'Tareas con enunciado y entrega.', tipos: ['practica', 'laboratorio'], tipoNuevo: 'practica' as const },
  { clave: 'parciales', titulo: 'Parciales y exámenes', detalle: 'Cuestionarios del esquema de notas.', tipos: ['examen'], tipoNuevo: 'examen' as const },
];
const rubros = computed(() => Array.isArray(evaluacion.value?.items) ? evaluacion.value.items : []);
const rubrosPractica = computed(() => rubros.value.filter((item: any) => item.tipo === 'practica' || item.tipo === 'laboratorio'));
const rubrosExamen = computed(() => rubros.value.filter((item: any) => item.tipo === 'examen' || item.tipo === 'seccion'));
const archivosRecursos = ref<File[]>([]);
const archivoPractica = ref<File | null>(null);
const textoEntrega = ref('');
const entregas = ref<any[]>([]);
const resumen = ref<any>(null);
const tipos = { material: 'Archivos y enlaces', practica: 'Práctica entregable', examen: 'Cuestionario / examen', laboratorio: 'Laboratorio', video: 'Video (deshabilitado)' };
const permisos = ref<Record<ContentType, boolean>>({ video: false, material: false, practica: false, examen: false, laboratorio: false });
const tipoActividad = ref('');
const modalidadActividad = ref('');
const evaluacion = ref<any>(null);
const evaluable = computed(() => evaluacion.value?.modo === 'curso' || evaluacion.value?.modo === 'configurable' || (!evaluacion.value && esCurso(tipoActividad.value)));
const segundos = ref(0);
let reloj: ReturnType<typeof setInterval> | undefined;
const tiposDisponibles = computed(() => Object.fromEntries(Object.entries(tipos).filter(([tipo]) => tipo !== 'video' && permisos.value[tipo as ContentType] === true)));
const tiposDelBloque = computed(() => {
  const bloque = ORDEN_SECCIONES.find((item) => item.clave === seccionDestacada.value);
  const propios = Object.fromEntries(Object.entries(tiposDisponibles.value).filter(([tipo]) => bloque?.tipos.includes(tipo)));
  return Object.keys(propios).length ? propios : tiposDisponibles.value;
});
const puedeCrear = computed(() => Object.keys(tiposDisponibles.value).length > 0);
const esEntrega = (tipo: string) => tipo === 'practica' || tipo === 'laboratorio';
const esEvaluacion = (leccion: { tipo: string; preguntas: Pregunta[] }) => esEntrega(leccion.tipo) || !!leccion.preguntas.length;
function detenerReloj() { if (reloj) clearInterval(reloj); reloj = undefined; }
function iniciarReloj(leccion: Leccion | null) {
  detenerReloj();
  const minutos = Number(leccion?.tiempo_limite_minutos || 0);
  if (editor.value || !leccion || leccion.tipo !== 'examen' || !minutos || leccion.completado_en) { segundos.value = 0; return; }
  segundos.value = minutos * 60;
  reloj = setInterval(() => {
    segundos.value = Math.max(0, segundos.value - 1);
    if (segundos.value === 0) { detenerReloj(); if (!respuestas.value.some(r => r < 0)) completar(); }
  }, 1000);
}
onUnmounted(detenerReloj);
const pesoTotal = computed(() => lecciones.value.filter(l => l.publicado && esEvaluacion(l)).reduce((sum, l) => sum + Number(l.peso ?? 1), 0));
const porcentaje = (l: Leccion) => {
  if (evaluacion.value && l.peso != null) return Number(l.peso || 0);
  return l.publicado && esEvaluacion(l) && pesoTotal.value ? Math.round(Number(l.peso ?? 1) * 10000 / pesoTotal.value) / 100 : 0;
};
function claveDeTipo(tipo: string) {
  return ORDEN_SECCIONES.find((bloque) => (bloque.tipos as readonly string[]).includes(tipo))?.clave || 'material';
}
const seccionesAula = computed(() => ORDEN_SECCIONES.map((bloque) => {
  const items = lecciones.value
    .filter((leccion) => (bloque.tipos as readonly string[]).includes(leccion.tipo))
    .slice()
    .sort((a, b) => a.orden - b.orden || a.id - b.id);
  const puedeCrear = editor.value && bloque.tipos.some((tipo) => tipo !== 'video' && permisos.value[tipo as ContentType] === true);
  return { ...bloque, items, puedeCrear };
}).filter((bloque) => (editor.value ? bloque.puedeCrear || bloque.items.length > 0 : bloque.items.length > 0)));
const resumenPonderacion = computed(() => {
  if (!evaluacion.value) return null;
  const items = Array.isArray(evaluacion.value.items) ? evaluacion.value.items : [];
  return {
    asistencia: Number(evaluacion.value.asistencia || 0),
    parciales: items.filter((i: any) => i.tipo === 'examen' || i.tipo === 'seccion').reduce((a: number, i: any) => a + Number(i.puntaje || 0), 0),
    practicas: items.filter((i: any) => i.tipo === 'practica' || i.tipo === 'laboratorio').reduce((a: number, i: any) => a + Number(i.puntaje || 0), 0),
  };
});
const completadas = computed(() => lecciones.value.filter(item => !!item.completado_en).length);
const cursoCompletado = computed(() => lecciones.value.length > 0 && completadas.value === lecciones.value.length);
const valoracion = ref(5);
const comentario = ref('');
const volver = computed(() => !editor.value ? `/estudiante/actividades/${id.value}` : route.path.startsWith('/ponente') ? `/ponente/curso/${id.value}` : `/${route.path.startsWith('/admin') ? 'admin' : 'coordinador'}/gestion-eventos/${id.value}`);

async function cargar() {
  cargando.value = true;
  error.value = '';
  try {
    const res = await api.get(`/actividades-academicas/${id.value}/${editor.value ? 'lecciones/editor' : 'aula'}`);
    lecciones.value = Array.isArray(res.data) ? res.data : [];
    seleccionada.value = lecciones.value.find(item => item.id === seleccionada.value?.id) || (props.embedded ? null : lecciones.value[0]) || null;
    videoTerminado.value = !!seleccionada.value?.completado_en;
    respuestas.value = Array(seleccionada.value?.preguntas?.length || 0).fill(-1);
    textoEntrega.value = seleccionada.value?.entrega?.texto || '';
    if (editor.value) {
      const config = (await api.get(`/actividades-academicas/${id.value}/aula/configuracion`)).data;
      tipoActividad.value = config.tipo_actividad || '';
      modalidadActividad.value = config.modalidad || '';
      evaluacion.value = config.evaluacion || null;
      permisos.value = { video: false, material: false, practica: false, examen: false, laboratorio: false, ...(config.permisos || {}) };
      permisos.value.video = false;
      if (!evaluable.value) { permisos.value.practica = false; permisos.value.examen = false; permisos.value.laboratorio = false; }
      if (!permisos.value[formulario.value.tipo] || formulario.value.tipo === 'video') formulario.value.tipo = (Object.keys(tiposDisponibles.value)[0] || 'material') as ContentType;
      entregas.value = evaluable.value ? (await api.get(`/actividades-academicas/${id.value}/entregas`)).data : [];
    }
    else resumen.value = (await api.get(`/actividades-academicas/${id.value}/aula/resumen`)).data;
    iniciarReloj(seleccionada.value);
    if (!yaUbicoSeccion.value) {
      const pedido = String(props.initialType || route.query.tipo || '');
      if (pedido) seccionDestacada.value = claveDeTipo(pedido);
    }
  } catch (e: any) {
    error.value = e.response?.data?.message || 'No se pudo cargar el aula del curso.';
  } finally {
    cargando.value = false;
    if (!yaUbicoSeccion.value && seccionDestacada.value) {
      const clave = seccionDestacada.value;
      await nextTick();
      document.getElementById(`seccion-${clave}`)?.scrollIntoView({ block: 'nearest' });
    }
    yaUbicoSeccion.value = true;
  }
}
watch(id, cargar, { immediate: true });
watch(() => props.initialType, (tipo) => {
  if (!tipo) return;
  seccionDestacada.value = claveDeTipo(tipo);
  formularioAbierto.value = false;
  nextTick(() => document.getElementById(`seccion-${seccionDestacada.value}`)?.scrollIntoView({ block: 'start' }));
});
watch(() => formulario.value.tipo, (tipo) => {
  if (formularioAbierto.value) seccionDestacada.value = claveDeTipo(tipo);
});

function elegir(leccion: Leccion) {
  seleccionada.value = leccion;
  videoTerminado.value = !!leccion.completado_en;
  respuestas.value = Array(leccion.preguntas?.length || 0).fill(-1);
  aviso.value = '';
  textoEntrega.value = leccion.entrega?.texto || '';
  archivoPractica.value = null;
  formularioAbierto.value = false;
  seccionDestacada.value = claveDeTipo(leccion.tipo);
  iniciarReloj(leccion);
}

function nuevaEn(bloque: { clave: string; tipoNuevo: Leccion['tipo']; items: Leccion[] }) {
  formulario.value = { id: 0, tipo: bloque.tipoNuevo, titulo: '', descripcion: '', orden: bloque.items.length + 1, video_url: '', publicado: false, preguntas: [], recursos: [], peso: 1, plazo: '', disponible_desde: '', clave_item: '', tiempo_limite_minutos: null };
  seccionDestacada.value = bloque.clave;
  formularioAbierto.value = true;
  seleccionada.value = null;
  archivo.value = null;
  archivosRecursos.value = [];
}

function alternarFormulario(bloque: { clave: string; tipoNuevo: Leccion['tipo']; items: Leccion[] }) {
  if (formularioAbierto.value && seccionDestacada.value === bloque.clave && !formulario.value.id) {
    formularioAbierto.value = false;
    return;
  }
  nuevaEn(bloque);
}

function aplicarRubro(clave: string) {
  const item = rubros.value.find((fila: any) => fila.clave === clave);
  if (!item) return;
  formulario.value.clave_item = item.clave;
  formulario.value.titulo = formulario.value.titulo || item.nombre;
  formulario.value.peso = Number(item.puntaje);
  if (item.plazo) formulario.value.plazo = String(item.plazo).slice(0, 10);
  if (item.tipo === 'practica' || item.tipo === 'laboratorio') formulario.value.tipo = item.tipo;
  if (item.tipo === 'examen' || item.tipo === 'seccion') formulario.value.tipo = 'examen';
}

function editar(leccion: Leccion) {
  formulario.value = { id: leccion.id, tipo: leccion.tipo, titulo: leccion.titulo, descripcion: leccion.descripcion || '', orden: leccion.orden, video_url: leccion.video_url || '', publicado: !!leccion.publicado, preguntas: JSON.parse(JSON.stringify(leccion.preguntas || [])), recursos: JSON.parse(JSON.stringify(leccion.recursos || [])), peso: Number(leccion.peso ?? 1), plazo: leccion.plazo ? String(leccion.plazo).slice(0, 10) : '', disponible_desde: leccion.disponible_desde ? String(leccion.disponible_desde).slice(0, 10) : '', clave_item: leccion.clave_item || '', tiempo_limite_minutos: leccion.tiempo_limite_minutos ?? null };
  archivo.value = null;
  archivosRecursos.value = [];
  seccionDestacada.value = claveDeTipo(leccion.tipo);
  formularioAbierto.value = true;
}

function agregarPregunta() {
  formulario.value.preguntas.push({ enunciado: '', opciones: ['', ''], correcta: 0 });
}

function agregarEnlace() {
  const url = enlaceMaterial.value.trim();
  if (!/^https:\/\//i.test(url)) {
    error.value = 'El enlace debe empezar con https://';
    return;
  }
  formulario.value.recursos.push({ nombre: url, url });
  enlaceMaterial.value = '';
  error.value = '';
}

async function guardar() {
  guardando.value = true;
  error.value = '';
  try {
    if (archivo.value && formulario.value.tipo === 'video') {
      if (!archivo.value.type.startsWith('video/')) throw new Error('Selecciona un archivo de video.');
      const body = new FormData();
      body.append('file', archivo.value);
      const uploaded = await api.post(`/actividades-academicas/${id.value}/videos/upload`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      formulario.value.video_url = uploaded.data.path;
      archivo.value = null;
    }
    while (archivosRecursos.value.length) {
      const file = archivosRecursos.value[0]!;
      const body = new FormData();
      body.append('file', file);
      const uploaded = await api.post(`/actividades-academicas/${id.value}/materiales/upload`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      formulario.value.recursos.push({ nombre: file.name, url: uploaded.data.path });
      archivosRecursos.value.shift();
    }
    const { id: leccionId, ...body } = formulario.value;
    const payload = {
      ...body,
      preguntas: body.tipo === 'material' || body.tipo === 'practica' || body.tipo === 'laboratorio' ? [] : body.preguntas,
      tiempo_limite_minutos: body.tipo === 'examen' ? body.tiempo_limite_minutos : null,
      plazo: body.plazo || null,
      disponible_desde: body.disponible_desde || null,
      clave_item: body.clave_item || null,
    };
    if (leccionId) await api.put(`/actividades-academicas/${id.value}/lecciones/${leccionId}`, payload);
    else await api.post(`/actividades-academicas/${id.value}/lecciones`, payload);
    formularioAbierto.value = false;
    await cargar();
    aviso.value = 'Lección guardada correctamente.';
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'No se pudo guardar la lección.';
  } finally {
    guardando.value = false;
  }
}

async function eliminar(leccion: Leccion) {
  if (!window.confirm(`¿Eliminar ${leccion.titulo}? También se borrará su progreso.`)) return;
  try {
    await api.delete(`/actividades-academicas/${id.value}/lecciones/${leccion.id}`);
    await cargar();
    aviso.value = 'Lección eliminada.';
  } catch (e: any) { error.value = e.response?.data?.message || 'No se pudo eliminar la lección.'; }
}

async function completar() {
  if (!seleccionada.value) return;
  guardando.value = true;
  error.value = '';
  try {
    const res = await api.post(`/actividades-academicas/${id.value}/lecciones/${seleccionada.value.id}/completar`, { respuestas: respuestas.value });
    aviso.value = `${res.data.mensaje}${res.data.nota != null ? ` Resultado: ${res.data.nota}/100.` : ''}${res.data.certificado ? ` Certificado: ${res.data.certificado}.` : ''}`;
    await cargar();
  } catch (e: any) { error.value = e.response?.data?.message || 'No se pudo guardar el progreso.'; }
  finally { guardando.value = false; }
}

async function enviarValoracion() {
  guardando.value = true;
  error.value = '';
  try {
    await api.post(`/actividades-academicas/${id.value}/valoraciones`, { puntuacion: valoracion.value, comentario: comentario.value });
    aviso.value = 'Gracias por valorar el curso.';
  } catch (e: any) { error.value = e.response?.data?.message || 'No se pudo guardar tu valoración.'; }
  finally { guardando.value = false; }
}

async function entregar() {
  if (!seleccionada.value) return;
  guardando.value = true;
  error.value = '';
  try {
    const body = new FormData();
    body.append('texto', textoEntrega.value);
    if (archivoPractica.value) body.append('file', archivoPractica.value);
    const res = await api.post(`/actividades-academicas/${id.value}/lecciones/${seleccionada.value.id}/entrega`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
    await cargar();
    aviso.value = res.data.mensaje;
    archivoPractica.value = null;
  } catch (e: any) { error.value = e.response?.data?.message || 'No se pudo enviar la práctica.'; }
  finally { guardando.value = false; }
}

function entregasDe(leccionId: number) {
  return entregas.value.filter((entrega) => Number(entrega.id_leccion) === leccionId);
}

async function calificar(entrega: any) {
  guardando.value = true;
  error.value = '';
  try {
    if (entrega.nota === '' || entrega.nota == null) throw new Error('Escribe una nota entre 0 y 100.');
    await api.put(`/actividades-academicas/${id.value}/entregas/${entrega.id}/nota`, { nota: Number(entrega.nota), retroalimentacion: entrega.retroalimentacion || '' });
    await cargar();
    aviso.value = 'Calificación guardada y nota final actualizada.';
  } catch (e: any) { error.value = e.response?.data?.message || e.message || 'No se pudo calificar.'; }
  finally { guardando.value = false; }
}

async function descargar(entrega: any) {
  try {
    const res = await api.get(`/actividades-academicas/${id.value}/entregas/${entrega.id}/archivo`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url; link.download = entrega.entrega.archivo.nombre; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { error.value = 'No se pudo descargar la entrega.'; }
}

function quitarOpcion(pregunta: Pregunta, index: number) {
  pregunta.opciones.splice(index, 1);
  if (pregunta.correcta === index) pregunta.correcta = 0;
  else if ((pregunta.correcta ?? 0) > index) pregunta.correcta!--;
}
</script>

<template>
  <div class="aula mx-auto w-full min-w-0 max-w-7xl space-y-5 pb-12 text-slate-900 dark:text-white sm:space-y-6 sm:pb-16">
    <button v-if="!embedded" type="button" class="font-bold text-[#028191]" @click="router.push(volver)">← Volver a la actividad</button>
    <header class="relative overflow-hidden rounded-2xl border border-[#028191]/35 text-[#012248] shadow-sm dark:border-sky-800 dark:text-white" :class="embedded ? 'min-h-[7.5rem]' : ''">
      <div class="absolute inset-0 bg-gradient-to-br from-[#d9f0f4] via-[#eef7f9] to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-950" />
      <div class="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#028191]/20 blur-2xl" />
      <div class="absolute -bottom-16 left-1/3 h-36 w-36 rounded-full bg-[#BC9C31]/25 blur-2xl" />
      <div class="relative grid gap-0" :class="!embedded && editor && resumenPonderacion ? 'lg:grid-cols-[1.4fr_0.8fr]' : ''">
        <div class="p-4 sm:p-7">
          <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#028191]">{{ editor ? 'Secciones del curso' : 'Mi aprendizaje' }}</p>
          <h1 class="mt-2 text-xl font-black leading-tight sm:text-2xl md:text-3xl">{{ embedded ? 'Contenidos del aula' : 'Secciones del curso' }}</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-[#1A4756] dark:text-slate-300">{{ editor ? 'Abre cada bloque para publicar archivos, prácticas o exámenes, y para revisar entregas.' : `${completadas} de ${lecciones.length} contenidos completados` }}</p>
          <p v-if="editor && esPresencial(modalidadActividad)" class="mt-2 text-sm font-semibold text-[#BC9C31]">Presencial: aquí publicas material y prácticas; los parciales también pueden calificarse fuera.</p>
        </div>
        <div v-if="!embedded && editor && resumenPonderacion" class="border-t border-[#028191]/20 bg-white/50 p-5 sm:border-t-0 sm:border-l sm:p-7 dark:bg-black/20">
          <p class="text-[10px] uppercase tracking-[0.2em] text-[#028191]">Ponderación</p>
          <dl class="mt-3 space-y-2 font-mono text-sm">
            <div class="flex justify-between gap-3"><dt>Asistencia</dt><dd>{{ resumenPonderacion.asistencia }}%</dd></div>
            <div class="flex justify-between gap-3"><dt>Parciales</dt><dd>{{ resumenPonderacion.parciales }}%</dd></div>
            <div class="flex justify-between gap-3"><dt>Prácticas</dt><dd>{{ resumenPonderacion.practicas }}%</dd></div>
          </dl>
        </div>
      </div>
    </header>
    <p v-if="error" role="alert" class="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{{ error }}</p>
    <p v-if="aviso" role="status" class="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">{{ aviso }}</p>
    <section v-if="!editor && resumen" aria-label="Mi calificación" class="rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h2 class="text-xl font-bold">Nota acumulada: {{ resumen.promedio == null ? 'Sin evaluaciones' : `${resumen.promedio}/100` }}</h2>
      <p class="mt-2 text-sm">Evaluaciones calificadas: {{ resumen.evaluadas }} de {{ resumen.evaluaciones }} · Avance: {{ resumen.progreso }}%</p>
      <p v-if="resumen.pendientes" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ resumen.pendientes }} práctica(s) pendiente(s) de calificación.</p>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Las evaluaciones que faltan aportan cero hasta calificarse. El certificado depende de la nota y la asistencia mínimas de la actividad. En modalidad virtual, se toma el avance del aula.</p>
    </section>
    <p v-if="cargando" role="status">Cargando aula...</p>
    <p v-if="editor && !cargando && !puedeCrear" role="status" class="rounded-xl border border-slate-300 p-4 text-sm">La organización todavía no ha habilitado contenidos para esta actividad.</p>
    <div v-if="!cargando" class="space-y-6">
      <p v-if="!seccionesAula.length" class="rounded-xl border border-slate-300 p-4 text-sm">{{ editor ? 'Añade material, una práctica o un examen en su sección.' : 'Aún no hay contenidos publicados.' }}</p>
      <ol class="space-y-4">
        <li v-for="(bloque, indice) in seccionesAula" :id="`seccion-${bloque.clave}`" :key="bloque.clave" class="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-900" :class="seccionDestacada === bloque.clave ? 'border-[#028191] ring-2 ring-[#028191]/25' : 'border-[#028191]/25'">
          <header class="flex flex-col gap-3 border-b border-[#028191]/20 bg-gradient-to-r from-[#e6f6f8] to-white px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 dark:from-slate-800 dark:to-slate-900">
            <div class="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#028191] font-mono text-sm font-bold text-white sm:h-11 sm:w-11">{{ String(indice + 1).padStart(2, '0') }}</span>
              <div class="min-w-0 flex-1">
                <h2 class="text-base font-bold text-[#012248] dark:text-white sm:text-lg">{{ bloque.titulo }}</h2>
                <p class="text-xs text-[#1A4756] dark:text-slate-300 sm:text-sm">{{ bloque.detalle }} · {{ bloque.items.length }} en orden</p>
              </div>
            </div>
            <button v-if="editor && bloque.puedeCrear" type="button" class="w-full rounded-xl bg-[#028191] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#016a78] sm:w-auto" @click="alternarFormulario(bloque)">{{ formularioAbierto && seccionDestacada === bloque.clave && !formulario.id ? 'Cerrar' : '+ Agregar' }}</button>
          </header>
          <ol v-if="bloque.items.length" class="divide-y divide-slate-100 dark:divide-slate-800">
            <li v-for="(leccion, n) in bloque.items" :key="leccion.id">
              <button type="button" class="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 sm:gap-4 sm:px-5" :class="seleccionada?.id === leccion.id ? 'bg-sky-50 dark:bg-slate-800' : ''" @click="elegir(leccion)">
                <span class="mt-0.5 w-6 shrink-0 font-mono text-sm font-bold text-[#0070BB] sm:w-8">{{ n + 1 }}</span>
                <span class="min-w-0 flex-1">
                  <strong class="block break-words">{{ leccion.completado_en ? '✓ ' : '' }}{{ leccion.titulo }}</strong>
                  <span class="mt-1 block text-xs text-slate-500">
                    {{ tipos[leccion.tipo] }}
                    <template v-if="esEvaluacion(leccion)"> · {{ porcentaje(leccion) }}%</template>
                    <template v-if="editor && esEntrega(leccion.tipo)"> · {{ entregasDe(leccion.id).length }} entregas · {{ entregasDe(leccion.id).filter((entrega) => entrega.nota == null).length }} por revisar</template>
                    <template v-else-if="editor"> · {{ leccion.publicado ? 'Publicado' : 'Borrador' }}</template>
                  </span>
                </span>
              </button>
            </li>
          </ol>
          <p v-else class="px-5 py-5 text-sm text-[#3C6893]">Esta sección todavía no tiene contenidos.</p>
          <div :id="`hueco-${bloque.clave}`"></div>
        </li>
      </ol>
      <div class="min-w-0 space-y-6">
        <Teleport v-if="seleccionada" :to="`#hueco-${claveDeTipo(seleccionada.tipo)}`">
        <section class="border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div class="p-4 sm:p-6">
            <p class="text-sm font-bold text-blue-700 dark:text-sky-300">{{ tipos[seleccionada.tipo] }}</p>
            <h2 class="mt-2 break-words text-xl font-bold sm:text-2xl">{{ seleccionada.titulo }}</h2>
            <p class="mt-3 whitespace-pre-line text-sm leading-6">{{ seleccionada.descripcion }}</p>
            <ul v-if="seleccionada.recursos?.length" class="mt-5 space-y-2" aria-label="Archivos de estudio">
              <li v-for="recurso in seleccionada.recursos" :key="recurso.url"><a :href="resolveMediaUrl(recurso.url)" target="_blank" rel="noopener" class="font-bold text-blue-700 underline dark:text-sky-300">Descargar {{ recurso.nombre }}</a></li>
            </ul>
          </div>
          <video v-if="seleccionada.tipo === 'video' && seleccionada.video_url" :key="seleccionada.id" controls class="aspect-video w-full bg-black" :src="resolveMediaUrl(seleccionada.video_url)" @ended="videoTerminado = true" />
          <template v-if="!editor">
            <div v-if="seleccionada.preguntas?.length && (seleccionada.tipo !== 'video' || videoTerminado || seleccionada.completado_en)" class="space-y-4 p-6">
              <h3 class="font-bold">Cuestionario</h3>
              <fieldset v-for="(pregunta, index) in seleccionada.preguntas" :key="index" class="rounded-xl border border-slate-300 p-4 dark:border-slate-600">
                <legend class="px-2 font-bold">{{ index + 1 }}. {{ pregunta.enunciado }}</legend>
                <label v-for="(opcion, opcionIndex) in pregunta.opciones" :key="opcionIndex" class="mt-3 flex items-center gap-3 text-sm"><input v-model="respuestas[index]" type="radio" :name="`pregunta-${index}`" :value="opcionIndex">{{ opcion }}</label>
              </fieldset>
              <p v-if="seleccionada.tipo === 'examen' && segundos" class="text-sm font-bold" role="timer">Tiempo restante: {{ Math.floor(segundos / 60) }}:{{ String(segundos % 60).padStart(2, '0') }}</p>
              <p v-if="seleccionada.tipo === 'examen' && seleccionada.tiempo_limite_minutos && segundos === 0 && !seleccionada.completado_en" class="text-sm text-red-700">El tiempo del examen terminó.</p>
              <p class="text-sm text-slate-600 dark:text-slate-300">Puedes volver a responder; se conserva la mejor nota.</p>
            </div>
            <form v-if="esEntrega(seleccionada.tipo)" class="space-y-4 p-6" @submit.prevent="entregar">
              <h3 class="font-bold">Mi entrega</h3>
              <p class="text-sm text-slate-600 dark:text-slate-300">Disponible {{ seleccionada.disponible_desde ? String(seleccionada.disponible_desde).slice(0, 10) : 'desde ya' }} · Entrega hasta {{ seleccionada.plazo ? String(seleccionada.plazo).slice(0, 10) : 'sin fecha límite' }}</p>
              <p v-if="seleccionada.abierta === false" class="text-sm font-bold text-amber-700">Esta tarea todavía no está abierta.</p>
              <p v-else-if="seleccionada.vencida" class="text-sm font-bold text-red-700">El plazo de entrega ya venció.</p>
              <p v-if="seleccionada.entrega" class="text-sm">{{ seleccionada.nota == null ? 'Entrega enviada. Pendiente de calificación.' : `Calificación: ${seleccionada.nota}/100` }}</p>
              <p v-if="seleccionada.entrega?.archivo" class="text-sm">Archivo enviado: {{ seleccionada.entrega.archivo.nombre }}</p>
              <p v-if="seleccionada.retroalimentacion" class="whitespace-pre-line rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">Devolución del docente: {{ seleccionada.retroalimentacion }}</p>
              <template v-if="seleccionada.nota == null && seleccionada.abierta !== false && !seleccionada.vencida">
                <label class="block text-sm font-bold">Respuesta o comentario<textarea v-model="textoEntrega" rows="4" maxlength="10000" /></label>
                <FileDropzone
                  :key="seleccionada.id"
                  v-model="archivoPractica"
                  :accept="ACCEPT_ARCHIVOS"
                  label="Adjuntar trabajo"
                  hint="PDF, Word, Excel, JPG, PNG"
                />
                <button type="submit" :disabled="guardando || (!textoEntrega.trim() && !archivoPractica)" class="action">{{ guardando ? 'Enviando...' : 'Enviar práctica' }}</button>
              </template>
            </form>
            <div v-else class="p-6">
              <p v-if="seleccionada.completado_en" class="mb-3 text-sm text-emerald-700 dark:text-emerald-300">Completado{{ seleccionada.nota != null ? ` · Mejor nota: ${seleccionada.nota}/100` : '' }}</p>
              <button type="button" :disabled="guardando || (seleccionada.tipo === 'video' && !videoTerminado && !seleccionada.completado_en) || (!!seleccionada.preguntas.length && respuestas.some(r => r < 0))" class="action" @click="completar">{{ guardando ? 'Guardando...' : seleccionada.preguntas.length ? 'Enviar respuestas' : 'Marcar como completado' }}</button>
              <p v-if="seleccionada.tipo === 'video' && !videoTerminado && !seleccionada.completado_en" class="mt-3 text-sm">Termina el video para habilitar su cuestionario.</p>
            </div>
          </template>
          <div v-else class="space-y-4 p-6">
            <div class="flex gap-5">
              <button class="font-bold text-blue-700 dark:text-sky-300" type="button" @click="editar(seleccionada)">Editar contenido</button>
              <button class="font-bold text-red-700 dark:text-red-300" type="button" @click="eliminar(seleccionada)">Eliminar contenido</button>
            </div>
            <div v-if="esEntrega(seleccionada.tipo)" class="border-t border-slate-200 pt-4 dark:border-slate-700">
              <h3 class="font-bold">Entregas de esta práctica</h3>
              <p class="mt-1 text-sm text-slate-500">Como en Classroom: abres la tarea y revisas solo a quienes la enviaron.</p>
              <p v-if="!entregasDe(seleccionada.id).length" class="mt-3 text-sm text-slate-500">Nadie ha entregado esta práctica.</p>
              <form v-for="entrega in entregasDe(seleccionada.id)" :key="entrega.id" class="mt-4 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700" @submit.prevent="calificar(entrega)">
                <h4 class="font-bold">{{ entrega.estudiante || entrega.email }}</h4>
                <p class="text-xs text-slate-500">Enviado: {{ entrega.completado_en ? String(entrega.completado_en).slice(0, 16).replace('T', ' ') : '—' }}<template v-if="entrega.nota != null"> · Nota {{ entrega.nota }}/100</template><template v-else> · Por revisar</template></p>
                <p class="whitespace-pre-line text-sm">{{ entrega.entrega?.texto }}</p>
                <button v-if="entrega.entrega?.archivo" type="button" class="text-sm font-bold text-blue-700 dark:text-sky-300" @click="descargar(entrega)">Descargar {{ entrega.entrega.archivo.nombre }}</button>
                <label class="block text-sm font-bold">Nota (0 a 100)<input v-model.number="entrega.nota" type="number" min="0" max="100" step="0.01" required></label>
                <label class="block text-sm font-bold">Devolución al estudiante<textarea v-model="entrega.retroalimentacion" rows="2" maxlength="5000" /></label>
                <button type="submit" :disabled="guardando" class="action">Guardar calificación</button>
              </form>
            </div>
          </div>
        </section>
        </Teleport>
        <Teleport v-if="formularioAbierto && seccionDestacada" :to="`#hueco-${seccionDestacada}`">
        <section v-if="editor && puedeCrear" class="border-t border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 class="text-xl font-bold">{{ formulario.id ? 'Editar contenido' : 'Nuevo contenido' }}</h2>
          <p v-if="esEntrega(formulario.tipo)" class="mt-2 text-sm text-slate-600 dark:text-slate-300">Tarea estilo aula: instruye, adjunta el enunciado, define apertura y cierre, y después revisa las entregas.</p>
          <form class="mt-5 space-y-5" @submit.prevent="guardar">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm font-bold">Tipo de contenido<select aria-label="Tipo de contenido" v-model="formulario.tipo"><option v-for="(nombre, tipo) in tiposDelBloque" :key="tipo" :value="tipo">{{ nombre }}</option></select></label>
              <label class="block text-sm font-bold">Orden<input v-model.number="formulario.orden" type="number" min="0" required></label>
            </div>
            <label v-if="evaluable && (esEntrega(formulario.tipo) ? rubrosPractica.length : rubrosExamen.length || rubros.length)" class="block text-sm font-bold">Rubro del esquema de notas
              <select aria-label="Rubro del esquema" :value="formulario.clave_item" @change="aplicarRubro(($event.target as HTMLSelectElement).value)">
                <option value="">Sin vincular</option>
                <option v-for="item in (esEntrega(formulario.tipo) ? rubrosPractica : rubrosExamen.length ? rubrosExamen : rubros)" :key="item.clave" :value="item.clave">{{ item.nombre }} ({{ item.puntaje }} pts)</option>
              </select>
            </label>
            <label class="block text-sm font-bold">{{ esEntrega(formulario.tipo) ? 'Nombre de la tarea' : 'Título del contenido' }}<input v-model="formulario.titulo" required maxlength="255"></label>
            <label class="block text-sm font-bold">{{ esEntrega(formulario.tipo) ? 'Enunciado e instrucciones para el estudiante' : 'Descripción e instrucciones' }}<textarea v-model="formulario.descripcion" rows="4" /></label>
            <FileDropzone
              v-if="permisos.material || esEntrega(formulario.tipo) || formulario.tipo === 'material'"
              v-model="archivosRecursos"
              multiple
              :accept="ACCEPT_ARCHIVOS"
              :label="esEntrega(formulario.tipo) ? 'Archivos del enunciado' : 'Archivos'"
              hint="PDF, Word, Excel, JPG, PNG"
            />
            <div v-if="formulario.tipo === 'material' || permisos.material" class="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label class="block text-sm font-bold">Enlace HTTPS (Drive, sitio, documento)<input v-model="enlaceMaterial" type="url" placeholder="https://..." aria-label="Enlace de material"></label>
              <button type="button" class="w-full self-end rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-600 sm:w-auto" @click="agregarEnlace">Agregar enlace</button>
            </div>
            <ul v-if="formulario.recursos.length" class="space-y-2 text-sm"><li v-for="(recurso, index) in formulario.recursos" :key="recurso.url" class="flex items-center justify-between gap-3"><span class="break-all">{{ recurso.nombre }}</span><button type="button" class="text-red-700 dark:text-red-300" @click="formulario.recursos.splice(index, 1)">Quitar</button></li></ul>
            <div v-if="permisos.examen && formulario.tipo === 'examen'" class="space-y-4 border-t border-slate-300 pt-5 dark:border-slate-700">
              <div class="flex items-center justify-between"><h3 class="font-bold">Preguntas del cuestionario</h3><button class="font-bold text-blue-700 dark:text-sky-300" type="button" @click="agregarPregunta">+ Pregunta</button></div>
              <p class="text-sm text-slate-600 dark:text-slate-300">Marca la respuesta correcta. El estudiante recibirá su nota sin ver las soluciones.</p>
              <fieldset v-for="(pregunta, index) in formulario.preguntas" :key="index" class="space-y-3 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
                <legend class="px-2 font-bold">Pregunta {{ index + 1 }}</legend>
                <label class="block text-sm">Enunciado<input v-model="pregunta.enunciado" required></label>
                <div v-for="(_, opcionIndex) in pregunta.opciones" :key="opcionIndex" class="flex items-center gap-3">
                  <input v-model="pregunta.correcta" type="radio" :name="`correcta-${index}`" :value="opcionIndex" :aria-label="`Correcta: opción ${opcionIndex + 1} de pregunta ${index + 1}`">
                  <input v-model="pregunta.opciones[opcionIndex]" required :aria-label="`Opción ${opcionIndex + 1} de pregunta ${index + 1}`" class="min-w-0 flex-1">
                  <button v-if="pregunta.opciones.length > 2" type="button" :aria-label="`Quitar opción ${opcionIndex + 1}`" @click="quitarOpcion(pregunta, opcionIndex)">×</button>
                </div>
                <div class="flex flex-wrap gap-5"><button v-if="pregunta.opciones.length < 8" type="button" class="text-sm font-bold text-blue-700 dark:text-sky-300" @click="pregunta.opciones.push('')">+ Opción</button><button type="button" class="text-sm text-red-700 dark:text-red-300" @click="formulario.preguntas.splice(index, 1)">Quitar pregunta</button></div>
              </fieldset>
            </div>
            <div v-if="evaluable && esEvaluacion(formulario)" class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm font-bold">% de la nota (rubro)<input v-model.number="formulario.peso" type="number" min="0" max="100" step="0.01" required :readonly="!!formulario.clave_item"></label>
              <label v-if="formulario.tipo === 'examen'" class="block text-sm font-bold">Tiempo límite (minutos)<input v-model.number="formulario.tiempo_limite_minutos" type="number" min="1" max="600" step="1" required aria-label="Tiempo límite del examen"></label>
              <template v-if="esEntrega(formulario.tipo)">
                <label class="block text-sm font-bold">Abre (opcional)<input v-model="formulario.disponible_desde" type="date" aria-label="Fecha de apertura"></label>
                <label class="block text-sm font-bold">Cierra (opcional)<input v-model="formulario.plazo" type="date" aria-label="Plazo de la evaluación"></label>
              </template>
            </div>
            <p v-if="evaluable && esEntrega(formulario.tipo)" class="text-sm text-slate-600 dark:text-slate-300">Práctica tipo Classroom: vincula el rubro para fijar el % de la nota. Las fechas de apertura/cierre son opcionales.</p>
            <label class="flex items-center gap-3 text-sm font-bold"><input v-model="formulario.publicado" type="checkbox">Publicar contenido</label>
            <button type="submit" :disabled="guardando || !permisos[formulario.tipo]" class="action">{{ guardando ? 'Guardando...' : 'Guardar contenido' }}</button>
          </form>
        </section>
        </Teleport>
        <section v-if="!editor && cursoCompletado" class="rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 class="text-xl font-bold">Valora esta actividad</h2>
          <form class="mt-5 space-y-4" @submit.prevent="enviarValoracion">
            <label class="block text-sm font-bold">Puntuación<select v-model.number="valoracion"><option v-for="n in 5" :key="n" :value="n">{{ n }} de 5</option></select></label>
            <label class="block text-sm font-bold">Comentario<textarea v-model="comentario" rows="3" maxlength="1000" /></label>
            <button type="submit" :disabled="guardando" class="action">Enviar valoración</button>
          </form>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aula { --field-bg:#f8fafc; --field-fg:#0f172a; --field-border:#94a3b8; }
:global(.dark .aula) { --field-bg:#1e293b; --field-fg:#f1f5f9; --field-border:#64748b; color-scheme:dark; }
.aula :is(input:not([type='checkbox']):not([type='radio']):not([type='file']),select,textarea) { display:block; width:100%; margin-top:6px; border:1px solid var(--field-border); border-radius:10px; background:var(--field-bg); color:var(--field-fg); padding:12px; font-size:14px; line-height:1.5; }
.aula input[type='file'] { display:block; max-width:100%; margin-top:10px; font-size:13px; }
.aula input:is([type='checkbox'],[type='radio']) { width:18px; height:18px; flex-shrink:0; accent-color:#0070bb; }
.aula :is(input,select,textarea,button):focus-visible { outline:2px solid #38bdf8; outline-offset:2px; }
.action { min-height:44px; border-radius:12px; padding:10px 20px; background:#0070bb; color:white; font-size:14px; font-weight:700; }
.action:disabled { opacity:.5; cursor:not-allowed; }
</style>
