<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import api from '@/services/api';
import { certificadosDeEvento } from '@/utils/certificadosEvento';

type Participante = { id: number; nombre: string; email: string; roles: string[]; actividades: string[] };
const props = defineProps<{
  evento: any | null;
  certificados: any[];
  cargandoCertificados: boolean;
  errorCertificados: boolean;
}>();
const emit = defineEmits<{ close: [] }>();
const participantes = ref<Participante[]>([]);
const cargando = ref(false);
const error = ref(false);
const aviso = ref('');
const busqueda = ref('');
const rol = ref('todos');
const filtros = [
  { value: 'todos', label: 'Todos' },
  { value: 'Estudiante', label: 'Estudiantes' },
  { value: 'Ponente', label: 'Ponentes' },
  { value: 'Coordinador', label: 'Coordinadores' },
];
const certificadosEvento = computed(() => certificadosDeEvento(props.certificados, props.evento));
const certificadosUsuario = (id: number) => certificadosEvento.value.filter((c: any) => Number(c.usuario?.id) === id);
const filtrados = computed(() => participantes.value.filter((persona) => {
  if (rol.value !== 'todos' && !persona.roles.includes(rol.value)) return false;
  const texto = busqueda.value.trim().toLocaleLowerCase('es');
  return !texto || [persona.nombre, persona.email, ...persona.actividades].some((valor) => valor.toLocaleLowerCase('es').includes(texto));
}));
const cantidad = (filtro: string) => filtro === 'todos' ? participantes.value.length : participantes.value.filter((p) => p.roles.includes(filtro)).length;
const iniciales = (nombre: string) => nombre.split(/\s+/).slice(0, 2).map((parte) => parte[0] || '').join('').toUpperCase();

