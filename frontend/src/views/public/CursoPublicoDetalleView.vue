<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import api, { getImageUrl, imagenActividad } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useEventoStore } from '@/stores/eventoStore';

type Modalidad = { id: number; tipo: string; min_nota: number | null; min_asistencia: number | null };
type CursoPublico = {
  id: number; nombre: string; descripcion: string | null; tipo: string | null; imagen: string | null;
  fecha_inicio: string | null; fecha_fin: string | null; horas: number | null; cupo: number | null;
  inscritos: number; estado: number; modalidades: Modalidad[];
  contenido: { id: number; tipo: 'video' | 'examen'; titulo: string; descripcion: string | null; orden: number }[];
  valoracion: { promedio: number | null; cantidad: number };
  requisitos: string[];
  objetivos: string[]; publico_objetivo: string;
  docentes: { id: number; nombre: string }[];
  evento: { id: number; nombre: string; gestion: string | null; estado: number; imagen_fondo: string | null } | null;
};

const route = useRoute();
const auth = useAuthStore();
const eventoStore = useEventoStore();
const curso = ref<CursoPublico | null>(null);
watch(curso, (actual) => {
  if (actual?.evento?.id) eventoStore.registrarEventoDeCurso(actual.id, actual.evento.id);
});
const cargando = ref(true);
const error = ref('');
const modalidad = computed(() => curso.value?.modalidades?.map(item => item.tipo).join(' · ') || 'Por confirmar');
const esVirtual = computed(() => curso.value?.modalidades?.some(item => /virtual|híbrido|hibrido/i.test(item.tipo)) || false);
const notaMinima = computed(() => curso.value?.modalidades?.find(item => item.min_nota !== null)?.min_nota ?? null);
const asistenciaMinima = computed(() => curso.value?.modalidades?.find(item => item.min_asistencia !== null)?.min_asistencia ?? null);
const imagen = computed(() => imagenActividad(curso.value));
const cupoDisponible = computed(() => !curso.value?.cupo || curso.value.inscritos < curso.value.cupo);
const disponible = computed(() => curso.value?.estado === 1 && curso.value?.evento?.estado === 1 && cupoDisponible.value);
const destinoInscripcion = computed(() => auth.isAuthenticated && auth.esEstudiante
  ? { name: 'estudiante-actividades-detalle', params: { id: route.params.id } }
  : { name: 'register' });
const fecha = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Por confirmar';

watch(() => route.params.id, async (id) => {
  curso.value = null;
  error.value = '';
  cargando.value = true;
  try {
    const response = await api.get(`/actividades-academicas/publicos/${id}`);
    curso.value = response.data;
  } catch (cause: any) {
    // El backend local anterior todavía no expone /publicos/:id; su ruta /:id sí existe.
    const mensaje = String(cause?.response?.data?.message || '');
    if (cause?.response?.status === 404 && mensaje.startsWith('Cannot GET ')) {
      try {
        const { data: act } = await api.get(`/actividades-academicas/${id}`);
        const modalidades = Array.isArray(act.modalidades) && act.modalidades.length ? act.modalidades : [{
          id: 0, tipo: act.modalidad || 'Presencial', min_nota: act.min_nota ?? 51, min_asistencia: act.min_asistencia ?? 80,
        }];
        curso.value = {
          id: act.id, nombre: act.nombre, descripcion: act.descripcion || null, tipo: act.tipo || null,
          imagen: getImageUrl('cursos', act.imagen, ''), fecha_inicio: act.fecha_inicio || null,
          fecha_fin: act.fecha_fin || null, horas: act.horas ?? null, cupo: act.cupo ?? null,
          inscritos: 0, estado: Number(act.estado), modalidades, contenido: [],
          valoracion: { promedio: null, cantidad: 0 },
          requisitos: Array.isArray(act.requisitos?.custom) ? act.requisitos.custom.map((item: any) => String(item.label || '')).filter(Boolean) : [],
          objetivos: String(act.requisitos?.presentacion?.objetivos || '').split('\n').map(item => item.trim()).filter(Boolean),
          publico_objetivo: String(act.requisitos?.presentacion?.publico_objetivo || '').trim(),
          docentes: [], evento: act.evento ? {
            id: act.evento.id, nombre: act.evento.nombre, gestion: act.evento.gestion,
            estado: Number(act.evento.estado), imagen_fondo: getImageUrl('fondos', act.evento.imagen_fondo, ''),
          } : null,
        };
      } catch {
        error.value = 'No se pudo cargar la información de este curso.';
      }
    } else {
      error.value = cause?.response?.status === 404 ? 'Este curso ya no está disponible.' : 'No se pudo cargar la información de este curso.';
    }
  } finally {
    cargando.value = false;
  }
}, { immediate: true });
</script>

