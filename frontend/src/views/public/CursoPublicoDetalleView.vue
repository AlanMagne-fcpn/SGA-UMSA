<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { getImageUrl, imagenActividad, resolveMediaUrl } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useEventoStore } from '@/stores/eventoStore';
import { enlaceCurso, enlaceEvento, idDeEnlace } from '@/utils/enlacePublico';

type Modalidad = { id: number; tipo: string; min_nota: number | null; min_asistencia: number | null };
type DocentePublico = {
  id: number;
  nombre: string;
  grado?: string;
  foto?: string | null;
  curriculum?: string;
  institucion?: string;
};
type CursoPublico = {
  id: number; nombre: string; descripcion: string | null; tipo: string | null; imagen: string | null;
  fecha_inicio: string | null; fecha_fin: string | null; horas: number | null; cupo: number | null;
  inscritos: number; estado: number; modalidades: Modalidad[];
  contenido: { id: number; tipo: 'video' | 'examen'; titulo: string; descripcion: string | null; orden: number }[];
  valoracion: { promedio: number | null; cantidad: number };
  requisitos: string[];
  objetivos: string[]; publico_objetivo: string;
  docentes: DocentePublico[];
  evento: { id: number; nombre: string; gestion: string | null; estado: number; imagen_fondo: string | null } | null;
};

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const eventoStore = useEventoStore();
const curso = ref<CursoPublico | null>(null);
watch(curso, (actual) => {
  if (actual?.evento?.id) eventoStore.registrarEventoDeCurso(actual.id, actual.evento.id);
  if (!actual?.id) return;
  const canonico = enlaceCurso(actual);
  if (route.path !== canonico) router.replace(canonico);
});
const cargando = ref(true);
const error = ref('');
const modalidad = computed(() => curso.value?.modalidades?.map(item => item.tipo).join(' · ') || 'Por confirmar');
const tipoActividad = computed(() => {
  const raw = String(curso.value?.tipo || '').trim();
  return raw || 'actividad académica';
});
const tipoMinuscula = computed(() => tipoActividad.value.toLocaleLowerCase('es'));
const deTipo = computed(() => {
  const t = tipoMinuscula.value;
  if (/^(especialidad|actividad|conferencia|jornada)\b/.test(t)) return `de la ${t}`;
  return `del ${t}`;
});
const esteTipo = computed(() => {
  const t = tipoMinuscula.value;
  if (/^(especialidad|actividad|conferencia|jornada)\b/.test(t)) return `esta ${t}`;
  if (/^[aeiouáéíóú]/i.test(t)) return `este ${t}`;
  return `este ${t}`;
});
const esVirtual = computed(() => curso.value?.modalidades?.some(item => /virtual|híbrido|hibrido/i.test(item.tipo)) || false);
const notaMinima = computed(() => curso.value?.modalidades?.find(item => item.min_nota !== null)?.min_nota ?? null);
const asistenciaMinima = computed(() => curso.value?.modalidades?.find(item => item.min_asistencia !== null)?.min_asistencia ?? null);
const imagen = computed(() => imagenActividad(curso.value));
const cupoDisponible = computed(() => !curso.value?.cupo || curso.value.inscritos < curso.value.cupo);
const disponible = computed(() => curso.value?.estado === 1 && curso.value?.evento?.estado === 1 && cupoDisponible.value);
const cursoId = computed(() => idDeEnlace(route.params.id));
const destinoInscripcion = computed(() => auth.isAuthenticated && auth.esEstudiante
  ? { name: 'estudiante-actividades-detalle', params: { id: cursoId.value } }
  : { name: 'register' });
const fecha = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Por confirmar';

watch(() => route.params.id, async () => {
  const id = cursoId.value;
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
        const { data: act } = await api.get(`/actividades-academicas/${cursoId.value}`);
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
        error.value = 'No se pudo cargar la información de esta actividad.';
      }
    } else {
      error.value = cause?.response?.status === 404 ? 'Esta actividad ya no está disponible.' : 'No se pudo cargar la información de esta actividad.';
    }
  } finally {
    cargando.value = false;
  }
}, { immediate: true });
</script>

