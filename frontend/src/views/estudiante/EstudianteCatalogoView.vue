<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import api, { imagenActividad, imagenEvento } from '@/services/api';

const router = useRouter();
const eventosDisponibles = ref<any[]>([]);
const loading = ref(true);

const isoHoy = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

const comoLista = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

/** Evento abierto a inscripción/ejecución (no planificación, no cerrado). */
const eventoEstaDisponible = (evento: any) => {
  const estado = Number(evento?.estado);
  const fase = Number(evento?.fase ?? 0);
  if (estado !== 1) return false;
  if (fase >= 4) return false;
  if (fase === 1) return false;
  return true;
};

/** Actividad abierta a inscripción (activa y sin fecha de fin vencida). */
const actividadEstaDisponible = (act: any, evento: any) => {
  if (Number(act?.estado) !== 1) return false;
  const fin = String(act?.fecha_fin || evento?.fecha_fin || '').slice(0, 10);
  if (fin && fin < isoHoy()) return false;
  return true;
};

const etiquetaFase = (fase: number) => {
  if (fase === 2) return 'Inscripciones';
  if (fase === 3) return 'En ejecución';
  return 'Disponible';
};

const fetchEventos = async () => {
  loading.value = true;
  try {
    const [responseEventos, responseInsc] = await Promise.all([
      api.get('/eventos'),
      api.get('/me/inscripciones'),
    ]);

    const misInsc = comoLista(responseInsc.data);
    const eventos = comoLista(responseEventos.data);

    eventosDisponibles.value = eventos
      .filter(eventoEstaDisponible)
      .map((evento: any) => {
        const actividades = (evento.actividades || [])
          .filter((act: any) => actividadEstaDisponible(act, evento))
          .map((act: any) => {
            const found = misInsc.find((i: any) => i.actividadAcademica?.id === act.id);
            let myStatus = 'Disponible';
            if (found) {
              if (Number(found.estado) === 3) myStatus = 'Finalizado';
              else if (Number(found.estado) === 1) myStatus = 'Inscrito';
              else if (Number(found.estado) === 2) myStatus = 'Rechazado';
              else myStatus = 'Pre-Inscrito';
            }

            return {
              id: act.id,
              title: act.nombre,
              status: myStatus,
              type: act.tipo || 'General',
              date: act.fecha_inicio
                ? new Date(act.fecha_inicio).toLocaleDateString()
                : 'Por definir',
              image: imagenActividad({ ...act, evento }),
            };
          })
          // En oferta no mostramos actividades ya concluidas para el estudiante
          .filter((act: any) => act.status !== 'Finalizado');

        return {
          id: evento.id,
          nombreCorto: evento.nombre,
          version: evento.gestion || '',
          descripcion: evento.descripcion || 'Sin descripción',
          imagen: imagenEvento(evento),
          estado: etiquetaFase(Number(evento.fase)),
          colorEstado: 'bg-emerald-500 text-white border-emerald-400/30',
          mostrarActividades: true,
          actividades,
        };
      })
      .filter((evento: any) => evento.actividades.length > 0);
  } catch (error) {
    console.error('Error cargando eventos disponibles:', error);
    eventosDisponibles.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(fetchEventos);

const totalActividades = computed(() =>
  eventosDisponibles.value.reduce((acc, ev) => acc + (ev.actividades?.length || 0), 0),
);

const verDetalle = (idActividad: number) => {
  router.push({ name: 'estudiante-actividades-detalle', params: { id: idActividad } });
};

const toggleActividades = (evento: any) => {
  evento.mostrarActividades = !evento.mostrarActividades;
};

const getActividadesAgrupadas = (actividades: any[]) => {
  const grupos: Record<string, any[]> = {};
  for (const act of actividades) {
    if (!grupos[act.type]) grupos[act.type] = [];
    grupos[act.type].push(act);
  }
  return grupos;
};

const getStatusColor = (status: string) => {
  if (status === 'Finalizado') return 'text-white bg-red-500 border border-red-400 shadow-md';
  if (status === 'Inscrito' || status === 'En curso') return 'text-white bg-blue-500 border border-blue-400 shadow-md';
  if (status === 'Pre-Inscrito') return 'text-white bg-amber-500 border border-amber-400 shadow-md';
  if (status === 'Rechazado') return 'text-white bg-slate-600 border border-slate-500 shadow-md';
  return 'text-white bg-emerald-500 border border-emerald-400 shadow-md';
};
</script>

<template>
  <div class="mx-auto w-full min-w-0 space-y-6 animate-in fade-in duration-500 sm:space-y-8">
    <div class="mb-2 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-gray-800 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
      <div class="min-w-0">
        <p class="text-[10px] font-black uppercase tracking-widest text-umsa-blue">Descubrimiento</p>
        <h2 class="text-2xl font-black uppercase italic tracking-tight text-slate-800 dark:text-white sm:text-3xl">
          Eventos disponibles
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          Solo eventos abiertos con actividades disponibles para inscripción.
          <span v-if="!loading" class="font-bold text-slate-700 dark:text-slate-300">
            {{ totalActividades }} actividad(es) · {{ eventosDisponibles.length }} evento(s)
          </span>
        </p>
      </div>
      <VBtn
        class="flex w-full items-center justify-center rounded-xl bg-umsa-blue px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-umsa-blue/25 sm:w-auto"
        @click="router.push({ name: 'estudiante-actividades' })"
      >
        <VIcon class="material-symbols-outlined mr-1 text-[18px]">school</VIcon>
        Mis actividades
      </VBtn>
    </div>

    <div
      v-if="loading"
      class="rounded-[1.5rem] border border-slate-100 bg-white px-4 py-12 text-center dark:border-gray-800 dark:bg-gray-900 sm:rounded-[2rem] sm:px-8 sm:py-16"
    >
      <VIcon class="material-symbols-outlined mb-3 animate-spin text-4xl text-slate-300">progress_activity</VIcon>
      <p class="text-xs font-bold uppercase tracking-widest text-slate-400">Cargando oferta disponible…</p>
    </div>

    <div
      v-else-if="!eventosDisponibles.length"
      class="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-900 sm:rounded-[2rem] sm:px-8 sm:py-14"
    >
      <VIcon class="material-symbols-outlined mb-3 text-4xl text-slate-300">event_busy</VIcon>
      <p class="text-sm font-bold uppercase tracking-widest text-gray-500">No hay eventos con actividades disponibles</p>
      <p class="mt-2 text-xs text-slate-400">Cuando se abran inscripciones o se publiquen actividades activas, aparecerán aquí.</p>
    </div>

    <VCard
      v-for="evento in eventosDisponibles"
      :key="evento.id"
      class="group/card mb-6 flex w-full flex-col overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:mb-10 sm:rounded-[2rem]"
    >
      <div class="relative h-48 w-full overflow-hidden sm:h-[240px] md:h-[320px]">
        <img
          :src="evento.imagen"
          data-event-image
          :alt="evento.nombreCorto"
          class="h-full w-full object-cover object-center transition-transform duration-[1.5s] ease-out group-hover/card:scale-105"
        >
        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>

        <span
          :class="[
            evento.colorEstado,
            'absolute left-4 top-4 z-30 w-fit rounded-full border-2 border-white/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-2xl backdrop-blur-md sm:left-6 sm:top-6 sm:px-4 sm:py-2 sm:text-[12px]',
          ]"
        >
          ● {{ evento.estado }}
        </span>

        <div class="absolute bottom-0 left-0 right-0 z-20 flex flex-col p-4 pt-16 sm:p-6 sm:pt-24 md:p-8">
          <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div class="min-w-0">
              <p v-if="evento.version" class="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 md:mb-2 md:text-xs">
                Gestión {{ evento.version }}
              </p>
              <h1 class="mb-2 text-xl font-black leading-none tracking-tighter text-white sm:text-2xl md:mb-4 md:text-5xl">
                {{ evento.nombreCorto }}
              </h1>
              <p class="line-clamp-2 max-w-2xl text-[11px] font-medium leading-relaxed text-gray-300 md:text-sm">
                {{ evento.descripcion }}
              </p>
              <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/70">
                {{ evento.actividades.length }} actividad(es) disponible(s)
              </p>
            </div>

            <VBtn
              class="relative z-30 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/20 sm:w-auto"
              @click="toggleActividades(evento)"
            >
              <span class="text-xs font-bold uppercase tracking-widest">
                {{ evento.mostrarActividades ? 'Ocultar' : 'Ver' }} actividades
              </span>
              <VIcon
                class="material-symbols-outlined text-[16px] transition-transform duration-300"
                :class="evento.mostrarActividades ? 'rotate-180' : ''"
              >
                expand_more
              </VIcon>
            </VBtn>
          </div>
        </div>
      </div>

      <div
        v-show="evento.mostrarActividades"
        class="w-full border-t border-slate-100 bg-slate-50 py-6 animate-in fade-in slide-in-from-top-4 duration-500 dark:border-gray-900 dark:bg-gray-950/50 sm:py-8"
      >
        <div
          v-for="(acts, categoria) in getActividadesAgrupadas(evento.actividades)"
          :key="categoria"
          class="mb-8 w-full overflow-hidden last:mb-0"
        >
          <div class="mb-4 flex items-end justify-between px-4 sm:px-8">
            <div class="min-w-0">
              <h3 class="text-lg font-black uppercase tracking-tighter text-primary-dark dark:text-white sm:text-xl md:text-2xl">
                {{ categoria }}
              </h3>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-gray-400">
                {{ acts.length }} disponible(s) en esta categoría
              </p>
            </div>
          </div>

          <div
            class="flex snap-x snap-mandatory flex-nowrap gap-4 overflow-x-auto px-4 pb-6 pt-2 sm:gap-6 sm:px-8 sm:pb-8"
            style="scrollbar-width: none; -ms-overflow-style: none;"
          >
            <div
              v-for="act in acts"
              :key="act.id"
              class="group relative flex w-[240px] shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:border-gray-800 dark:bg-gray-900 dark:shadow-none dark:hover:border-emerald-500 sm:w-[280px] md:w-[320px]"
              @click="verDetalle(act.id)"
            >
              <div class="relative h-40 w-full shrink-0 overflow-hidden sm:h-48">
                <img
                  :src="act.image"
                  data-course-image
                  class="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  :alt="act.title"
                >
                <span
                  class="absolute right-3 top-3 z-20 rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-widest shadow-sm"
                  :class="getStatusColor(act.status)"
                >
                  {{ act.status }}
                </span>
              </div>

              <div class="relative z-20 flex flex-1 flex-col bg-white p-4 dark:bg-gray-900 sm:p-5">
                <h3 class="mb-3 line-clamp-2 min-h-[2.5rem] text-sm font-black leading-tight text-slate-800 transition-colors group-hover:text-emerald-500 dark:text-white dark:group-hover:text-emerald-400">
                  {{ act.title }}
                </h3>

                <div class="mt-auto flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-gray-800">
                  <span class="w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    {{ act.date }}
                  </span>
                  <div class="flex items-center text-emerald-600">
                    <span class="text-[10px] font-bold uppercase">
                      {{ act.status === 'Disponible' ? 'Inscribirme' : 'Ver actividad' }}
                    </span>
                    <VIcon class="material-symbols-outlined ml-1 text-[16px]">arrow_forward</VIcon>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </VCard>
  </div>
</template>
