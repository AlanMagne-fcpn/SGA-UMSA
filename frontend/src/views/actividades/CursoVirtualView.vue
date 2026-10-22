<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { resolveMediaUrl } from '@/services/api';
import { esCurso, type ContentType } from '@/utils/activityLearning';

type Pregunta = { enunciado: string; opciones: string[]; correcta?: number };
type Recurso = { nombre: string; url: string };
type Leccion = { id: number; tipo: 'video' | 'examen' | 'material' | 'practica'; titulo: string; descripcion: string; orden: number; video_url: string | null; preguntas: Pregunta[]; recursos?: Recurso[]; peso?: number; publicado?: boolean; completado_en?: string | null; nota?: number | null; entrega?: { texto: string; archivo?: { nombre: string } }; retroalimentacion?: string };
const props = defineProps<{ activityId?: number; embedded?: boolean; initialType?: Leccion['tipo'] }>();
const route = useRoute();
const router = useRouter();
const id = computed(() => props.activityId || Number(route.params.id));
const tipoInicial = (): Leccion['tipo'] => props.initialType || (['video', 'material', 'practica', 'examen'].includes(String(route.query.tipo)) ? route.query.tipo as Leccion['tipo'] : 'video');
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
const formulario = ref({ id: 0, tipo: tipoInicial(), titulo: '', descripcion: '', orden: 0, video_url: '', publicado: false, preguntas: [] as Pregunta[], recursos: [] as Recurso[], peso: 1 });
const archivosRecursos = ref<File[]>([]);
const archivoPractica = ref<File | null>(null);
const textoEntrega = ref('');
const entregas = ref<any[]>([]);
const resumen = ref<any>(null);
const tipos = { video: 'Video y cuestionario', examen: 'Cuestionario / examen', material: 'Material de estudio', practica: 'Práctica entregable' };
const permisos = ref<Record<ContentType, boolean>>({ video: false, material: false, practica: false, examen: false });
const tipoActividad = ref('');
const tiposDisponibles = computed(() => Object.fromEntries(Object.entries(tipos).filter(([tipo]) => permisos.value[tipo as ContentType]).map(([tipo, nombre]) => [tipo, tipo === 'video' && !permisos.value.examen ? 'Video' : nombre])));
const puedeCrear = computed(() => Object.keys(tiposDisponibles.value).length > 0);
const esEvaluacion = (leccion: { tipo: string; preguntas: Pregunta[] }) => leccion.tipo === 'practica' || !!leccion.preguntas.length;
const pesoTotal = computed(() => lecciones.value.filter(l => l.publicado && esEvaluacion(l)).reduce((sum, l) => sum + Number(l.peso ?? 1), 0));
const porcentaje = (l: Leccion) => l.publicado && esEvaluacion(l) && pesoTotal.value ? Math.round(Number(l.peso ?? 1) * 10000 / pesoTotal.value) / 100 : 0;
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
      permisos.value = config.permisos || { video: false, material: false, practica: false, examen: false };
      if (!esCurso(tipoActividad.value)) { permisos.value.practica = false; permisos.value.examen = false; }
      if (!permisos.value[formulario.value.tipo]) formulario.value.tipo = (Object.keys(tiposDisponibles.value)[0] || 'material') as ContentType;
      entregas.value = esCurso(tipoActividad.value) ? (await api.get(`/actividades-academicas/${id.value}/entregas`)).data : [];
    }
    else resumen.value = (await api.get(`/actividades-academicas/${id.value}/aula/resumen`)).data;
  } catch (e: any) {
    error.value = e.response?.data?.message || 'No se pudo cargar el aula del curso.';
  } finally {
    cargando.value = false;
  }
}
watch(id, cargar, { immediate: true });

