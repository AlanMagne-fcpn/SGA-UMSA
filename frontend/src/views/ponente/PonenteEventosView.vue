<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api, { imagenActividad, imagenEvento } from '@/services/api';

const router = useRouter();

const eventosAsignados = ref<any[]>([]);
const isLoading = ref(false);
const searchQuery = ref('');
const loadError = ref('');

const fetchData = async () => {
  try {
    isLoading.value = true;
    loadError.value = '';
    const res = await api.get('/imparticiones/mis-eventos');
    const grupos = Array.isArray(res.data) ? res.data : [];

    eventosAsignados.value = grupos
      .filter((grupo: any) => grupo?.evento)
      .map((grupo: any) => {
        const ev = grupo.evento;
        const actividades = (grupo.actividades || []).filter((act: any) => act && Number(act.estado) !== -1);
        return {
          id: ev.id,
          nombre: ev.nombre || 'Evento Principal',
          logo: ev.logo,
          imagenFondo: ev.imagen_fondo,
          fechaInicio: fechaCorta(ev.fecha_inicio),
          fechaFin: fechaCorta(ev.fecha_fin),
          image: imagenEvento(ev),
          gestion: ev.gestion ? String(ev.gestion) : (fechaCorta(ev.fecha_inicio).slice(6) || ''),
          descripcion: ev.descripcion || '',
          actividades: actividades.map((act: any) => ({
            id: act.id,
            title: act.nombre || 'Actividad',
            status: act.estado === 1 ? 'En Progreso' : (act.estado === 0 ? 'Finalizado' : 'Próximamente'),
            date: fechaCorta(act.fecha_inicio)
              ? [fechaCorta(act.fecha_inicio), fechaCorta(act.fecha_fin)].filter(Boolean).join(' – ')
              : 'Fechas por definir',
            students: act.inscripciones?.length || 0,
            type: act.tipo || 'Actividad',
            image: imagenActividad({ ...act, evento: ev }),
          })),
        };
      });
  } catch (error) {
    console.error('Error al cargar eventos asignados:', error);
    loadError.value = 'No se pudieron cargar tus asignaciones. Intenta nuevamente.';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchData();
});

const actividadesAsignadas = computed(() =>
  eventosAsignados.value.flatMap((evento: any) => evento.actividades || []),
);

const resumenPonente = computed(() => {
  const actividades = actividadesAsignadas.value;
  return [
    { label: 'Eventos', value: eventosAsignados.value.length, icon: 'corporate_fare', color: 'from-[#003B71] to-[#0070BB]' },
    { label: 'Actividades', value: actividades.length, icon: 'school', color: 'from-[#0070BB] to-sky-500' },
    { label: 'Estudiantes', value: actividades.reduce((total: number, actividad: any) => total + Number(actividad.students || 0), 0), icon: 'groups', color: 'from-emerald-700 to-emerald-500' },
    { label: 'En curso', value: actividades.filter((actividad: any) => actividad.status === 'En Progreso').length, icon: 'pending_actions', color: 'from-teal-700 to-teal-500' },
  ];
});

const participacionPonente = computed(() =>
  [...actividadesAsignadas.value]
    .sort((a: any, b: any) => Number(b.students || 0) - Number(a.students || 0))
    .slice(0, 6),
);

const anchoParticipacion = (valor: number) => {
  const max = Math.max(...participacionPonente.value.map((actividad: any) => Number(actividad.students || 0)), 1);
  return valor > 0 ? Math.max((valor / max) * 100, 8) : 0;
};

const filteredEventos = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return eventosAsignados.value;

  return eventosAsignados.value.filter((ev: any) => 
    ev.nombre.toLowerCase().includes(q) || 
    ev.actividades.some((act: any) => act.title.toLowerCase().includes(q))
  );
});

const getStatusColor = (status: any) => {
  if (status === 'En Progreso') return 'text-white bg-emerald-500 shadow-emerald-500/30';
  if (status === 'Finalizado') return 'text-white bg-rose-500 shadow-rose-500/30';
  return 'text-white bg-umsa-gold shadow-yellow-500/30';
};

const fechaCorta = (valor?: string | null) => {
  if (!valor) return '';
  const iso = String(valor).slice(0, 10);
  const partes = iso.split('-');
  if (partes.length !== 3 || partes.some((parte) => !parte)) return '';
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
};

const openActividadDetalle = (actividadId: any) => {
  router.push({ name: 'ponente-curso-detalle', params: { id: actividadId } });
};

</script>