<template>
  <main class="min-h-screen bg-[#f4f7fb] pt-24 text-slate-900 dark:bg-[#091625] dark:text-white">
    <div v-if="cargando" class="mx-auto max-w-6xl px-5 py-24 text-center" role="status">Cargando curso...</div>
    <div v-else-if="error || !curso" class="mx-auto max-w-6xl px-5 py-24 text-center">
      <p class="text-lg font-semibold">{{ error || 'Curso no disponible.' }}</p>
      <RouterLink to="/eventos#cursos" class="mt-5 inline-block font-bold text-[#0070BB]">Volver a los cursos</RouterLink>
    </div>
    <template v-else>
      <section class="bg-[#062548] text-white">
        <div class="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-10 lg:grid-cols-[minmax(0,1fr)_370px] lg:px-8 lg:py-16">
          <div>
            <nav aria-label="Ruta" class="mb-8 flex flex-wrap items-center gap-2 text-sm text-sky-200">
              <RouterLink to="/eventos" class="hover:underline">Eventos y cursos</RouterLink><span aria-hidden="true">›</span>
              <RouterLink v-if="curso.evento" :to="`/eventos/${curso.evento.id}`" class="max-w-full truncate hover:underline">{{ curso.evento.nombre }}</RouterLink><span v-else>Evento</span><span aria-hidden="true">›</span><span>Curso</span>
            </nav>
            <p class="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">{{ curso.tipo || 'Curso académico' }} · {{ modalidad }}</p>
            <h1 class="max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">{{ curso.nombre }}</h1>
            <p class="mt-6 max-w-3xl whitespace-pre-line text-base leading-8 text-slate-200 sm:text-lg">{{ curso.descripcion || 'Conoce las fechas, la modalidad y las condiciones de este curso antes de inscribirte.' }}</p>
            <div class="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-200">
              <span v-if="curso.docentes.length"><VIcon size="18" class="mr-1">person</VIcon>{{ curso.docentes.map(d => d.nombre).join(', ') }}</span>
              <span><VIcon size="18" class="mr-1">{{ curso.valoracion?.cantidad ? 'star' : 'star_outline' }}</VIcon>{{ curso.valoracion?.cantidad ? `${curso.valoracion.promedio}/5 · ${curso.valoracion.cantidad} valoraciones` : 'Aún sin valoraciones' }}</span>
              <span><VIcon size="18" class="mr-1">calendar_month</VIcon>{{ fecha(curso.fecha_inicio) }}</span>
              <span v-if="curso.horas"><VIcon size="18" class="mr-1">schedule</VIcon>{{ curso.horas }} horas</span>
            </div>
          </div>
          <aside class="overflow-hidden rounded-2xl bg-white text-[#062548] shadow-2xl dark:bg-slate-900 dark:text-white">
            <img :src="imagen" data-course-image :alt="curso.nombre" class="aspect-video w-full object-cover" />
            <div class="p-6">
              <p class="text-xs font-bold uppercase tracking-widest text-[#0070BB] dark:text-sky-300">{{ disponible ? 'Inscripciones disponibles' : curso.estado === 0 ? 'Curso finalizado' : curso.evento?.estado !== 1 ? 'Inscripciones por abrir' : 'Sin cupos disponibles' }}</p>
              <h2 class="mt-2 text-xl font-black">Participa en este curso</h2>
              <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ auth.isAuthenticated && auth.esEstudiante ? 'Revisa los requisitos y solicita tu inscripción.' : 'Crea una cuenta para consultar los requisitos e inscribirte.' }}</p>
              <RouterLink v-if="disponible" :to="destinoInscripcion" class="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-[#0070BB] px-5 text-center text-sm font-bold text-white transition hover:bg-[#00558d]">{{ auth.isAuthenticated && auth.esEstudiante ? 'Ver inscripción' : 'Crear cuenta para inscribirme' }}</RouterLink>
              <p v-if="curso.cupo" class="mt-4 text-center text-xs text-slate-500 dark:text-slate-300">{{ Math.max(0, curso.cupo - curso.inscritos) }} cupos disponibles de {{ curso.cupo }}</p>
              <p v-else class="mt-4 text-center text-xs text-slate-500 dark:text-slate-300">Cupo sujeto a las condiciones del evento</p>
            </div>
          </aside>
        </div>
      </section>
      <section class="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_370px] lg:px-8">
        <div class="space-y-8">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 class="text-2xl font-black text-[#062548] dark:text-white">Información del curso</h2>
            <div class="mt-6 grid gap-5 sm:grid-cols-2">
              <div><p class="text-xs font-bold uppercase tracking-wider text-slate-500">Modalidad</p><p class="mt-1 font-semibold">{{ modalidad }}</p></div>
              <div><p class="text-xs font-bold uppercase tracking-wider text-slate-500">Duración</p><p class="mt-1 font-semibold">{{ curso.horas ? `${curso.horas} horas` : 'Por confirmar' }}</p></div>
              <div><p class="text-xs font-bold uppercase tracking-wider text-slate-500">Inicio</p><p class="mt-1 font-semibold">{{ fecha(curso.fecha_inicio) }}</p></div>
              <div><p class="text-xs font-bold uppercase tracking-wider text-slate-500">Finalización</p><p class="mt-1 font-semibold">{{ fecha(curso.fecha_fin) }}</p></div>
            </div>
          </div>
          <div v-if="curso.objetivos?.length || curso.publico_objetivo" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 class="text-2xl font-black text-[#062548] dark:text-white">Lo que aprenderás</h2>
            <ul v-if="curso.objetivos?.length" class="mt-5 grid gap-3 text-sm leading-6 sm:grid-cols-2">
              <li v-for="(objetivo, index) in curso.objetivos" :key="index" class="flex gap-2"><VIcon class="mt-0.5 shrink-0 text-[#0070BB]" size="18">check_circle</VIcon>{{ objetivo }}</li>
            </ul>
            <div v-if="curso.publico_objetivo" class="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700"><h3 class="font-bold">A quién está dirigido</h3><p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ curso.publico_objetivo }}</p></div>
          </div>
          <div v-if="curso.contenido?.length" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 class="text-2xl font-black text-[#062548] dark:text-white">Contenido del curso</h2>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-300">Una vista previa de las lecciones y evaluaciones que encontrarás al inscribirte.</p>
            <ol class="mt-5 divide-y divide-slate-100 dark:divide-slate-700">
              <li v-for="leccion in curso.contenido" :key="leccion.id" class="flex items-center gap-3 py-3 text-sm">
                <VIcon class="text-[#0070BB]" size="21">{{ leccion.tipo === 'examen' ? 'quiz' : 'play_circle' }}</VIcon>
                <span class="font-semibold">{{ leccion.titulo }}</span>
                <span class="ml-auto text-xs text-slate-500">{{ leccion.tipo === 'examen' ? 'Examen' : 'Video' }}</span>
              </li>
            </ol>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 class="text-2xl font-black text-[#062548] dark:text-white">Evaluación y certificado</h2>
            <p class="mt-4 leading-7 text-slate-600 dark:text-slate-300">Al completar los requisitos del curso podrás recibir un certificado. Si alcanzas la nota mínima{{ !esVirtual && asistenciaMinima ? ' y la asistencia requerida' : '' }}, será de <strong>aprobación</strong>; en caso contrario, será de <strong>participación</strong>.</p>
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <p class="rounded-xl bg-sky-50 p-4 text-sm text-[#063b6b] dark:bg-sky-950 dark:text-sky-100"><strong>Nota mínima:</strong> {{ notaMinima ?? 'Por definir por la organización' }}<span v-if="notaMinima !== null">/100</span></p>
              <p v-if="!esVirtual && asistenciaMinima !== null" class="rounded-xl bg-sky-50 p-4 text-sm text-[#063b6b] dark:bg-sky-950 dark:text-sky-100"><strong>Asistencia mínima:</strong> {{ asistenciaMinima }}%</p>
            </div>
            <p v-if="esVirtual" class="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-300">En los cursos virtuales, las lecciones y evaluaciones se consultan desde tu cuenta una vez que la inscripción esté aceptada.</p>
          </div>
        </div>
        <div class="self-start rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 class="text-lg font-black text-[#062548] dark:text-white">Sobre el evento</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ curso.evento?.nombre || 'Actividad académica' }}</p>
          <p v-if="curso.evento?.gestion" class="mt-2 text-sm text-slate-500 dark:text-slate-300">Gestión {{ curso.evento.gestion }}</p>
          <RouterLink :to="curso.evento ? `/eventos/${curso.evento.id}#cursos` : '/eventos#cursos'" class="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#0070BB] dark:text-sky-300">Ver cursos del evento <VIcon size="17">arrow_forward</VIcon></RouterLink>
          <div v-if="curso.requisitos?.length" class="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700"><h3 class="font-bold">Requisitos de inscripción</h3><ul class="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300"><li v-for="(requisito, index) in curso.requisitos" :key="index" class="flex gap-2"><VIcon size="17" class="text-[#0070BB]">check_circle</VIcon>{{ requisito }}</li></ul></div>
        </div>
      </section>
    </template>
  </main>
</template>
