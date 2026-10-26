<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import EventLogo from '@/components/eventos/EventLogo.vue';
import { enlaceCurso, enlaceEvento } from '@/utils/enlacePublico';

const props = defineProps<{ eventos: any[]; seleccionado: any; cargando: boolean; soloCursos?: boolean }>();

const busquedaEvento = ref('');
const estadoEvento = ref('Todos');
const paginaEvento = ref(1);
const busquedaCurso = ref('');
const modalidad = ref('Todas');
const eventoCurso = ref('Todos los eventos');
const paginaCurso = ref(1);
const limite = 8;

const normalizar = (valor: unknown) => String(valor ?? '').toLocaleLowerCase('es');
const eventosFiltrados = computed(() => props.eventos.filter(evento => {
  const texto = normalizar(busquedaEvento.value.trim());
  const estado = estadoEvento.value === 'Todos' || evento.status === estadoEvento.value || (estadoEvento.value === 'Con cursos' && evento.cursos.length > 0);
  return estado && (!texto || [evento.title, evento.description, evento.gestion, evento.subtitle, ...evento.cursos.map((curso: any) => curso.nombre)].some(valor => normalizar(valor).includes(texto)));
}));
const paginasEvento = computed(() => Math.max(1, Math.ceil(eventosFiltrados.value.length / limite)));
const eventosVisibles = computed(() => eventosFiltrados.value.slice((paginaEvento.value - 1) * limite, paginaEvento.value * limite));
const todosLosCursos = computed(() => props.eventos.flatMap(evento => evento.cursos.map((curso: any) => ({ ...curso, eventoId: evento.id, eventoTitulo: evento.title }))));
const modalidades = computed(() => ['Todas', ...new Set(todosLosCursos.value.map((curso: any) => curso.modalidad || 'Presencial'))]);
const cursosFiltrados = computed(() => todosLosCursos.value.filter((curso: any) => {
  const texto = normalizar(busquedaCurso.value.trim());
  return (!texto || [curso.nombre, curso.descripcion, curso.tipo, curso.eventoTitulo].some(valor => normalizar(valor).includes(texto)))
    && (modalidad.value === 'Todas' || curso.modalidad === modalidad.value)
    && (eventoCurso.value === 'Todos los eventos' || String(curso.eventoId) === eventoCurso.value);
}));
const paginasCurso = computed(() => Math.max(1, Math.ceil(cursosFiltrados.value.length / limite)));
const cursosVisibles = computed(() => cursosFiltrados.value.slice((paginaCurso.value - 1) * limite, paginaCurso.value * limite));
watch([busquedaEvento, estadoEvento], () => { paginaEvento.value = 1; });
watch([busquedaCurso, modalidad, eventoCurso], () => { paginaCurso.value = 1; });
</script>