function elegir(leccion: Leccion) {
  seleccionada.value = leccion;
  videoTerminado.value = !!leccion.completado_en;
  respuestas.value = Array(leccion.preguntas?.length || 0).fill(-1);
  aviso.value = '';
  textoEntrega.value = leccion.entrega?.texto || '';
  archivoPractica.value = null;
}

function nueva() {
  const tipo = permisos.value[tipoInicial()] ? tipoInicial() : (Object.keys(tiposDisponibles.value)[0] || 'material') as ContentType;
  formulario.value = { id: 0, tipo, titulo: '', descripcion: '', orden: lecciones.value.length + 1, video_url: '', publicado: false, preguntas: [], recursos: [], peso: 1 };
  archivo.value = null;
  archivosRecursos.value = [];
}

function editar(leccion: Leccion) {
  formulario.value = { id: leccion.id, tipo: leccion.tipo, titulo: leccion.titulo, descripcion: leccion.descripcion || '', orden: leccion.orden, video_url: leccion.video_url || '', publicado: !!leccion.publicado, preguntas: JSON.parse(JSON.stringify(leccion.preguntas || [])), recursos: JSON.parse(JSON.stringify(leccion.recursos || [])), peso: Number(leccion.peso ?? 1) };
  archivo.value = null;
  archivosRecursos.value = [];
}

