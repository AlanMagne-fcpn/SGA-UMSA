<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api, { imagenActividad, imagenEvento } from '@/services/api';

const router = useRouter();
const authStore = useAuthStore();
const nombreUsuario = computed(() => authStore.user?.persona?.nombres || 'Estudiante');
const loading = ref(true);
  // Estadísticas del dashboard
  const userStats = ref({
  inscritos: 0,
  finalizados: 0,
  certificados: 0,
});

const eventosInscritos = ref<any[]>([]);

const fechaCorta = (valor: string | Date | null | undefined) => {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const datosEvento = (evento: any) => {
  const inicio = fechaCorta(evento?.fecha_inicio);
  const fin = fechaCorta(evento?.fecha_fin);
  const fechas = inicio && fin ? `${inicio} – ${fin}` : inicio || fin || '';
  const cerrado = Number(evento?.estado) === 0 || Number(evento?.fase) >= 4;
  return {
    eventoId: evento?.id || 0,
    eventoNombre: evento?.nombre || 'Evento',
    eventoImagen: imagenEvento(evento),
    eventoGestion: evento?.gestion || '',
    eventoDescripcion: evento?.descripcion || '',
    eventoUbicacion: evento?.ubicacion || '',
    eventoFechas: fechas,
    eventoEstado: cerrado ? 'Finalizado' : 'En curso',
  };
};

/** Cerrado por inscripción, actividad o evento — no por solo tener certificado. */
const cursoFinalizado = (ins: any) => {
  const act = ins?.actividadAcademica;
  const evento = act?.evento;
  if (Number(ins?.estado) === 3) return true;
  if (Number(act?.estado) === 0) return true;
  if (Number(evento?.estado) === 0 || Number(evento?.fase) >= 4) return true;
  return false;
};

const comoLista = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const fetchInscripciones = async () => {
  try {
    const [response, certs] = await Promise.all([
      api.get('/me/inscripciones'),
      api.get('/me/certificados').catch(() => ({ data: [] })),
    ]);

    const inscripcionesReales = comoLista(response.data).filter(
      (ins: any) => ins?.actividadAcademica && Number(ins.actividadAcademica.estado) !== -1,
    );
    const listaCerts = comoLista(certs.data).filter(
      (c: any) => Number(c.tipo) === 1 || Number(c.tipo) === 4 || !c.tipo,
    );

    userStats.value.inscritos = inscripcionesReales.filter(
      (i: any) => Number(i.estado) === 1 && !cursoFinalizado(i),
    ).length;
    userStats.value.certificados = listaCerts.length;

    const cursos = inscripcionesReales.map((ins: any) => {
      const act = ins.actividadAcademica;
      const finalizado = cursoFinalizado(ins);
      let statusText = 'Inscrito';
      if (finalizado) statusText = 'Finalizado';
      else if (Number(ins.estado) === 0) statusText = 'Pre-Inscrito';
      else if (Number(ins.estado) === 2) statusText = 'Rechazado';

      return {
        id: act.id,
        title: act.nombre,
        status: statusText,
        statusCode: ins.estado,
        ...datosEvento(act.evento),
        date: act.fecha_inicio ? new Date(act.fecha_inicio).toLocaleDateString() : 'Por definir',
        progress: finalizado ? 100 : (Number(ins.estado) === 1 ? 50 : 0),
        image: imagenActividad(act),
      };
    });

    const idsYaListados = new Set(cursos.map((c) => c.id));
    for (const cert of listaCerts) {
      const act = cert.actividadAcademica;
      if (!act || idsYaListados.has(act.id) || Number(act.estado) === -1) continue;
      idsYaListados.add(act.id);
      cursos.push({
        id: act.id,
        title: act.nombre,
        status: 'Finalizado',
        statusCode: 3,
        ...datosEvento(act.evento),
        date: act.fecha_inicio ? new Date(act.fecha_inicio).toLocaleDateString() : 'Por definir',
        progress: 100,
        image: imagenActividad(act),
      });
    }

    const porEvento = new Map<number, any>();
    for (const curso of cursos) {
      if (!porEvento.has(curso.eventoId)) {
        porEvento.set(curso.eventoId, {
          id: curso.eventoId,
          nombre: curso.eventoNombre,
          imagen: curso.eventoImagen,
          gestion: curso.eventoGestion,
          descripcion: curso.eventoDescripcion,
          ubicacion: curso.eventoUbicacion,
          fechas: curso.eventoFechas,
          estado: curso.eventoEstado,
          cursos: [],
        });
      }
      porEvento.get(curso.eventoId).cursos.push(curso);
    }
    eventosInscritos.value = Array.from(porEvento.values());
    userStats.value.finalizados = cursos.filter((c) => c.status === 'Finalizado').length;
  } catch (error) {
    console.error('Error cargando inscripciones:', error);
    eventosInscritos.value = [];
    userStats.value = { inscritos: 0, finalizados: 0, certificados: 0 };
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchInscripciones();
});

const seriesAcademicas = computed(() => [
  { label: 'En progreso', value: userStats.value.inscritos, color: 'bg-[#0070BB]' },
  { label: 'Finalizados', value: userStats.value.finalizados, color: 'bg-emerald-600' },
  { label: 'Certificados', value: userStats.value.certificados, color: 'bg-[#BC9C31]' },
]);

const tarjetasResumen = computed(() => [
  { label: 'En progreso', value: userStats.value.inscritos, icon: 'auto_stories', color: 'from-[#003B71] to-[#0070BB]' },
  { label: 'Finalizados', value: userStats.value.finalizados, icon: 'check_circle', color: 'from-emerald-700 to-emerald-500' },
  { label: 'Certificados', value: userStats.value.certificados, icon: 'workspace_premium', color: 'from-[#8A7020] to-[#BC9C31]' },
]);

const anchoSerie = (valor: number) => {
  const max = Math.max(...seriesAcademicas.value.map((item) => item.value), 1);
  return valor > 0 ? Math.max((valor / max) * 100, 8) : 0;
};

const getStatusColor = (status: string) => {
  if (status === 'Finalizado') return 'text-white bg-red-500 border border-red-400 shadow-md';
  if (status === 'Inscrito' || status === 'En curso') return 'text-white bg-blue-500 border border-blue-400 shadow-md';
  if (status === 'Pre-Inscrito') return 'text-white bg-amber-500 border border-amber-400 shadow-md';
  if (status === 'Rechazado') return 'text-white bg-slate-600 border border-slate-500 shadow-md';
  return 'text-white bg-emerald-500 border border-emerald-400 shadow-md'; // Default Disponible
};
</script>

<template>
  <div class="mx-auto w-full min-w-0 space-y-6 animate-in fade-in duration-500 sm:space-y-8">
    <div class="mb-2 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-gray-800 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
      <div class="flex min-w-0 items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#003B71] to-[#0070BB] shadow-lg shadow-[#003B71]/30">
          <VIcon class="material-symbols-outlined text-[22px] text-white">monitoring</VIcon>
        </div>
        <div class="min-w-0">
          <p class="text-[10px] font-black uppercase leading-none tracking-widest text-umsa-blue">Panel del estudiante</p>
          <h2 class="truncate text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white sm:text-2xl">Hola, {{ nombreUsuario }}</h2>
          <p class="mt-1 text-sm text-slate-500">Progreso, materiales y certificados de tus actividades</p>
        </div>
      </div>
      <VBtn
        @click="$router.push({ name: 'estudiante-catalogo' })"
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-umsa-blue px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-umsa-blue/30 transition-all hover:bg-blue-800 sm:w-auto sm:text-sm"
      >
        <VIcon class="material-symbols-outlined text-[18px]">travel_explore</VIcon>
        <span>Eventos disponibles</span>
      </VBtn>
    </div>

    <div class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="tarjeta in tarjetasResumen"
        :key="tarjeta.label"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#13131f]"
      >
        <div :class="`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tarjeta.color} shadow-lg`">
          <VIcon class="material-symbols-outlined text-[20px] text-white">{{ tarjeta.icon }}</VIcon>
        </div>
        <p class="mb-1 text-3xl font-black leading-none text-slate-800 dark:text-white">{{ tarjeta.value }}</p>
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">{{ tarjeta.label }}</p>
      </div>
    </div>

    <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#13131f] sm:rounded-[2.5rem] sm:p-8">
      <div class="mb-6 flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/25">
          <VIcon class="material-symbols-outlined text-lg text-umsa-blue">leaderboard</VIcon>
        </div>
        <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-300">Estado académico</h3>
      </div>
      <div class="space-y-4 rounded-[2rem] border border-slate-100 bg-slate-50 p-5 dark:border-white/5 dark:bg-black/20">
        <div v-for="item in seriesAcademicas" :key="item.label" class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-slate-700 dark:text-slate-200">{{ item.label }}</span>
            <span class="font-black text-slate-800 dark:text-white">{{ item.value }}</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-white dark:bg-gray-800">
            <div class="h-full rounded-full" :class="item.color" :style="{ width: `${anchoSerie(item.value)}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <VCard
      v-if="!loading && eventosInscritos.length === 0"
      class="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-900 sm:rounded-[2rem] sm:px-8 sm:py-12"
    >
      <VIcon class="material-symbols-outlined mb-3 text-4xl text-slate-300">school</VIcon>
      <p class="text-sm font-bold uppercase tracking-widest text-gray-500">No tienes actividades inscritas.</p>
      <p class="mt-2 text-xs text-slate-400">Cuando te inscribas a una actividad, aparecerá aquí. Usa Eventos disponibles para ver la oferta abierta.</p>
    </VCard>

      <article
        v-for="(evento, indice) in eventosInscritos"
        :key="evento.id"
        class="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="relative h-52 sm:h-64 md:h-72">
          <img :src="evento.imagen" data-event-image :alt="evento.nombre" class="h-full w-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-r from-[#003B71]/95 via-[#003B71]/45 to-transparent"></div>
          <div class="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                Evento {{ indice + 1 }} de {{ eventosInscritos.length }}
              </span>
              <span
                class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white"
                :class="evento.estado === 'Finalizado' ? 'bg-red-500' : 'bg-emerald-500'"
              >
                {{ evento.estado }}
              </span>
              <span v-if="evento.gestion" class="rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
                Gestión {{ evento.gestion }}
              </span>
            </div>
            <h3 class="text-xl font-black uppercase tracking-tight text-white sm:text-3xl md:text-4xl">{{ evento.nombre }}</h3>
            <p v-if="evento.descripcion" class="mt-2 max-w-3xl text-sm leading-relaxed text-white/85 line-clamp-2">{{ evento.descripcion }}</p>
            <div class="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-white/80 sm:gap-4 sm:text-[11px]">
              <span v-if="evento.ubicacion" class="inline-flex items-center gap-1">
                <VIcon class="material-symbols-outlined text-[16px]">location_on</VIcon>{{ evento.ubicacion }}
              </span>
              <span v-if="evento.fechas" class="inline-flex items-center gap-1">
                <VIcon class="material-symbols-outlined text-[16px]">calendar_month</VIcon>{{ evento.fechas }}
              </span>
              <span class="inline-flex items-center gap-1">
                <VIcon class="material-symbols-outlined text-[16px]">school</VIcon>{{ evento.cursos.length }} curso(s) inscrito(s)
              </span>
            </div>
          </div>
        </div>

        <div class="grid gap-4 bg-slate-50 p-4 dark:bg-gray-950/40 sm:gap-6 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
          <VCard
            v-for="act in evento.cursos"
            :key="act.id"
            class="group flex cursor-pointer flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:-translate-y-1 hover:border-emerald-500/50 dark:border-gray-800 dark:bg-gray-900"
            @click="router.push({ name: 'estudiante-actividades-detalle', params: { id: act.id } })"
          >
            <div class="relative h-44 w-full overflow-hidden">
              <img :src="act.image" data-course-image class="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" :alt="act.title">
              <span class="absolute right-3 top-3 z-20 rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-widest shadow-sm" :class="getStatusColor(act.status)">
                {{ act.status }}
              </span>
              <div class="absolute inset-0 z-20 hidden items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
                <VBtn
                  class="flex items-center gap-2 rounded-xl bg-umsa-gold px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white"
                  @click.stop="router.push({ name: 'estudiante-actividades-detalle', params: { id: act.id }, query: { tab: 'certificados' } })"
                >
                  <VIcon class="material-symbols-outlined text-[16px]">workspace_premium</VIcon> Ver Certificado
                </VBtn>
              </div>
            </div>
            <div class="flex flex-1 flex-col bg-white p-4 dark:bg-gray-900 sm:p-5">
              <h3 class="mb-3 line-clamp-2 min-h-[2.5rem] text-sm font-black leading-tight text-slate-800 dark:text-white">{{ act.title }}</h3>
              <div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
                <div class="h-1.5 rounded-full bg-emerald-500" :style="{ width: `${act.progress}%` }"></div>
              </div>
              <div class="mt-auto flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-gray-800">
                <span class="w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">{{ act.date }}</span>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] font-bold uppercase text-emerald-600">Ingresar</span>
                  <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">{{ act.progress }}%</span>
                </div>
                <VBtn
                  class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-umsa-gold/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-amber-700 md:hidden dark:text-amber-300"
                  @click.stop="router.push({ name: 'estudiante-actividades-detalle', params: { id: act.id }, query: { tab: 'certificados' } })"
                >
                  <VIcon class="material-symbols-outlined text-[14px]">workspace_premium</VIcon>
                  Certificado
                </VBtn>
              </div>
            </div>
          </VCard>
        </div>
      </article>
  </div>
</template>