async function cargar(evento: any) {
  cargando.value = true;
  error.value = false;
  aviso.value = '';
  participantes.value = [];
  busqueda.value = '';
  rol.value = 'todos';
  try {
    try {
      const respuesta = await api.get(`/admin/eventos/${evento.id}/usuarios`);
      if (Array.isArray(respuesta.data) && respuesta.data.length) {
        participantes.value = respuesta.data;
        return;
      }
    } catch (fallo: any) {
      if (fallo?.response?.status === 401 || fallo?.response?.status === 403) throw fallo;
    }
    // Compatibilidad con servidores que aún no exponen el listado consolidado.
    const respuestaEventos = await api.get('/eventos');
    const eventos = Array.isArray(respuestaEventos.data) ? respuestaEventos.data : respuestaEventos.data?.data || [];
    const detalle = eventos.find((item: any) => Number(item.id) === Number(evento.id));
    if (!detalle) throw new Error('Evento no encontrado');
    const personas = new Map<number, Participante>();
    const agregar = (usuario: any, nombreRol: string, actividad?: string) => {
      const id = Number(usuario?.id);
      if (!id) return;
      let persona = personas.get(id);
      if (!persona) {
        persona = {
          id,
          nombre: [usuario.persona?.nombres, usuario.persona?.primer_apellido, usuario.persona?.segundo_apellido].filter(Boolean).join(' ') || usuario.email || 'Sin nombre',
          email: usuario.email || '', roles: [], actividades: [],
        };
        personas.set(id, persona);
      }
      if (!persona.roles.includes(nombreRol)) persona.roles.push(nombreRol);
      if (actividad && !persona.actividades.includes(actividad)) persona.actividades.push(actividad);
    };
    for (const actividad of detalle.actividades || []) {
      for (const inscripcion of actividad.inscripciones || []) agregar(inscripcion.usuario, 'Estudiante', actividad.nombre);
    }
    const [imparticiones, coordinaciones] = await Promise.allSettled([
      api.get('/imparticiones', { params: { eventoId: evento.id } }),
      api.get(`/eventos/${evento.id}/coordinaciones`),
    ]);
    if (imparticiones.status === 'fulfilled') {
      for (const item of imparticiones.value.data || []) agregar(item.usuario, 'Ponente', item.actividadAcademica?.nombre);
    }
    if (coordinaciones.status === 'fulfilled') {
      let usuariosConRoles: any[] = [];
      try {
        const respuestaUsuarios = await api.get('/usuarios', { params: { soloActivos: 'false', limit: 5000 } });
        usuariosConRoles = Array.isArray(respuestaUsuarios.data) ? respuestaUsuarios.data : respuestaUsuarios.data?.data || [];
      } catch {
        aviso.value = 'No se pudo verificar el rol de todos los responsables asignados.';
      }
      for (const item of coordinaciones.value.data || []) {
        const usuarioDirectorio = usuariosConRoles.find((usuario: any) => Number(usuario.id) === Number(item.usuario?.id));
        const asignaciones = usuarioDirectorio?.usuariosRoles || item.usuario?.usuariosRoles || [];
        if (asignaciones.some((asignacion: any) => String(asignacion.rol?.nombre_rol).toLowerCase().includes('coordinador'))) {
          agregar(item.usuario, 'Coordinador');
        }
      }
    }
    if (imparticiones.status === 'rejected' || coordinaciones.status === 'rejected') {
      aviso.value = 'Algunas asignaciones no pudieron consultarse. El listado puede estar incompleto.';
    }
    participantes.value = Array.from(personas.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  } catch {
    error.value = true;
  } finally {
    cargando.value = false;
  }
}

watch(() => props.evento?.id, (id) => { if (id && props.evento) void cargar(props.evento); });
</script>

<template>
  <VDialog :model-value="!!evento" class="sgea-dialog" max-width="920" scrollable @update:model-value="emit('close')">
    <VCard class="w-full overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#13131f]">
      <div class="border-t-4 border-[#BC9C31] bg-gradient-to-r from-[#012248] to-[#003B71] px-5 py-5 text-white sm:px-7">
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 items-start gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10"><VIcon>groups</VIcon></div>
            <div class="min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200">Gestión académica</p>
              <h2 class="mt-1 text-xl font-bold leading-tight">Usuarios del evento</h2>
              <p class="mt-1 truncate text-sm text-sky-100" :title="evento?.nombre">{{ evento?.nombre }}</p>
            </div>
          </div>
          <VBtn icon="close" variant="text" class="text-white" aria-label="Cerrar usuarios del evento" @click="emit('close')" />
        </div>
        <div class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div v-for="filtro in filtros" :key="filtro.value" class="rounded-lg border border-white/15 bg-white/10 px-3 py-2">
            <p class="text-lg font-bold leading-none">{{ cantidad(filtro.value) }}</p>
            <p class="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sky-100">{{ filtro.label }}</p>
          </div>
        </div>
      </div>
      <div class="space-y-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-slate-900/60 sm:px-7">
        <label class="block">
          <span class="mb-1.5 block text-xs font-bold text-[#003B71] dark:text-sky-200">Buscar usuario</span>
          <input v-model="busqueda" type="search" placeholder="Nombre, correo o actividad" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0070BB] focus:ring-2 focus:ring-[#0070BB]/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
        </label>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar usuarios por rol">
          <button v-for="filtro in filtros" :key="filtro.value" type="button" :aria-pressed="rol === filtro.value" class="rounded-lg border px-3 py-2 text-xs font-semibold transition-colors" :class="rol === filtro.value ? 'border-[#003B71] bg-[#003B71] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#0070BB] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'" @click="rol = filtro.value">{{ filtro.label }} <span class="ml-1 opacity-70">{{ cantidad(filtro.value) }}</span></button>
        </div>
        <p v-if="aviso" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{{ aviso }}</p>
        <p v-if="errorCertificados" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Los certificados no están disponibles en este momento.</p>
      </div>
      <div class="max-h-[min(50vh,520px)] min-h-40 overflow-y-auto bg-slate-50/60 px-5 py-4 dark:bg-[#101827] sm:px-7">
        <p v-if="cargando" class="py-12 text-center text-sm text-slate-500">Cargando participantes del evento...</p>
        <div v-else-if="error" class="py-12 text-center text-sm text-slate-600">No se pudo cargar el listado de usuarios. <VBtn size="small" color="primary" @click="evento && cargar(evento)">Reintentar</VBtn></div>
        <p v-else-if="!filtrados.length" class="py-12 text-center text-sm text-slate-500">No hay usuarios con este filtro.</p>
        <ul v-else class="space-y-2.5">
          <li v-for="persona in filtrados" :key="persona.id" class="grid min-w-0 gap-4 rounded-xl border border-l-4 border-slate-200 border-l-[#0070BB] bg-white p-4 shadow-sm dark:border-slate-700 dark:border-l-[#38bdf8] dark:bg-slate-900 md:grid-cols-2">
            <div class="flex min-w-0 items-start gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#003B71] text-xs font-bold text-white">{{ iniciales(persona.nombre) }}</div>
              <div class="min-w-0">
                <p class="break-words text-sm font-bold text-slate-900 dark:text-white">{{ persona.nombre }}</p>
                <p class="break-all text-xs text-slate-500 dark:text-slate-400">{{ persona.email }}</p>
                <div class="mt-2 flex flex-wrap gap-1.5"><span v-for="nombreRol in persona.roles" :key="nombreRol" class="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-[#003B71] dark:bg-sky-900/30 dark:text-sky-200">{{ nombreRol }}</span></div>
                <p v-if="persona.actividades.length" class="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{{ persona.actividades.join(' · ') }}</p>
              </div>
            </div>
            <div class="min-w-0 border-t border-slate-100 pt-3 dark:border-slate-700 md:border-l md:border-t-0 md:pl-4 md:pt-0">
              <p class="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#003B71] dark:text-sky-200"><VIcon size="18">workspace_premium</VIcon> Certificados <span v-if="!cargandoCertificados && !errorCertificados" class="rounded-full bg-sky-100 px-1.5 text-[10px] dark:bg-sky-900/40">{{ certificadosUsuario(persona.id).length }}</span></p>
              <p v-if="cargandoCertificados" class="text-xs text-slate-500">Consultando certificados...</p>
              <p v-else-if="errorCertificados" class="text-xs text-amber-700">Certificados no disponibles</p>
              <p v-else-if="!certificadosUsuario(persona.id).length" class="text-xs text-slate-400">Sin certificados emitidos</p>
              <ul v-else class="space-y-1.5"><li v-for="certificado in certificadosUsuario(persona.id)" :key="certificado.id" class="rounded-lg bg-slate-50 px-2.5 py-2 text-xs dark:bg-slate-800"><span class="font-semibold">{{ certificado.actividadAcademica?.nombre || certificado.infoCertificado?.cabecera || 'Certificado del evento' }}</span><span class="block text-slate-500">{{ certificado.codigo_certificado }}</span></li></ul>
            </div>
          </li>
        </ul>
      </div>
      <div class="border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-[#13131f] sm:px-7">Mostrando {{ filtrados.length }} de {{ participantes.length }} usuarios</div>
    </VCard>
  </VDialog>
</template>