<template>
  <div class="animate-in fade-in duration-500 max-w-7xl mx-auto space-y-8">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#003B71] to-[#0070BB] shadow-lg shadow-[#003B71]/30">
        <VIcon class="material-symbols-outlined text-[22px] text-white">monitoring</VIcon>
      </div>
      <div>
        <p class="text-[10px] font-black uppercase leading-none tracking-widest text-umsa-blue">Panel del ponente</p>
        <h2 class="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Mis asignaciones</h2>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div v-for="tarjeta in resumenPonente" :key="tarjeta.label" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#13131f]">
        <div :class="`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tarjeta.color} shadow-lg`">
          <VIcon class="material-symbols-outlined text-[20px] text-white">{{ tarjeta.icon }}</VIcon>
        </div>
        <p class="mb-1 text-3xl font-black leading-none text-slate-800 dark:text-white">{{ tarjeta.value }}</p>
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">{{ tarjeta.label }}</p>
      </div>
    </div>

    <div class="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-white/5 dark:bg-[#13131f]">
      <div class="mb-6 flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/25">
          <VIcon class="material-symbols-outlined text-lg text-umsa-blue">leaderboard</VIcon>
        </div>
        <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-300">Participación por actividad</h3>
      </div>
      <div v-if="participacionPonente.length === 0" class="rounded-[2rem] border border-slate-100 bg-slate-50 px-5 py-10 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
        Aún no hay actividades asignadas
      </div>
      <div v-else class="space-y-4 rounded-[2rem] border border-slate-100 bg-slate-50 p-5 dark:border-white/5 dark:bg-black/20">
        <div v-for="actividad in participacionPonente" :key="actividad.id" class="space-y-1.5">
          <div class="flex items-center justify-between gap-3 text-xs">
            <span class="truncate font-semibold text-slate-700 dark:text-slate-200">{{ actividad.title }}</span>
            <span class="shrink-0 font-black text-slate-800 dark:text-white">{{ actividad.students }}</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-white dark:bg-gray-800">
            <div class="h-full rounded-full bg-[#0070BB]" :style="{ width: `${anchoParticipacion(Number(actividad.students || 0))}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Buscador -->
    <div class="flex justify-center mb-8 mt-2">
      <div class="relative w-full max-w-2xl group">
        <label class="absolute -top-3 left-6 z-10 bg-slate-50 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:bg-black">Buscador de mis eventos y actividades</label>
        <span class="pointer-events-none absolute inset-y-0 left-5 z-10 flex items-center text-slate-400">
          <VIcon class="material-symbols-outlined text-xl group-focus-within:text-umsa-blue transition-colors">search</VIcon>
        </span>
        <input v-model="searchQuery" type="text" placeholder="Buscar por evento o actividad..." class="w-full rounded-full border-2 border-slate-200 bg-white py-4 pl-14 pr-6 text-sm font-bold text-[#012248] outline-none transition-all placeholder:font-semibold placeholder:text-slate-400 focus:border-[#0070BB] focus:ring-4 focus:ring-[#0070BB]/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200" />
      </div>
    </div>
    
    <!-- Cabecera -->
    <div class="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 mb-8 pb-6 px-4 md:px-0">
      <div>
        <h2 class="text-2xl md:text-3xl font-black text-primary-dark dark:text-white uppercase italic flex items-center gap-3">
          <VIcon class="material-symbols-outlined text-umsa-blue text-3xl">event</VIcon>
          Mis Eventos Asignados
        </h2>
        <p class="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-1">Eventos y programas en los que tienes actividades a tu cargo como docente/ponente</p>
      </div>
    </div>

    <div v-if="isLoading" class="p-20 flex flex-col items-center justify-center gap-4 text-slate-400">
      <VIcon class="material-symbols-outlined animate-spin text-4xl">sync</VIcon>
      <p class="text-xs font-black uppercase tracking-widest">Cargando eventos...</p>
    </div>

    <div v-else-if="loadError" class="rounded-[2rem] border border-rose-100 bg-rose-50 p-10 text-center text-rose-700">
      <p class="text-sm font-semibold">{{ loadError }}</p>
      <button type="button" class="mt-4 rounded-xl bg-[#003B71] px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white" @click="fetchData">Reintentar</button>
    </div>

    <!-- Lista vacía -->
    <VCard v-else-if="filteredEventos.length === 0" class="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[2.5rem] p-20 text-center shadow-sm">
      <div class="w-20 h-20 bg-slate-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
        <VIcon class="material-symbols-outlined text-4xl text-slate-300">event_busy</VIcon>
      </div>
      <h3 class="text-xl font-black text-slate-600 dark:text-gray-400 uppercase tracking-tighter">Sin eventos asignados</h3>
      <p class="text-xs text-slate-400 max-w-xs mx-auto font-medium">No se encontraron eventos ni actividades asignadas a tu cuenta actualmente.</p>
    </VCard>

    <!-- Grid de Eventos -->
    <div v-else class="space-y-12">
      <VCard v-for="evento in filteredEventos" :key="evento.id"
        class="bg-white dark:bg-gray-900 rounded-[2.5rem] overflow-hidden shadow-lg border border-slate-100 dark:border-gray-800 flex flex-col group/card">
        
        <!-- Banner del Evento -->
        <div class="relative min-h-64 w-full shrink-0 overflow-hidden sm:min-h-72">
          <img :src="evento.image" alt="" class="absolute inset-0 h-full w-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-[#012248] via-[#012248]/55 to-[#012248]/10"></div>

          <div class="relative z-10 flex min-h-64 flex-col justify-end gap-4 p-6 sm:min-h-72 sm:p-8">
            <div class="flex flex-wrap items-end justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p v-if="evento.gestion" class="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#BC9C31]">
                  Gestión {{ evento.gestion }}
                </p>
                <h3 class="text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
                  {{ evento.nombre }}
                </h3>
              </div>
              <div v-if="evento.fechaInicio || evento.fechaFin" class="flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-black/35 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                <VIcon class="material-symbols-outlined text-sm text-[#BC9C31]">calendar_month</VIcon>
                <span>{{ [evento.fechaInicio, evento.fechaFin].filter(Boolean).join(' – ') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Contenido y Actividades Asignadas -->
        <div class="p-6 md:p-8 bg-slate-50 dark:bg-gray-950/20">
          <h4 class="text-xs font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-4 border-b border-slate-200 dark:border-gray-800 pb-2">
            Mis Actividades Asignadas en este Evento
          </h4>

          <p v-if="evento.actividades.length === 0" class="text-sm text-slate-500 dark:text-gray-400">
            Estás asignado a este evento como responsable. Aún no tienes actividades asignadas para impartir.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <VCard v-for="actividad in evento.actividades" :key="actividad.id" @click="openActividadDetalle(actividad.id)"
              class="bg-white dark:bg-gray-900 rounded-[2.5rem] overflow-hidden shadow-lg border border-slate-100 dark:border-gray-800 hover:border-umsa-blue transition-all duration-500 hover:-translate-y-2 cursor-pointer group flex flex-col relative">
              
              <!-- Imagen Predominante -->
              <div class="relative h-60 w-full overflow-hidden shrink-0">
                <img :src="actividad.image" data-course-image :alt="actividad.title" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out">
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                
                <!-- Badge de Asignado -->
                <div class="absolute top-4 left-4 z-30">
                  <span class="bg-umsa-gold text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-full shadow-xl flex items-center gap-1 border border-white/20 backdrop-blur-md">
                    <VIcon class="material-symbols-outlined text-[12px]">assignment_ind</VIcon>
                    ASIGNADO
                  </span>
                </div>

                <span class="absolute top-4 right-4 z-20 text-[9px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest shadow-xl backdrop-blur-md border border-white/10" :class="getStatusColor(actividad.status)">
                  {{ actividad.status }}
                </span>

                <div class="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-12">
                  <p class="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#BC9C31]">
                    {{ actividad.type }}
                  </p>
                  <h3 class="line-clamp-2 text-xl font-black uppercase leading-tight text-white">
                    {{ actividad.title }}
                  </h3>
                </div>
              </div>

              <!-- Información Inferior -->
              <div class="p-6 flex flex-col flex-1 bg-white dark:bg-gray-900">
                <div class="mb-6 flex flex-wrap items-center justify-between gap-3 text-slate-500 dark:text-gray-400">
                  <div class="flex items-center gap-2">
                    <VIcon class="material-symbols-outlined text-sm text-umsa-blue">calendar_month</VIcon>
                    <span class="text-[10px] font-bold uppercase tracking-wider">{{ actividad.date }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <VIcon class="material-symbols-outlined text-sm text-umsa-blue">groups</VIcon>
                    <span class="text-[10px] font-bold uppercase tracking-wider">{{ actividad.students }} Estudiantes</span>
                  </div>
                </div>

                <div class="mt-auto flex justify-between items-center pt-5 border-t border-slate-100 dark:border-gray-800">
                    <div class="flex items-center text-umsa-blue font-black group/btn">
                        <span class="text-[11px] uppercase tracking-widest">Gestionar Actividad</span>
                        <VIcon class="material-symbols-outlined text-[18px] ml-2 group-hover/btn:translate-x-1 transition-transform">arrow_forward</VIcon>
                    </div>
                </div>
              </div>

            </VCard>
          </div>

        </div>
      </VCard>
    </div>

  </div>
</template>