<template>
  <main class="min-h-screen bg-[#f4f7fb] pt-24 text-slate-900 dark:bg-[#091625] dark:text-white">
    <div v-if="cargando" class="mx-auto max-w-6xl px-5 py-24 text-center" role="status">Cargando actividad...</div>
    <div v-else-if="error || !curso" class="mx-auto max-w-6xl px-5 py-24 text-center">
      <p class="text-lg font-semibold">{{ error || 'Actividad no disponible.' }}</p>
      <RouterLink to="/eventos#cursos" class="mt-5 inline-block font-bold text-[#0070BB]">Volver a las actividades</RouterLink>
    </div>
    <template v-else>
      <section class="bg-[#062548] text-white">
        <div class="mx-auto grid max-w-[90rem] items-start gap-8 px-5 pb-10 pt-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8 lg:py-12">
          <div>
            <nav aria-label="Ruta">
              <p class="text-sm font-bold uppercase tracking-[0.18em] text-[#BC9C31]">{{ curso.tipo || 'Actividad académica' }} · {{ modalidad }}</p>
              <ol class="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-2">
                <li>
                  <RouterLink to="/eventos" class="text-lg font-semibold text-sky-100 hover:text-white">Eventos y actividades</RouterLink>
                </li>
                <li aria-hidden="true" class="select-none text-xl text-[#BC9C31]">›</li>
                <li>
                  <RouterLink v-if="curso.evento" :to="enlaceEvento(curso.evento)" class="text-xl font-semibold text-white hover:text-sky-100 sm:text-2xl">{{ curso.evento.nombre }}</RouterLink>
                  <span v-else class="text-xl font-semibold text-white sm:text-2xl">Evento</span>
                </li>
                <li aria-hidden="true" class="select-none text-xl text-[#BC9C31]">›</li>
                <li>
                  <h1 class="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">{{ curso.nombre }}</h1>
                </li>
              </ol>
            </nav>
            <div class="mt-6 rounded-2xl border border-[#BC9C31]/40 bg-white/5 p-5">
              <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#BC9C31]">Descripción</p>
              <p class="mt-2 whitespace-pre-line text-lg font-semibold leading-8 text-white sm:text-xl">{{ curso.descripcion || `Conoce las fechas, la modalidad y las condiciones de ${esteTipo} antes de inscribirte.` }}</p>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div v-if="curso.docentes.length" class="rounded-2xl border border-white/15 bg-white/5 p-4">
                <VIcon size="22" class="text-[#BC9C31]">person</VIcon>
                <p class="mt-3 text-xs font-bold uppercase tracking-wide text-sky-200">Docentes</p>
                <p class="mt-1 text-base font-bold leading-snug text-white">{{ curso.docentes.map(d => [d.grado, d.nombre].filter(Boolean).join(' ')).join(' · ') }}</p>
              </div>
              <div class="rounded-2xl border border-white/15 bg-white/5 p-4">
                <VIcon size="22" class="text-[#BC9C31]">{{ curso.valoracion?.cantidad ? 'star' : 'star_outline' }}</VIcon>
                <p class="mt-3 text-xs font-bold uppercase tracking-wide text-sky-200">Valoración</p>
                <p class="mt-1 text-base font-bold leading-snug text-white">{{ curso.valoracion?.cantidad ? `${curso.valoracion.promedio}/5` : 'Sin valoraciones' }}</p>
                <p class="mt-1 text-sm text-sky-100">{{ curso.valoracion?.cantidad ? `${curso.valoracion.cantidad} valoraciones` : 'Todavía no hay opiniones' }}</p>
              </div>
              <div class="rounded-2xl border border-white/15 bg-white/5 p-4">
                <VIcon size="22" class="text-[#BC9C31]">calendar_month</VIcon>
                <p class="mt-3 text-xs font-bold uppercase tracking-wide text-sky-200">Inicio</p>
                <p class="mt-1 text-base font-bold leading-snug text-white">{{ fecha(curso.fecha_inicio) }}</p>
              </div>
              <div v-if="curso.horas" class="rounded-2xl border border-white/15 bg-white/5 p-4">
                <VIcon size="22" class="text-[#BC9C31]">schedule</VIcon>
                <p class="mt-3 text-xs font-bold uppercase tracking-wide text-sky-200">Carga horaria</p>
                <p class="mt-1 text-base font-bold leading-snug text-white">{{ curso.horas }} horas</p>
              </div>
            </div>
          </div>
          <aside class="overflow-hidden rounded-2xl bg-white text-[#1E293B] shadow-2xl dark:bg-slate-900 dark:text-white">
            <img :src="imagen" data-course-image :alt="curso.nombre" class="aspect-video w-full object-cover" />
            <div class="p-6">
              <p class="text-xs font-bold uppercase tracking-[0.16em] text-[#3C6893] dark:text-sky-300">{{ disponible ? 'Inscripciones disponibles' : curso.estado === 0 ? `${tipoActividad} · cerrado` : curso.evento?.estado !== 1 ? 'Inscripciones por abrir' : 'Sin cupos disponibles' }}</p>
              <h2 class="mt-2 text-xl font-extrabold text-[#1A4756] dark:text-white">Participa en {{ esteTipo }}</h2>
              <p class="mt-2 text-base leading-7 text-[#1E293B] dark:text-slate-300">{{ auth.isAuthenticated && auth.esEstudiante ? 'Revisa los requisitos y solicita tu inscripción.' : 'Crea una cuenta para consultar los requisitos e inscribirte.' }}</p>
              <RouterLink v-if="disponible" :to="destinoInscripcion" class="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-[#0070BB] px-5 text-center text-sm font-bold text-white transition hover:bg-[#00558d]">{{ auth.isAuthenticated && auth.esEstudiante ? 'Ver inscripción' : 'Crear cuenta para inscribirme' }}</RouterLink>
              <p v-if="curso.cupo" class="mt-4 text-center text-xs text-slate-500 dark:text-slate-300">{{ Math.max(0, curso.cupo - curso.inscritos) }} cupos disponibles de {{ curso.cupo }}</p>
              <p v-else class="mt-4 text-center text-xs text-slate-500 dark:text-slate-300">Cupo sujeto a las condiciones del evento</p>
            </div>
          </aside>
        </div>
      </section>
      <section class="mx-auto grid max-w-[90rem] items-start gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <div class="space-y-8">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 class="flex items-center gap-3 text-2xl font-black tracking-tight text-[#012248] dark:text-white"><span class="h-7 w-1.5 rounded-full bg-[#BC9C31]"></span>Información {{ deTipo }}</h2>
            <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#BC9C31] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#012248] text-white"><VIcon size="18">category</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Tipo</p></div>
                <p class="mt-4 text-[1.7rem] font-black leading-none tracking-tight text-[#012248] dark:text-white">{{ curso.tipo || 'Actividad académica' }}</p>
                <p class="mt-3 border-t border-[#BC9C31]/40 pt-2 text-sm font-medium text-[#3C6893]">Clase de actividad dentro del evento.</p>
              </div>
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#0070BB] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#0070BB] text-white"><VIcon size="18">school</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Modalidad</p></div>
                <p class="mt-4 text-[1.7rem] font-black leading-none tracking-tight text-[#012248] dark:text-white">{{ modalidad }}</p>
                <p class="mt-3 border-t border-[#0070BB]/30 pt-2 text-sm font-medium text-[#3C6893]">Forma en que se desarrolla la actividad.</p>
              </div>
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#028191] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#028191] text-white"><VIcon size="18">schedule</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Duración</p></div>
                <p class="mt-4 text-[1.7rem] font-black leading-none tracking-tight text-[#012248] dark:text-white">{{ curso.horas ? `${curso.horas} horas` : 'Por confirmar' }}</p>
                <p class="mt-3 border-t border-[#028191]/30 pt-2 text-sm font-medium text-[#3C6893]">Carga horaria total {{ deTipo }}.</p>
              </div>
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#028191] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#028191] text-white"><VIcon size="18">groups</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Cupo</p></div>
                <p class="mt-4 text-[1.7rem] font-black leading-none tracking-tight text-[#012248] dark:text-white">{{ curso.cupo ? `${curso.inscritos} de ${curso.cupo}` : 'Sin límite' }}</p>
                <p class="mt-3 border-t border-[#028191]/30 pt-2 text-sm font-medium text-[#3C6893]">{{ curso.cupo ? 'Inscritos aceptados sobre el cupo.' : 'El cupo depende de las condiciones del evento.' }}</p>
              </div>
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#3C6893] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#3C6893] text-white"><VIcon size="18">event</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Inicio</p></div>
                <p class="mt-4 text-[1.7rem] font-black leading-none tracking-tight text-[#012248] dark:text-white">{{ fecha(curso.fecha_inicio) }}</p>
                <p class="mt-3 border-t border-[#3C6893]/30 pt-2 text-sm font-medium text-[#3C6893]">Fecha en la que comienza.</p>
              </div>
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#012248] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#012248] text-white"><VIcon size="18">event_available</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Finalización</p></div>
                <p class="mt-4 text-[1.7rem] font-black leading-none tracking-tight text-[#012248] dark:text-white">{{ fecha(curso.fecha_fin) }}</p>
                <p class="mt-3 border-t border-[#012248]/20 pt-2 text-sm font-medium text-[#3C6893]">Fecha prevista de cierre.</p>
              </div>
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#BC9C31] bg-[#f4f7fb] p-5 dark:bg-white/5 xl:col-span-3">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#012248] text-white"><VIcon size="18">person</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Docentes</p></div>
                <p v-if="!curso.docentes.length" class="mt-4 text-[1.7rem] font-black leading-none tracking-tight text-[#012248] dark:text-white">Por confirmar</p>
                <ul v-else class="mt-5 grid gap-4 md:grid-cols-2">
                  <li v-for="docente in curso.docentes" :key="docente.id" class="flex gap-4 rounded-2xl border border-white/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <img
                      v-if="docente.foto"
                      :src="resolveMediaUrl(docente.foto)"
                      :alt="docente.nombre"
                      class="h-20 w-20 shrink-0 rounded-2xl object-cover"
                    />
                    <div v-else class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#012248] text-white">
                      <VIcon size="32">person</VIcon>
                    </div>
                    <div class="min-w-0">
                      <p class="text-lg font-black leading-tight text-[#012248] dark:text-white">
                        <span v-if="docente.grado" class="text-[#028191]">{{ docente.grado }} </span>{{ docente.nombre }}
                      </p>
                      <p v-if="docente.institucion" class="mt-1 text-sm font-semibold text-[#3C6893]">{{ docente.institucion }}</p>
                      <p v-if="docente.curriculum" class="mt-2 whitespace-pre-line text-sm leading-6 text-[#1E293B] dark:text-slate-300">{{ docente.curriculum }}</p>
                      <p v-else class="mt-2 text-sm text-slate-500">Currículum por completar.</p>
                    </div>
                  </li>
                </ul>
                <p class="mt-3 border-t border-[#BC9C31]/40 pt-2 text-sm font-medium text-[#3C6893]">Quienes imparten esta actividad.</p>
              </div>
            </div>
          </div>
          <div v-if="curso.objetivos?.length || curso.publico_objetivo" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 class="flex items-center gap-3 text-2xl font-black tracking-tight text-[#012248] dark:text-white"><span class="h-7 w-1.5 rounded-full bg-[#BC9C31]"></span>Lo que aprenderás</h2>
            <ul v-if="curso.objetivos?.length" class="mt-5 grid gap-3 text-base leading-7 text-[#1E293B] dark:text-slate-200 sm:grid-cols-2">
              <li v-for="(objetivo, index) in curso.objetivos" :key="index" class="flex gap-2"><VIcon class="mt-0.5 shrink-0 text-[#028191]" size="18">check_circle</VIcon>{{ objetivo }}</li>
            </ul>
            <div v-if="curso.publico_objetivo" class="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
              <h3 class="font-bold text-[#1A4756] dark:text-white">A quién está dirigido</h3>
              <ul class="mt-3 space-y-2 text-base leading-7 text-[#1E293B] dark:text-slate-300">
                <li v-for="perfil in curso.publico_objetivo.split(/\s*;\s*/).filter(Boolean)" :key="perfil" class="flex items-start gap-2">
                  <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#028191]" />
                  <span>{{ perfil }}</span>
                </li>
              </ul>
            </div>
          </div>
          <div v-if="curso.contenido?.length" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 class="flex items-center gap-3 text-2xl font-black tracking-tight text-[#012248] dark:text-white"><span class="h-7 w-1.5 rounded-full bg-[#BC9C31]"></span>Contenido {{ deTipo }}</h2>
            <p class="mt-2 text-base font-medium leading-7 text-[#3C6893] dark:text-slate-300">Una vista previa de las lecciones y evaluaciones que encontrarás al inscribirte.</p>
            <ol class="mt-5 divide-y divide-slate-100 dark:divide-slate-700">
              <li v-for="leccion in curso.contenido" :key="leccion.id" class="flex items-center gap-3 py-3 text-sm">
                <VIcon class="text-[#028191]" size="21">{{ leccion.tipo === 'examen' ? 'quiz' : 'play_circle' }}</VIcon>
                <span class="font-semibold text-[#1E293B] dark:text-white">{{ leccion.titulo }}</span>
                <span class="ml-auto text-xs font-medium text-[#64748B]">{{ leccion.tipo === 'examen' ? 'Examen' : 'Video' }}</span>
              </li>
            </ol>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <h2 class="flex items-center gap-3 text-2xl font-black tracking-tight text-[#012248] dark:text-white"><span class="h-7 w-1.5 rounded-full bg-[#BC9C31]"></span>Evaluación y certificado</h2>
            <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#028191] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#028191]">Si apruebas</p>
                <p class="mt-3 text-xl font-black leading-tight tracking-tight text-[#012248]">Certificado de aprobación</p>
                <p class="mt-3 border-t border-[#028191]/30 pt-2 text-sm font-medium leading-6 text-[#3C6893]">Se entrega al alcanzar la nota mínima{{ !esVirtual && asistenciaMinima ? ' y la asistencia requerida' : '' }}.</p>
              </div>
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#3C6893] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Si participas</p>
                <p class="mt-3 text-xl font-black leading-tight tracking-tight text-[#012248] dark:text-white">Certificado de participación</p>
                <p class="mt-3 border-t border-[#3C6893]/30 pt-2 text-sm font-medium leading-6 text-[#3C6893] dark:text-slate-300">Se entrega cuando completas {{ esteTipo }} sin llegar a la nota mínima.</p>
              </div>
              <div class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#BC9C31] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#012248] text-[#BC9C31]"><VIcon size="18">grade</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Nota mínima</p></div>
                <p class="mt-4 text-4xl font-black leading-none tracking-tight text-[#012248] dark:text-white">{{ notaMinima ?? 'Por definir' }}<span v-if="notaMinima !== null" class="text-lg font-bold text-[#3C6893]">/100</span></p>
              </div>
              <div v-if="!esVirtual && asistenciaMinima !== null" class="rounded-2xl border border-[#3C6893]/15 border-l-4 border-l-[#028191] bg-[#f4f7fb] p-5 dark:bg-white/5">
                <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-[#028191] text-white"><VIcon size="18">how_to_reg</VIcon></span><p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#3C6893]">Asistencia mínima</p></div>
                <p class="mt-4 text-4xl font-black leading-none tracking-tight text-[#028191]">{{ asistenciaMinima }}<span class="text-lg">%</span></p>
              </div>
            </div>
            <p v-if="esVirtual" class="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-300">En modalidad virtual, las lecciones y evaluaciones se consultan desde tu cuenta una vez que la inscripción esté aceptada.</p>
          </div>
        </div>
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-24">
          <div v-if="curso.evento?.imagen_fondo" class="relative h-36">
            <img :src="curso.evento.imagen_fondo" alt="" class="h-full w-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-[#041525]/80 to-transparent"></div>
          </div>
          <div class="p-6">
          <h2 class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#BC9C31]">Esta actividad pertenece al evento</h2>
          <p class="mt-2 text-2xl font-black leading-tight tracking-tight text-[#012248] dark:text-white">{{ curso.evento?.nombre || 'Actividad académica' }}</p>
          <p v-if="curso.evento?.gestion" class="mt-2 text-sm text-[#64748B] dark:text-slate-300">Gestión {{ curso.evento.gestion }}</p>
          <RouterLink :to="curso.evento ? `${enlaceEvento(curso.evento)}#cursos` : '/eventos#cursos'" class="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#028191] underline-offset-2 hover:underline dark:text-sky-300">Ver actividades del evento <VIcon size="17">arrow_forward</VIcon></RouterLink>
          <div v-if="curso.requisitos?.length" class="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700"><h3 class="font-semibold text-[#1A4756] dark:text-white">Requisitos de inscripción</h3><ul class="mt-3 space-y-2 text-base leading-7 text-[#1E293B] dark:text-slate-300"><li v-for="(requisito, index) in curso.requisitos" :key="index" class="flex gap-2"><VIcon size="17" class="text-[#028191]">check_circle</VIcon>{{ requisito }}</li></ul></div>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>
