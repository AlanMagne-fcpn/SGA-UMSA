<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api, { imagenActividad, imagenEvento, resolveMediaUrl } from '@/services/api';
import Swal from '@/services/dialogs';

type RubroDesglose = {
  clave: string;
  nombre: string;
  tipo: string;
  peso: number;
  nota: number | null;
  aporte: number | null;
};

type NotaHistorial = {
  id: number;
  estudiante: string;
  correo: string;
  actividadId: number | null;
  actividad: string;
  actividadTipo?: string | null;
  actividadImagen?: string | null;
  minNota?: number;
  eventoId: number | null;
  evento: string;
  eventoNombre?: string;
  eventoImagen?: string | null;
  eventoGestion?: string | null;
  nota: number;
  fecha: string;
  desglose?: {
    modo?: string | null;
    asistencia?: { peso: number; puntos: number | null };
    rubros?: RubroDesglose[];
    resumen?: { asistencia: number | null; parciales: number; practicas: number };
    ponderacion?: { label: string; peso: number; tipo?: string }[];
  };
};

const router = useRouter();
const loading = ref(false);
const searchQuery = ref('');
const filtroEvento = ref<string | number>('');
const historial = ref<NotaHistorial[]>([]);
const eventosAbiertos = ref<Record<string, boolean>>({});
const actividadesAbiertas = ref<Record<string, boolean>>({});

const fetchHistorialCompleto = async () => {
  loading.value = true;
  try {
    const response = await api.get('/ponente/inscripciones/historial');
    historial.value = Array.isArray(response.data) ? response.data : [];
    const primer = historial.value[0];
    if (primer) {
      // Solo el evento queda abierto; las actividades arrancan cerradas.
      eventosAbiertos.value[`ev-${primer.eventoId ?? primer.evento}`] = true;
    }
  } catch (error) {
    console.error('Error al cargar historial:', error);
    historial.value = [];
    Swal.fire('Error', 'No se pudo cargar el historial de notas. Intenta nuevamente.', 'error');
  } finally {
    loading.value = false;
  }
};

const eventosOpciones = computed(() => {
  const map = new Map<string, { id: string | number; nombre: string }>();
  for (const h of historial.value) {
    const id = h.eventoId ?? h.evento;
    if (!map.has(String(id))) map.set(String(id), { id, nombre: h.eventoNombre || h.evento });
  }
  return [...map.values()];
});

const filteredHistorial = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  return historial.value.filter((h) => {
    const matchEvento = filtroEvento.value === '' || String(h.eventoId ?? h.evento) === String(filtroEvento.value);
    const matchTexto =
      !q ||
      h.estudiante.toLowerCase().includes(q) ||
      h.actividad.toLowerCase().includes(q) ||
      h.correo.toLowerCase().includes(q) ||
      (h.eventoNombre || h.evento || '').toLowerCase().includes(q);
    return matchEvento && matchTexto;
  });
});

const resumen = computed(() => {
  const rows = filteredHistorial.value;
  const aprobados = rows.filter((h) => Number(h.nota) >= Number(h.minNota ?? 51)).length;
  const promedio = rows.length
    ? Math.round((rows.reduce((s, h) => s + Number(h.nota || 0), 0) / rows.length) * 10) / 10
    : null;
  return {
    total: rows.length,
    aprobados,
    reprobados: rows.length - aprobados,
    promedio,
    eventos: new Set(rows.map((h) => h.eventoId ?? h.evento)).size,
    actividades: new Set(rows.map((h) => h.actividadId ?? h.actividad)).size,
  };
});