<template>
  <div class="bg-[#f4f7fb] text-[#102e4c] dark:bg-[#071523] dark:text-white">
    <section v-if="!soloCursos && !eventos.length" class="px-6 py-20 text-center md:px-16">
      <p class="text-xs font-bold uppercase tracking-[0.22em] text-[#0070bb] dark:text-sky-300">Cartelera académica</p>
      <h1 class="mt-3 text-3xl font-black">{{ cargando ? 'Cargando eventos…' : 'No hay eventos publicados por ahora' }}</h1>
      <p v-if="!cargando" class="mt-3 text-sm text-slate-600 dark:text-slate-300">Vuelve pronto para conocer los próximos eventos y cursos.</p>
    </section>
    <nav v-if="!soloCursos && eventos.length" id="eventos" aria-label="Listado de eventos" class="border-b border-slate-200 bg-white px-6 pb-12 pt-14 dark:border-white/10 dark:bg-[#071523] md:px-16 lg:px-24">
      <div v-if="eventos.length === 1" class="mx-auto max-w-[1600px]">
        <p class="text-xs font-bold uppercase tracking-[0.22em] text-[#0070bb] dark:text-sky-300">Explora este evento</p>
        <div class="mt-4 flex flex-col gap-6 rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/15 dark:bg-white/[0.06] p-5 lg:flex-row lg:items-center lg:justify-between lg:p-7">
          <RouterLink :to="enlaceEvento({ id: eventos[0].id, nombre: eventos[0].title })" class="flex min-w-0 items-center gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
            <EventLogo :src="eventos[0].logo" :nombre="eventos[0].title" class="h-16 w-16 rounded-xl p-2" />
            <span class="min-w-0"><span class="block text-xs font-bold uppercase tracking-wider text-[#0070bb] dark:text-sky-300">{{ eventos[0].sigla || 'Evento actual' }} · Gestión {{ eventos[0].gestion }}</span><span class="mt-1 block text-lg font-black leading-tight sm:text-xl">{{ eventos[0].title }}</span><span class="mt-2 block text-sm text-slate-600 dark:text-slate-300">{{ eventos[0].dateShort }} · {{ eventos[0].cursos.length }} {{ eventos[0].cursos.length === 1 ? 'curso' : 'cursos' }}</span></span>
          </RouterLink>
          <div class="flex flex-wrap gap-2 text-sm font-semibold">
            <RouterLink :to="`${enlaceEvento({ id: eventos[0].id, nombre: eventos[0].title })}#informacion`" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2.5 transition hover:bg-white/10">Información</RouterLink>
            <RouterLink v-if="seleccionado?.secciones?.cronograma !== false" :to="`${enlaceEvento({ id: eventos[0].id, nombre: eventos[0].title })}#cronograma`" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2.5 transition hover:bg-white/10">Cronograma</RouterLink>
            <RouterLink :to="`${enlaceEvento({ id: eventos[0].id, nombre: eventos[0].title })}#cursos`" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2.5 transition hover:bg-white/10">Cursos</RouterLink>
            <RouterLink v-if="seleccionado?.secciones?.directorio !== false" :to="`${enlaceEvento({ id: eventos[0].id, nombre: eventos[0].title })}#organizacion`" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2.5 transition hover:bg-white/10">Ponentes</RouterLink>
            <RouterLink v-if="seleccionado?.secciones?.ubicacion !== false" :to="`${enlaceEvento({ id: eventos[0].id, nombre: eventos[0].title })}#ubicacion`" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2.5 transition hover:bg-white/10">Ubicación</RouterLink>
          </div>
        </div>
      </div>
      <div v-else class="mx-auto max-w-[1600px]">
        <div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.22em] text-[#0070bb] dark:text-sky-300">Cartelera académica</p>
            <h2 class="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Encuentra tu próximo evento</h2>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">Explora congresos, talleres y actividades. Selecciona uno para conocer sus detalles.</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <span class="rounded-full border border-slate-200 bg-slate-50 dark:border-white/15 dark:bg-white/5 px-4 py-2">{{ eventos.length }} eventos</span>
            <a href="#cursos" class="rounded-full border border-slate-200 bg-slate-50 dark:border-white/15 dark:bg-white/5 px-4 py-2 transition hover:border-sky-400 hover:text-[#0070bb] dark:hover:text-white">{{ todosLosCursos.length }} cursos disponibles <VIcon size="15">arrow_downward</VIcon></a>
          </div>
        </div>
        <div class="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.06] p-3 sm:flex-row sm:items-center">
          <label class="relative min-w-0 flex-1">
            <span class="sr-only">Buscar eventos o cursos</span>
            <VIcon size="22" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#0070bb] dark:text-sky-300">search</VIcon>
            <input v-model="busquedaEvento" type="search" placeholder="Busca por evento, curso, tema o gestión…" class="h-12 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#12283c] pl-12 pr-4 text-sm text-[#102e4c] dark:text-white placeholder:text-slate-500 dark:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25" />
          </label>
          <label class="shrink-0"><span class="sr-only">Filtrar eventos</span><select v-model="estadoEvento" class="h-12 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#12283c] px-4 text-sm font-semibold text-[#102e4c] dark:text-white outline-none focus:border-sky-400 sm:w-44"><option>Todos</option><option>Activo</option><option>Planificación</option><option>Finalizado</option><option>Con cursos</option></select></label>
        </div>
        <div class="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400"><span>{{ eventosFiltrados.length }} {{ eventosFiltrados.length === 1 ? 'resultado' : 'resultados' }}</span><span v-if="paginasEvento > 1">Página {{ paginaEvento }} de {{ paginasEvento }}</span></div>
        <div v-if="eventosVisibles.length" class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RouterLink v-for="evento in eventosVisibles" :key="evento.id" :to="enlaceEvento({ id: evento.id, nombre: evento.title })"
            class="group relative min-h-[250px] overflow-hidden rounded-2xl border text-left text-white shadow-xl transition duration-300 hover:-translate-y-1 hover:shadow-sky-950/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            :class="seleccionado?.id === evento.id ? 'border-sky-300 ring-2 ring-sky-300/70' : 'border-white/15 hover:border-sky-400/70'">
            <img :src="evento.imagen_fondo" data-fallback-src="/logo/fondoejeml.jpg" :alt="evento.title" class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <span class="absolute inset-0 bg-gradient-to-t from-[#03111f] via-[#061a2a]/75 to-[#061a2a]/15"></span>
            <span class="relative flex min-h-[250px] flex-col justify-end p-5">
              <span class="mb-auto inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-black/50 py-1 pl-1 pr-3 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm"><EventLogo :src="evento.logo" :nombre="evento.title" class="h-7 w-7 rounded-full p-0.5" />{{ evento.status }}</span>
              <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0070bb] dark:text-sky-300">Gestión {{ evento.gestion }}</span>
              <span class="mt-1 line-clamp-3 text-lg font-black leading-tight">{{ evento.title }}</span>
              <span class="mt-4 flex items-center justify-between gap-2 border-t border-white/20 pt-3 text-xs text-slate-200"><span>{{ evento.cursos.length }} {{ evento.cursos.length === 1 ? 'curso' : 'cursos' }}</span><span class="inline-flex items-center gap-1 font-bold text-white">Explorar <VIcon size="16">arrow_forward</VIcon></span></span>
            </span>
          </RouterLink>
        </div>
        <div v-else class="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white dark:border-white/20 dark:bg-white/5 px-6 py-12 text-center text-sm text-slate-600 dark:text-slate-300">No encontramos eventos con esos criterios. Prueba otra palabra o cambia el filtro.</div>
        <div v-if="paginasEvento > 1" class="mt-7 flex items-center justify-center gap-4">
          <button type="button" :disabled="paginaEvento === 1" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2 text-sm font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" @click="paginaEvento--">Anterior</button>
          <span class="text-sm text-slate-600 dark:text-slate-300">{{ paginaEvento }} / {{ paginasEvento }}</span>
          <button type="button" :disabled="paginaEvento === paginasEvento" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2 text-sm font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" @click="paginaEvento++">Siguiente</button>
        </div>
      </div>
    </nav>

    <section id="cursos" class="scroll-mt-24 border-t border-slate-200 bg-[#f4f7fb] px-6 py-14 dark:border-white/10 dark:bg-[#0b1d2f] md:px-16 lg:px-24">
      <div class="mx-auto max-w-[1600px]">
        <div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><p class="text-xs font-bold uppercase tracking-[0.22em] text-[#0070bb] dark:text-sky-300">Formación académica</p><h2 class="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{{ soloCursos ? 'Cursos de este evento' : 'Cursos para seguir aprendiendo' }}</h2><p class="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">{{ soloCursos ? 'Explora los cursos y actividades que forman parte de este evento.' : 'Descubre el contenido, la modalidad y los requisitos antes de inscribirte.' }}</p></div>
          <span class="w-fit rounded-full border border-slate-200 bg-slate-50 dark:border-white/15 dark:bg-white/5 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">{{ cursosFiltrados.length }} {{ cursosFiltrados.length === 1 ? 'curso' : 'cursos' }}</span>
        </div>
        <div class="mt-7 grid gap-3 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04] p-3" :class="soloCursos ? 'md:grid-cols-[minmax(0,1fr)_180px]' : 'md:grid-cols-[minmax(0,1fr)_180px_220px]'">
          <label class="relative"><span class="sr-only">Buscar curso</span><VIcon size="20" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#0070bb] dark:text-sky-300">search</VIcon><input v-model="busquedaCurso" type="search" placeholder="Buscar curso o tema…" class="h-12 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#12283c] pl-11 pr-4 text-sm text-[#102e4c] dark:text-white placeholder:text-slate-500 dark:text-slate-400 outline-none focus:border-sky-400" /></label>
          <label><span class="sr-only">Filtrar por modalidad</span><select v-model="modalidad" class="h-12 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#12283c] px-4 text-sm font-semibold text-[#102e4c] dark:text-white outline-none focus:border-sky-400"><option v-for="item in modalidades" :key="item">{{ item }}</option></select></label>
          <label v-if="!soloCursos"><span class="sr-only">Filtrar cursos por evento</span><select v-model="eventoCurso" class="h-12 w-full rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#12283c] px-4 text-sm font-semibold text-[#102e4c] dark:text-white outline-none focus:border-sky-400"><option>Todos los eventos</option><option v-for="evento in eventos" :key="evento.id" :value="String(evento.id)">{{ evento.title }}</option></select></label>
        </div>
        <div v-if="cursosVisibles.length" class="mt-6 flex flex-wrap gap-5">
          <RouterLink v-for="curso in cursosVisibles" :key="curso.id" :to="enlaceCurso({ id: curso.id, nombre: curso.nombre })" class="group flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-[#102e4c] shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-400 hover:shadow-xl dark:border-white/10 dark:bg-[#142a40] dark:text-white dark:hover:shadow-sky-950/50 sm:w-[calc(50%-10px)] xl:w-[calc(25%-15px)]">
            <div class="relative aspect-[16/9] overflow-hidden bg-slate-800"><img :src="curso.imagen" data-course-image :alt="curso.nombre" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span class="absolute inset-0 bg-gradient-to-t from-[#142a40]/70 to-transparent"></span><span class="absolute bottom-3 left-3 rounded-full bg-[#0070bb] px-3 py-1 text-[11px] font-bold text-white">{{ curso.modalidad }}</span></div>
            <div class="flex flex-1 flex-col p-5"><p class="line-clamp-1 text-[11px] font-bold uppercase tracking-wider text-[#0070bb] dark:text-sky-300">{{ curso.eventoTitulo }}</p><h3 class="mt-2 line-clamp-2 min-h-12 text-lg font-bold leading-snug">{{ curso.nombre }}</h3><p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{{ curso.descripcion || 'Consulta los detalles y requisitos de este curso.' }}</p><div class="mt-3 text-xs text-amber-700 dark:text-amber-300"><VIcon size="16">{{ curso.valoracion?.cantidad ? 'star' : 'star_outline' }}</VIcon> {{ curso.valoracion?.cantidad ? `${curso.valoracion.promedio}/5 · ${curso.valoracion.cantidad} valoraciones` : 'Aún sin valoraciones' }}</div><div class="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 dark:border-white/10 pt-4 text-xs text-slate-600 dark:text-slate-300"><span v-if="curso.horas" class="inline-flex items-center gap-1"><VIcon size="16">schedule</VIcon>{{ curso.horas }} h</span><span>{{ curso.estado === 1 ? 'Disponible' : 'Finalizado' }}</span></div><span class="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#0070bb] dark:text-sky-300">Ver curso <VIcon size="18">arrow_forward</VIcon></span></div>
          </RouterLink>
        </div>
        <div v-else class="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white dark:border-white/20 dark:bg-white/5 px-6 py-12 text-center text-sm text-slate-600 dark:text-slate-300">{{ soloCursos && !todosLosCursos.length ? 'Este evento todavía no tiene cursos publicados.' : eventos.length ? 'No hay cursos que coincidan con esta búsqueda.' : cargando ? 'Cargando cursos disponibles…' : 'No hay cursos publicados por ahora.' }}</div>
        <div v-if="paginasCurso > 1" class="mt-7 flex items-center justify-center gap-4"><button type="button" :disabled="paginaCurso === 1" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2 text-sm font-bold transition hover:bg-white/10 disabled:opacity-40" @click="paginaCurso--">Anterior</button><span class="text-sm text-slate-600 dark:text-slate-300">{{ paginaCurso }} / {{ paginasCurso }}</span><button type="button" :disabled="paginaCurso === paginasCurso" class="rounded-full border border-slate-300 dark:border-slate-300 dark:border-white/20 px-4 py-2 text-sm font-bold transition hover:bg-white/10 disabled:opacity-40" @click="paginaCurso++">Siguiente</button></div>
      </div>
    </section>
  </div>
</template>