function agregarPregunta() {
  formulario.value.preguntas.push({ enunciado: '', opciones: ['', ''], correcta: 0 });
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
    if (body.tipo === 'material' || body.tipo === 'practica') body.preguntas = [];
    if (leccionId) await api.put(`/actividades-academicas/${id.value}/lecciones/${leccionId}`, body);
    else await api.post(`/actividades-academicas/${id.value}/lecciones`, body);
    await cargar();
    nueva();
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
  <div class="aula mx-auto max-w-7xl space-y-6 pb-16 text-slate-900 dark:text-white">
    <button v-if="!embedded" type="button" class="font-bold text-blue-700 dark:text-sky-300" @click="router.push(volver)">← Volver a la actividad</button>
    <header v-if="!embedded" class="rounded-2xl bg-[#062548] p-6 text-white sm:p-8">
      <p class="text-xs font-bold uppercase tracking-widest text-sky-300">{{ editor ? 'Contenidos y evaluaciones' : 'Mi aprendizaje' }}</p>
      <h1 class="mt-2 text-3xl font-black">Aula de la actividad</h1>
      <p class="mt-3 text-sm text-slate-200">{{ editor ? (esCurso(tipoActividad) ? 'Publica videos, archivos, cuestionarios, exámenes y prácticas entregables.' : 'Publica los videos y archivos habilitados por la organización.') : `${completadas} de ${lecciones.length} contenidos completados` }}</p>
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
    <div v-if="!cargando" class="grid gap-6" :class="embedded ? '' : 'lg:grid-cols-[280px_minmax(0,1fr)]'">
      <aside class="self-start rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" :class="embedded ? 'max-h-48 overflow-y-auto' : ''">
        <div class="flex items-center justify-between gap-2"><h2 class="font-bold">Contenido</h2><button v-if="editor && puedeCrear" type="button" class="font-bold text-blue-700 dark:text-sky-300" @click="nueva">+ Nuevo</button></div>
        <p v-if="!lecciones.length" class="mt-4 text-sm text-slate-500">{{ editor ? 'Añade el primer contenido de la actividad.' : 'Aún no hay contenidos publicados.' }}</p>
        <button v-for="leccion in lecciones" :key="leccion.id" type="button" class="mt-2 w-full rounded-xl p-3 text-left text-sm hover:bg-sky-50 dark:hover:bg-slate-800" :class="seleccionada?.id === leccion.id ? 'bg-sky-50 dark:bg-slate-800' : ''" @click="elegir(leccion)">
          <strong class="block break-words">{{ leccion.completado_en ? '✓ ' : '' }}{{ leccion.titulo }}</strong>
          <span class="mt-1 block text-xs text-slate-600 dark:text-slate-300">{{ tipos[leccion.tipo] }} · {{ porcentaje(leccion) }}% de la nota<span v-if="editor"> · {{ leccion.publicado ? 'Publicado' : 'Borrador' }}</span></span>
        </button>
      </aside>
      <div class="min-w-0 space-y-6">
        <section v-if="seleccionada" class="overflow-hidden rounded-2xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div class="p-6">
            <p class="text-sm font-bold text-blue-700 dark:text-sky-300">{{ tipos[seleccionada.tipo] }}</p>
            <h2 class="mt-2 text-2xl font-bold">{{ seleccionada.titulo }}</h2>
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
              <p class="text-sm text-slate-600 dark:text-slate-300">Puedes volver a responder; se conserva la mejor nota.</p>
            </div>
            <form v-if="seleccionada.tipo === 'practica'" class="space-y-4 p-6" @submit.prevent="entregar">
              <h3 class="font-bold">Mi entrega</h3>
              <p v-if="seleccionada.entrega" class="text-sm">{{ seleccionada.nota == null ? 'Entrega enviada. Pendiente de calificación.' : `Calificación: ${seleccionada.nota}/100` }}</p>
              <p v-if="seleccionada.entrega?.archivo" class="text-sm">Archivo enviado: {{ seleccionada.entrega.archivo.nombre }}</p>
              <p v-if="seleccionada.retroalimentacion" class="whitespace-pre-line rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">Devolución del docente: {{ seleccionada.retroalimentacion }}</p>
              <template v-if="seleccionada.nota == null">
                <label class="block text-sm font-bold">Respuesta o comentario<textarea v-model="textoEntrega" rows="4" maxlength="10000" /></label>
                <label class="block text-sm font-bold">Adjuntar trabajo (máximo 25 MB)<input :key="seleccionada.id" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.png,.jpg,.jpeg,.webp" @change="archivoPractica = ($event.target as HTMLInputElement).files?.[0] || null"></label>
                <button type="submit" :disabled="guardando || (!textoEntrega.trim() && !archivoPractica)" class="action">{{ guardando ? 'Enviando...' : 'Enviar práctica' }}</button>
              </template>
            </form>
            <div v-else class="p-6">
              <p v-if="seleccionada.completado_en" class="mb-3 text-sm text-emerald-700 dark:text-emerald-300">Completado{{ seleccionada.nota != null ? ` · Mejor nota: ${seleccionada.nota}/100` : '' }}</p>
              <button type="button" :disabled="guardando || (seleccionada.tipo === 'video' && !videoTerminado && !seleccionada.completado_en) || (!!seleccionada.preguntas.length && respuestas.some(r => r < 0))" class="action" @click="completar">{{ guardando ? 'Guardando...' : seleccionada.preguntas.length ? 'Enviar respuestas' : 'Marcar como completado' }}</button>
              <p v-if="seleccionada.tipo === 'video' && !videoTerminado && !seleccionada.completado_en" class="mt-3 text-sm">Termina el video para habilitar su cuestionario.</p>
            </div>
          </template>
          <div v-else class="flex gap-5 p-6"><button class="font-bold text-blue-700 dark:text-sky-300" type="button" @click="editar(seleccionada)">Editar contenido</button><button class="font-bold text-red-700 dark:text-red-300" type="button" @click="eliminar(seleccionada)">Eliminar contenido</button></div>
        </section>
        <section v-if="editor && puedeCrear" class="rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 class="text-xl font-bold">{{ formulario.id ? 'Editar contenido' : 'Nuevo contenido' }}</h2>
          <form class="mt-5 space-y-5" @submit.prevent="guardar">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm font-bold">Tipo de contenido<select aria-label="Tipo de contenido" v-model="formulario.tipo"><option v-for="(nombre, tipo) in tiposDisponibles" :key="tipo" :value="tipo">{{ nombre }}</option></select></label>
              <label class="block text-sm font-bold">Orden<input v-model.number="formulario.orden" type="number" min="0" required></label>
            </div>
            <label class="block text-sm font-bold">Título del contenido<input v-model="formulario.titulo" required maxlength="255"></label>
            <label class="block text-sm font-bold">Descripción e instrucciones<textarea v-model="formulario.descripcion" rows="3" /></label>
            <template v-if="formulario.tipo === 'video'">
              <label class="block text-sm font-bold">Subir video (máximo 500 MB)<input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" @change="archivo = ($event.target as HTMLInputElement).files?.[0] || null"></label>
              <label class="block text-sm font-bold">O enlace HTTPS directo al video<input v-model="formulario.video_url" placeholder="https://.../video.mp4"></label>
            </template>
            <label v-if="permisos.material" class="block text-sm font-bold">Archivos de estudio o instrucciones (25 MB por archivo)<input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.png,.jpg,.jpeg,.webp" @change="archivosRecursos = Array.from(($event.target as HTMLInputElement).files || [])"></label>
            <ul v-if="formulario.recursos.length" class="space-y-2 text-sm"><li v-for="(recurso, index) in formulario.recursos" :key="recurso.url" class="flex items-center justify-between gap-3"><span class="break-all">{{ recurso.nombre }}</span><button type="button" class="text-red-700 dark:text-red-300" @click="formulario.recursos.splice(index, 1)">Quitar archivo</button></li></ul>
            <div v-if="permisos.examen && (formulario.tipo === 'video' || formulario.tipo === 'examen')" class="space-y-4 border-t border-slate-300 pt-5 dark:border-slate-700">
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
            <label v-if="esCurso(tipoActividad) && esEvaluacion(formulario)" class="block text-sm font-bold">Peso de esta evaluación<input v-model.number="formulario.peso" type="number" min="0" max="100" step="0.01" required></label>
            <p v-if="esCurso(tipoActividad)" class="text-sm text-slate-600 dark:text-slate-300">Los pesos se convierten a porcentajes de la nota final: por ejemplo, 30 para prácticas y 70 para examen. Un peso de 0 excluye la evaluación de la nota. Solo cuentan los contenidos publicados.</p>
            <label class="flex items-center gap-3 text-sm font-bold"><input v-model="formulario.publicado" type="checkbox">Publicar contenido</label>
            <button type="submit" :disabled="guardando || !permisos[formulario.tipo]" class="action">{{ guardando ? 'Guardando...' : 'Guardar contenido' }}</button>
          </form>
        </section>
        <section v-if="editor && esCurso(tipoActividad) && permisos.practica" aria-label="Entregas de prácticas" class="rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 class="text-xl font-bold">Entregas y calificaciones</h2>
          <p v-if="!entregas.length" class="mt-3 text-sm text-slate-600 dark:text-slate-300">Aún no hay prácticas entregadas.</p>
          <form v-for="entrega in entregas" :key="entrega.id" class="mt-5 space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700" @submit.prevent="calificar(entrega)">
            <h3 class="font-bold">{{ entrega.estudiante || entrega.email }} · {{ entrega.titulo }}</h3>
            <p class="whitespace-pre-line text-sm">{{ entrega.entrega.texto }}</p>
            <button v-if="entrega.entrega.archivo" type="button" class="text-sm font-bold text-blue-700 dark:text-sky-300" @click="descargar(entrega)">Descargar {{ entrega.entrega.archivo.nombre }}</button>
            <label class="block text-sm font-bold">Nota (0 a 100)<input v-model.number="entrega.nota" type="number" min="0" max="100" step="0.01" required></label>
            <label class="block text-sm font-bold">Devolución al estudiante<textarea v-model="entrega.retroalimentacion" rows="2" maxlength="5000" /></label>
            <button type="submit" :disabled="guardando" class="action">Guardar calificación</button>
          </form>
        </section>
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