const grupos = computed(() => {
  const byEvento = new Map<string, {
    key: string;
    eventoId: number | null;
    nombre: string;
    sigla: string;
    gestion: string | null;
    imagen: string;
    actividades: Map<string, {
      key: string;
      actividadId: number | null;
      nombre: string;
      tipo: string;
      imagen: string;
      minNota: number;
      ponderacion: { label: string; peso: number; tipo?: string }[];
      notas: NotaHistorial[];
    }>;
  }>();

  for (const h of filteredHistorial.value) {
    const evKey = `ev-${h.eventoId ?? h.evento}`;
    if (!byEvento.has(evKey)) {
      byEvento.set(evKey, {
        key: evKey,
        eventoId: h.eventoId,
        nombre: h.eventoNombre || h.evento,
        sigla: h.evento,
        gestion: h.eventoGestion || null,
        imagen: h.eventoImagen
          ? resolveMediaUrl(h.eventoImagen)
          : imagenEvento({ imagen_fondo: h.eventoImagen, nombre: h.eventoNombre || h.evento }),
        actividades: new Map(),
      });
    }
    const evento = byEvento.get(evKey)!;
    const actKey = `act-${h.actividadId ?? h.actividad}`;
    if (!evento.actividades.has(actKey)) {
      evento.actividades.set(actKey, {
        key: actKey,
        actividadId: h.actividadId,
        nombre: h.actividad,
        tipo: h.actividadTipo || 'Actividad',
        imagen: imagenActividad({
          imagen: h.actividadImagen,
          nombre: h.actividad,
          tipo: h.actividadTipo,
        }),
        minNota: Number(h.minNota ?? 51),
        ponderacion: h.desglose?.ponderacion || [],
        notas: [],
      });
    }
    evento.actividades.get(actKey)!.notas.push(h);
  }

  return [...byEvento.values()].map((evento) => {
    const actividades = [...evento.actividades.values()].map((act) => {
      const ordenadas = [...act.notas].sort((a, b) => Number(b.nota) - Number(a.nota));
      const aprobados = ordenadas.filter((n) => Number(n.nota) >= act.minNota).length;
      const promedio = ordenadas.length
        ? Math.round((ordenadas.reduce((s, n) => s + Number(n.nota || 0), 0) / ordenadas.length) * 10) / 10
        : null;
      return { ...act, notas: ordenadas, aprobados, promedio, total: ordenadas.length };
    });
    const totalNotas = actividades.reduce((s, a) => s + a.total, 0);
    return { ...evento, actividades, totalNotas, totalActividades: actividades.length };
  });
});

function toggleEvento(key: string) {
  eventosAbiertos.value[key] = !eventosAbiertos.value[key];
}

function toggleActividad(key: string) {
  actividadesAbiertas.value[key] = !actividadesAbiertas.value[key];
}

function irActividad(actividadId: number | null) {
  if (!actividadId) return;
  router.push({ name: 'ponente-curso-detalle', params: { id: actividadId } });
}

