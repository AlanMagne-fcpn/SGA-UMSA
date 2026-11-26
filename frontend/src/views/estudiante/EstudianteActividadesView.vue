<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import api, { imagenActividad, imagenEvento } from '@/services/api';

const router = useRouter();
const loading = ref(true);
const eventosInscritos = ref<any[]>([]);

const fechaCorta = (valor: string | Date | null | undefined) => {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
};

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

const cargarMisActividades = async () => {
  loading.value = true;
  try {
    const response = await api.get('/me/inscripciones');
    const inscripciones = comoLista(response.data).filter(
      (ins: any) => ins?.actividadAcademica && Number(ins.actividadAcademica.estado) !== -1,
    );

    const cursos = inscripciones.map((ins: any) => {
      const act = ins.actividadAcademica;
      const evento = act.evento;
      const finalizado = cursoFinalizado(ins);
      let status = 'Inscrito';
      if (finalizado) status = 'Finalizado';
      else if (Number(ins.estado) === 0) status = 'Pre-Inscrito';
      else if (Number(ins.estado) === 2) status = 'Rechazado';

      const inicio = fechaCorta(evento?.fecha_inicio);
      const fin = fechaCorta(evento?.fecha_fin);
      const cerradoEvento = Number(evento?.estado) === 0 || Number(evento?.fase) >= 4;

      return {
        id: act.id,
        title: act.nombre,
        status,
        date: act.fecha_inicio ? new Date(act.fecha_inicio).toLocaleDateString() : 'Por definir',
        progress: finalizado ? 100 : (Number(ins.estado) === 1 ? 50 : 0),
        image: imagenActividad(act),
        eventoId: evento?.id || 0,
        eventoNombre: evento?.nombre || 'Evento',
        eventoImagen: imagenEvento(evento),
        eventoGestion: evento?.gestion || '',
        eventoDescripcion: evento?.descripcion || '',
        eventoUbicacion: evento?.ubicacion || '',
        eventoFechas: inicio && fin ? `${inicio} – ${fin}` : inicio || fin || '',
        eventoEstado: cerradoEvento ? 'Finalizado' : 'En curso',
      };
    });

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
  } catch (error) {
    console.error('Error cargando mis actividades:', error);
    eventosInscritos.value = [];
  } finally {
    loading.value = false;
  }
};

const totalCursos = computed(() =>
  eventosInscritos.value.reduce((acc, evento) => acc + (evento.cursos?.length || 0), 0),
);

const getStatusColor = (status: string) => {
  if (status === 'Finalizado') return 'text-white bg-red-500 border border-red-400 shadow-md';
  if (status === 'Inscrito' || status === 'En curso') return 'text-white bg-blue-500 border border-blue-400 shadow-md';
  if (status === 'Pre-Inscrito') return 'text-white bg-amber-500 border border-amber-400 shadow-md';
  if (status === 'Rechazado') return 'text-white bg-slate-600 border border-slate-500 shadow-md';
  return 'text-white bg-emerald-500 border border-emerald-400 shadow-md';
};

onMounted(cargarMisActividades);
</script>

<template>
  <div class="mx-auto w-full min-w-0 space-y-6 animate-in fade-in duration-500 sm:space-y-8">
    <div class="mb-2 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-gray-800 sm:pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="text-[10px] font-black uppercase tracking-widest text-umsa-blue">Mi portal</p>
        <h2 class="text-2xl font-black uppercase italic tracking-tight text-slate-800 dark:text-white sm:text-3xl">
          Mis actividades
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          Solo las actividades en las que estás inscrito o preinscrito.
          <span v-if="!loading" class="font-bold text-slate-700 dark:text-slate-300">
            {{ totalCursos }} curso(s) · {{ eventosInscritos.length }} evento(s)
          </span>
        </p>
      </div>
      <VBtn
        class="flex w-full items-center justify-center rounded-xl bg-umsa-blue px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-umsa-blue/25 sm:w-auto"
        @click="router.push({ name: 'estudiante-catalogo' })"
      >
        <VIcon class="material-symbols-outlined mr-1 text-[18px]">travel_explore</VIcon>
        Eventos disponibles
      </VBtn>
    </div>

    <div v-if="loading" class="rounded-[1.5rem] border border-slate-100 bg-white px-4 py-12 text-center dark:border-gray-800 dark:bg-gray-900 sm:rounded-[2rem] sm:px-8 sm:py-16">
      <p class="text-xs font-bold uppercase tracking-widest text-slate-400">Cargando tus actividades…</p>
    </div>

    <VCard
      v-else-if="eventosInscritos.length === 0"
      class="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-900 sm:rounded-[2rem] sm:px-8 sm:py-14"
    >
      <VIcon class="material-symbols-outlined mb-3 text-4xl text-slate-300">school</VIcon>
      <p class="text-sm font-bold uppercase tracking-widest text-gray-500">No tienes actividades inscritas</p>
      <p class="mt-2 text-xs text-slate-400">Aquí solo ves lo inscrito. Explora eventos abiertos con actividades disponibles.</p>
      <VBtn
        class="mt-6 rounded-xl bg-umsa-blue px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white"
        @click="router.push({ name: 'estudiante-catalogo' })"
      >
        Ver eventos disponibles
      </VBtn>
    </VCard>

    <article
      v-for="(evento, indice) in eventosInscritos"
      :key="evento.id"
      class="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="relative h-48 sm:h-56 md:h-64">
        <img :src="evento.imagen" data-event-image :alt="evento.nombre" class="h-full w-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-r from-[#003B71]/95 via-[#003B71]/50 to-transparent"></div>
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
          </div>
          <h3 class="text-xl font-black uppercase tracking-tight text-white sm:text-2xl md:text-3xl">{{ evento.nombre }}</h3>
          <p class="mt-2 text-[11px] font-bold uppercase tracking-widest text-white/80">
            {{ evento.cursos.length }} curso(s) inscrito(s)
          </p>
        </div>
      </div>

      <div class="grid gap-4 bg-slate-50 p-4 dark:bg-gray-950/40 sm:gap-5 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
        <VCard
          v-for="act in evento.cursos"
          :key="act.id"
          class="group flex cursor-pointer flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/60 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-500/50 dark:border-gray-800 dark:bg-gray-900"
          @click="router.push({ name: 'estudiante-actividades-detalle', params: { id: act.id } })"
        >
          <div class="relative h-40 w-full overflow-hidden">
            <img :src="act.image" data-course-image class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" :alt="act.title">
            <span class="absolute right-3 top-3 z-20 rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-widest shadow-sm" :class="getStatusColor(act.status)">
              {{ act.status }}
            </span>
          </div>
          <div class="flex flex-1 flex-col p-4">
            <h4 class="mb-2 line-clamp-2 text-sm font-black text-slate-800 dark:text-white">{{ act.title }}</h4>
            <span class="mt-auto text-[9px] font-bold uppercase tracking-widest text-slate-400">{{ act.date }}</span>
            <span class="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">Abrir actividad</span>
          </div>
        </VCard>
      </div>
    </article>
  </div>
</template>