function iniciales(nombre: string) {
  return String(nombre || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

function fmt(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(Number(valor))) return '—';
  const n = Number(valor);
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

onMounted(fetchHistorialCompleto);
</script>

<template>
  <div class="mx-auto max-w-7xl animate-in space-y-6 pb-16 fade-in duration-500">
    <header class="overflow-hidden rounded-[2rem] border border-[#1A4756]/15 bg-gradient-to-br from-[#012248] via-[#1A4756] to-[#028191] p-6 text-white shadow-xl md:p-8">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <p class="text-[10px] font-black tracking-[0.22em] text-sky-200 uppercase">Panel del ponente</p>
          <h1 class="mt-2 text-3xl font-black tracking-tight md:text-4xl">Historial de notas</h1>
          <p class="mt-2 max-w-2xl text-sm text-sky-100/90">
            Por <strong>evento</strong> → <strong>actividad</strong> → desglose de cada estudiante (asistencia, parciales, prácticas) y la <strong>nota ponderada</strong>.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p class="text-[10px] font-bold tracking-widest text-sky-100 uppercase">Registros</p>
            <p class="mt-1 text-2xl font-black">{{ resumen.total }}</p>
          </div>
          <div class="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p class="text-[10px] font-bold tracking-widest text-sky-100 uppercase">Eventos</p>
            <p class="mt-1 text-2xl font-black">{{ resumen.eventos }}</p>
          </div>
          <div class="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p class="text-[10px] font-bold tracking-widest text-sky-100 uppercase">Aprobados</p>
            <p class="mt-1 text-2xl font-black text-emerald-300">{{ resumen.aprobados }}</p>
          </div>
          <div class="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p class="text-[10px] font-bold tracking-widest text-sky-100 uppercase">Promedio</p>
            <p class="mt-1 text-2xl font-black">{{ resumen.promedio ?? '—' }}</p>
          </div>
        </div>
      </div>
    </header>

    <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center">
      <label class="relative min-w-0 flex-1">
        <span class="sr-only">Buscar</span>
        <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">search</span>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Buscar estudiante, actividad o evento..."
          class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-10 text-sm font-semibold text-slate-700 outline-none focus:border-[#028191] dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
      </label>
      <label class="relative w-full sm:w-64">
        <span class="sr-only">Filtrar por evento</span>
        <select
          v-model="filtroEvento"
          class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-4 text-sm font-semibold text-slate-700 outline-none focus:border-[#028191] dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Todos los eventos</option>
          <option v-for="ev in eventosOpciones" :key="ev.id" :value="ev.id">{{ ev.nombre }}</option>
        </select>
        <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">unfold_more</span>
      </label>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
      <span class="material-symbols-outlined animate-spin text-4xl">sync</span>
      <p class="text-xs font-black tracking-widest uppercase">Cargando historial...</p>
    </div>

    <div v-else-if="grupos.length === 0" class="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-20 text-center dark:border-slate-600 dark:bg-slate-900">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E4F1DD] text-[#1A4756]">
        <span class="material-symbols-outlined text-3xl">folder_open</span>
      </div>
      <h3 class="text-xl font-black text-slate-700 dark:text-white">Sin notas registradas</h3>
      <p class="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Cuando registres calificaciones en tus actividades, aparecerán aquí agrupadas por evento y curso.
      </p>
    </div>

    <div v-else class="space-y-6">
      <article
        v-for="evento in grupos"
        :key="evento.key"
        class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <button
          type="button"
          class="relative flex w-full flex-col gap-4 p-0 text-left"
          :aria-expanded="!!eventosAbiertos[evento.key]"
          @click="toggleEvento(evento.key)"
        >
          <div class="relative min-h-[140px] overflow-hidden md:min-h-[160px]">
            <img :src="evento.imagen" :alt="evento.nombre" class="absolute inset-0 h-full w-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-r from-[#011628] via-[#012248]/85 to-[#012248]/35"></div>
            <div class="relative z-10 flex h-full flex-col justify-end gap-3 p-5 md:flex-row md:items-end md:justify-between md:p-7">
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-umsa-gold px-3 py-1 text-[9px] font-black tracking-widest text-white uppercase">
                    {{ evento.gestion || 'Evento' }}
                  </span>
                  <span class="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[9px] font-black tracking-widest text-white uppercase backdrop-blur-sm">
                    {{ evento.totalActividades }} {{ evento.totalActividades === 1 ? 'actividad' : 'actividades' }}
                  </span>
                </div>
                <h2 class="text-2xl font-black text-white drop-shadow md:text-3xl">{{ evento.nombre }}</h2>
                <p class="mt-1 text-sm font-semibold text-sky-100">{{ evento.totalNotas }} {{ evento.totalNotas === 1 ? 'nota registrada' : 'notas registradas' }}</p>
              </div>
              <span
                class="inline-flex items-center gap-2 self-start rounded-xl border border-white/25 bg-white/15 px-4 py-2 text-xs font-black tracking-widest text-white uppercase backdrop-blur-md md:self-end"
                :class="!eventosAbiertos[evento.key] ? 'btn-hint-pulse' : ''"
              >
                {{ eventosAbiertos[evento.key] ? 'Ocultar' : 'Abrir' }}
                <span class="material-symbols-outlined text-[18px] leading-none">{{ eventosAbiertos[evento.key] ? 'expand_less' : 'expand_more' }}</span>
              </span>
            </div>
          </div>
        </button>

        <div v-show="eventosAbiertos[evento.key]" class="space-y-4 bg-[#f6fafb] p-4 md:p-5 dark:bg-slate-950">
          <section
            v-for="act in evento.actividades"
            :key="act.key"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div class="flex min-w-0 items-center gap-3">
                <div class="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700">
                  <img :src="act.imagen" :alt="act.nombre" class="h-full w-full object-cover">
                </div>
                <div class="min-w-0">
                  <p class="text-[10px] font-black tracking-widest text-[#028191] uppercase">{{ act.tipo }}</p>
                  <h3 class="truncate text-base font-black text-[#012248] dark:text-white">{{ act.nombre }}</h3>
                  <p class="mt-0.5 text-xs font-semibold text-slate-500">
                    {{ act.total }} estudiante{{ act.total === 1 ? '' : 's' }}
                    · {{ act.aprobados }} aprobado{{ act.aprobados === 1 ? '' : 's' }}
                    · promedio {{ act.promedio ?? '—' }}
                  </p>
                  <p v-if="act.ponderacion.length" class="mt-1 text-[11px] font-semibold text-slate-400">
                    Ponderación:
                    <span v-for="(p, i) in act.ponderacion" :key="p.label + i">
                      {{ i ? ' · ' : '' }}{{ p.label }} {{ p.peso }}%
                    </span>
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="act.actividadId"
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black tracking-widest text-slate-600 uppercase hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                  @click="irActividad(act.actividadId)"
                >
                  Ir a la actividad
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase transition"
                  :class="actividadesAbiertas[act.key]
                    ? 'border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                    : 'btn-hint-pulse border border-[#028191]/35 bg-[#028191] text-white shadow-sm'"
                  :aria-expanded="!!actividadesAbiertas[act.key]"
                  @click="toggleActividad(act.key)"
                >
                  {{ actividadesAbiertas[act.key] ? 'Cerrar' : 'Abrir' }}
                  <span class="material-symbols-outlined text-[16px] leading-none">{{ actividadesAbiertas[act.key] ? 'expand_less' : 'expand_more' }}</span>
                </button>
              </div>
            </div>

            <div v-show="actividadesAbiertas[act.key]" class="border-t border-slate-100 dark:border-slate-800">
              <ul class="divide-y divide-slate-100 dark:divide-slate-800">
                <li
                  v-for="nota in act.notas"
                  :key="nota.id"
                  class="space-y-4 px-4 py-5 md:px-5"
                >
                  <div class="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
                    <div class="flex min-w-0 flex-1 items-center gap-3">
                      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#012248] to-[#028191] text-sm font-black text-white shadow-md">
                        {{ iniciales(nota.estudiante) }}
                      </div>
                      <div class="min-w-0">
                        <p class="truncate text-base font-black text-slate-800 dark:text-white">{{ nota.estudiante }}</p>
                        <p class="truncate text-[11px] font-semibold text-slate-400">{{ nota.correo || 'Sin correo' }} · {{ nota.fecha }}</p>
                      </div>
                    </div>

                    <!-- Nota final destacada -->
                    <div
                      class="flex min-w-[160px] flex-col items-center justify-center rounded-2xl border-2 px-5 py-3 shadow-sm"
                      :class="Number(nota.nota) >= act.minNota
                        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900'
                        : 'border-rose-300 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-slate-900'"
                    >
                      <p class="text-[9px] font-black tracking-[0.2em] uppercase" :class="Number(nota.nota) >= act.minNota ? 'text-emerald-600' : 'text-rose-600'">
                        Nota ponderada
                      </p>
                      <p class="mt-0.5 text-4xl leading-none font-black" :class="Number(nota.nota) >= act.minNota ? 'text-emerald-600' : 'text-rose-600'">
                        {{ fmt(nota.nota) }}
                      </p>
                      <span
                        class="mt-2 rounded-full px-3 py-1 text-[9px] font-black tracking-widest uppercase"
                        :class="Number(nota.nota) >= act.minNota ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'"
                      >
                        {{ Number(nota.nota) >= act.minNota ? 'Aprobado' : 'Reprobado' }}
                      </span>
                    </div>
                  </div>

                  <!-- Tarjetas de desglose -->
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div class="relative overflow-hidden rounded-2xl border border-[#0070BB]/25 bg-gradient-to-br from-[#0070BB]/10 to-white p-4 dark:from-sky-950/50 dark:to-slate-900">
                      <div class="absolute -top-3 -right-3 h-16 w-16 rounded-full bg-[#0070BB]/10"></div>
                      <div class="relative flex items-start justify-between gap-2">
                        <div>
                          <p class="text-[10px] font-black tracking-widest text-[#0070BB] uppercase">Asistencia</p>
                          <p class="mt-1 text-3xl font-black text-[#012248] dark:text-white">
                            {{ fmt(nota.desglose?.resumen?.asistencia ?? nota.desglose?.asistencia?.puntos) }}
                          </p>
                          <p class="mt-1 text-[11px] font-bold text-slate-500">
                            Peso {{ nota.desglose?.asistencia?.peso ?? 0 }}% de la nota
                          </p>
                        </div>
                        <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0070BB] text-white shadow">
                          <span class="material-symbols-outlined text-[20px] leading-none">how_to_reg</span>
                        </span>
                      </div>
                    </div>

                    <div class="relative overflow-hidden rounded-2xl border border-[#003B71]/20 bg-gradient-to-br from-[#003B71]/10 to-white p-4 dark:from-slate-800 dark:to-slate-900">
                      <div class="absolute -top-3 -right-3 h-16 w-16 rounded-full bg-[#003B71]/10"></div>
                      <div class="relative flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                          <p class="text-[10px] font-black tracking-widest text-[#003B71] uppercase dark:text-sky-300">Parciales</p>
                          <p class="mt-1 text-3xl font-black text-[#012248] dark:text-white">
                            {{ fmt(nota.desglose?.resumen?.parciales) }}
                          </p>
                          <ul v-if="(nota.desglose?.rubros || []).some(r => r.tipo === 'examen' || r.tipo === 'seccion')" class="mt-2 space-y-1">
                            <li
                              v-for="rubro in (nota.desglose?.rubros || []).filter(r => r.tipo === 'examen' || r.tipo === 'seccion')"
                              :key="rubro.clave"
                              class="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                            >
                              <span class="truncate">{{ rubro.nombre }}</span>
                              <span class="shrink-0 font-mono text-[#003B71] dark:text-sky-300">
                                {{ rubro.aporte != null ? fmt(rubro.aporte) : '—' }}
                                <span class="text-slate-400">/ {{ rubro.peso }}%</span>
                              </span>
                            </li>
                          </ul>
                          <p v-else class="mt-1 text-[11px] font-bold text-slate-400">Sin parciales cargados</p>
                        </div>
                        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003B71] text-white shadow">
                          <span class="material-symbols-outlined text-[20px] leading-none">quiz</span>
                        </span>
                      </div>
                    </div>

                    <div class="relative overflow-hidden rounded-2xl border border-[#BC9C31]/30 bg-gradient-to-br from-[#BC9C31]/15 to-white p-4 dark:from-amber-950/40 dark:to-slate-900">
                      <div class="absolute -top-3 -right-3 h-16 w-16 rounded-full bg-[#BC9C31]/15"></div>
                      <div class="relative flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                          <p class="text-[10px] font-black tracking-widest text-[#9a7b1a] uppercase dark:text-amber-300">Prácticas</p>
                          <p class="mt-1 text-3xl font-black text-[#012248] dark:text-white">
                            {{ fmt(nota.desglose?.resumen?.practicas) }}
                          </p>
                          <ul v-if="(nota.desglose?.rubros || []).some(r => r.tipo === 'practica' || r.tipo === 'laboratorio')" class="mt-2 space-y-1">
                            <li
                              v-for="rubro in (nota.desglose?.rubros || []).filter(r => r.tipo === 'practica' || r.tipo === 'laboratorio')"
                              :key="rubro.clave"
                              class="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                            >
                              <span class="truncate">{{ rubro.nombre }}</span>
                              <span class="shrink-0 font-mono text-[#9a7b1a] dark:text-amber-300">
                                {{ rubro.aporte != null ? fmt(rubro.aporte) : '—' }}
                                <span class="text-slate-400">/ {{ rubro.peso }}%</span>
                              </span>
                            </li>
                          </ul>
                          <p v-else class="mt-1 text-[11px] font-bold text-slate-400">Sin prácticas cargadas</p>
                        </div>
                        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#BC9C31] text-white shadow">
                          <span class="material-symbols-outlined text-[20px] leading-none">science</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Barra visual: contribución a 100 -->
                  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Composición de la nota final</p>
                      <p class="text-xs font-black text-[#012248] dark:text-white">Total {{ fmt(nota.nota) }} / 100</p>
                    </div>
                    <div class="flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        class="bg-[#0070BB] transition-all"
                        :style="{ width: Math.min(100, Math.max(0, Number(nota.desglose?.resumen?.asistencia || 0))) + '%' }"
                        :title="'Asistencia ' + fmt(nota.desglose?.resumen?.asistencia)"
                      ></div>
                      <div
                        class="bg-[#003B71] transition-all"
                        :style="{ width: Math.min(100, Math.max(0, Number(nota.desglose?.resumen?.parciales || 0))) + '%' }"
                        :title="'Parciales ' + fmt(nota.desglose?.resumen?.parciales)"
                      ></div>
                      <div
                        class="bg-[#BC9C31] transition-all"
                        :style="{ width: Math.min(100, Math.max(0, Number(nota.desglose?.resumen?.practicas || 0))) + '%' }"
                        :title="'Prácticas ' + fmt(nota.desglose?.resumen?.practicas)"
                      ></div>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-[#0070BB]"></span>Asistencia</span>
                      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-[#003B71]"></span>Parciales</span>
                      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-[#BC9C31]"></span>Prácticas</span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </article>
    </div>
  </div>
</template>
