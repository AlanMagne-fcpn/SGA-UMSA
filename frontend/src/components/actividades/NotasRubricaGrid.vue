<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import api from '@/services/api';
import Swal from '@/services/dialogs';
import { fijarPesoEsquema, mensajePonderacion, nuevaClaveItem, sumaEsquema } from '@/utils/activityLearning';

const props = defineProps<{ actividadId: number | string; seccionInicial?: 'ponderacion' | 'notas' }>();
const emit = defineEmits<{ guardado: [] }>();
const cargando = ref(false);
const guardando = ref(false);
const guardandoEsquema = ref(false);
const esquema = ref<any>(null);
const estudiantes = ref<any[]>([]);
const mensaje = ref('');
const seccion = ref<'ponderacion' | 'notas'>('ponderacion');

const itemsParcial = computed(() => (esquema.value?.items || []).filter((i: any) => i.tipo === 'examen' || i.tipo === 'seccion'));
const itemsPractica = computed(() => (esquema.value?.items || []).filter((i: any) => i.tipo === 'practica'));
const suma = computed(() => (esquema.value ? sumaEsquema(esquema.value) : 0));
const sumaAsistencia = computed(() => Number(esquema.value?.asistencia || 0));
const sumaParciales = computed(() => itemsParcial.value.reduce((a: number, i: any) => a + Number(i.puntaje || 0), 0));
const sumaPracticas = computed(() => itemsPractica.value.reduce((a: number, i: any) => a + Number(i.puntaje || 0), 0));
const guiaPonderacion = computed(() =>
  esquema.value
    ? mensajePonderacion(esquema.value)
    : { ok: false as const, falta: 100, texto: 'Configure la ponderación.', corto: 'Configure la ponderación.' },
);

async function cargar() {
  cargando.value = true;
  mensaje.value = '';
  try {
    const res = await api.get(`/actividades-academicas/${props.actividadId}/notas-rubrica`);
    esquema.value = res.data?.esquema
      ? {
          ...res.data.esquema,
          items: (res.data.esquema.items || []).map((item: any) => ({ ...item, plazo: item.plazo || null })),
        }
      : null;
    estudiantes.value = Array.isArray(res.data?.estudiantes) ? res.data.estudiantes : [];
    mensaje.value = res.data?.mensaje || '';
    if (props.seccionInicial) seccion.value = props.seccionInicial;
    else if (esquema.value) seccion.value = 'notas';
  } catch (error: any) {
    mensaje.value = error?.response?.data?.message || 'No se pudo cargar la rúbrica de notas.';
    esquema.value = null;
    estudiantes.value = [];
  } finally {
    cargando.value = false;
  }
}

async function guardarCelda(est: any, clave: string, valor: string | number) {
  if (!est.id_usuario) {
    Swal.fire('Sin cuenta', 'Este inscrito no tiene usuario; la nota por rubro requiere cuenta.', 'info');
    return;
  }
  const nota = Number(valor);
  if (!Number.isFinite(nota) || nota < 0 || nota > 100) {
    Swal.fire('Nota inválida', 'Usa un valor entre 0 y 100.', 'warning');
    return;
  }
  guardando.value = true;
  try {
    const res = await api.put(`/actividades-academicas/${props.actividadId}/notas-rubrica`, {
      id_usuario: est.id_usuario,
      clave_item: clave,
      nota,
    });
    est.notas[clave] = nota;
    est.total = res.data?.promedio ?? est.total;
    est.asistencia = res.data?.asistencia ?? est.asistencia;
  } catch (error: any) {
    Swal.fire('No se guardó', error?.response?.data?.message || 'Revisa el rubro e inténtalo de nuevo.', 'error');
  } finally {
    guardando.value = false;
  }
}

function actualizarAsistencia(valor: number) {
  if (!esquema.value) return;
  fijarPesoEsquema(esquema.value, 'asistencia', valor);
}

function actualizarPuntaje(clave: string, valor: number) {
  if (!esquema.value) return;
  fijarPesoEsquema(esquema.value, clave, valor);
}

function agregarRubro(tipo: 'examen' | 'practica') {
  if (!esquema.value) return;
  const n = (tipo === 'practica' ? itemsPractica.value.length : itemsParcial.value.length) + 1;
  const clave = nuevaClaveItem();
  esquema.value.items = [
    ...(esquema.value.items || []),
    {
      clave,
      tipo,
      nombre: tipo === 'practica' ? `Práctica ${n}` : `${n}º parcial`,
      puntaje: 0,
      plazo: null,
    },
  ];
  // Pide 10% y, si hace falta, baja prácticas/parciales/asistencia para no pasar de 100.
  fijarPesoEsquema(esquema.value, clave, 10);
}

function quitarRubro(clave: string) {
  if (!esquema.value) return;
  esquema.value.items = (esquema.value.items || []).filter((item: any) => item.clave !== clave);
}

async function guardarPonderacion() {
  if (!esquema.value) return;
  if (suma.value !== 100) {
    Swal.fire('Ponderación incompleta', guiaPonderacion.value.texto, 'warning');
    return;
  }
  guardandoEsquema.value = true;
  try {
    const res = await api.put(`/actividades-academicas/${props.actividadId}/esquema-evaluacion`, {
      asistencia: Number(esquema.value.asistencia || 0),
      bloques: esquema.value.bloques,
      items: esquema.value.items,
    });
    esquema.value = res.data?.esquema || esquema.value;
    Swal.fire({ icon: 'success', title: 'Ponderación guardada', timer: 1400, showConfirmButton: false });
    emit('guardado');
    await cargar();
  } catch (error: any) {
    Swal.fire('No se guardó', error?.response?.data?.message || 'Revisa los porcentajes.', 'error');
  } finally {
    guardandoEsquema.value = false;
  }
}

onMounted(cargar);
defineExpose({ cargar });
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-gray-800">
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0070bb]">Calificación</p>
        <h3 class="mt-1 font-serif text-3xl text-[#003B71] dark:text-white">Notas por sección</h3>
        <p class="mt-1 text-sm text-slate-500">Primero revisa o corrige la ponderación; después carga las notas. Las prácticas con entrega se gestionan en el aula.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="border px-4 py-2 text-[10px] font-bold uppercase tracking-widest" :class="seccion === 'ponderacion' ? 'border-[#003B71] bg-[#003B71] text-white' : 'border-slate-300 dark:border-gray-700'" @click="seccion = 'ponderacion'">Ponderación</button>
        <button type="button" class="border px-4 py-2 text-[10px] font-bold uppercase tracking-widest" :class="seccion === 'notas' ? 'border-[#003B71] bg-[#003B71] text-white' : 'border-slate-300 dark:border-gray-700'" @click="seccion = 'notas'">Cargar notas</button>
        <button type="button" class="border border-slate-300 px-4 py-2 text-[10px] font-bold uppercase tracking-widest dark:border-gray-700" @click="cargar">Actualizar</button>
      </div>
    </div>

    <p v-if="cargando" class="text-sm text-slate-500">Cargando rúbrica...</p>
    <p v-else-if="mensaje && !esquema" class="text-sm text-slate-500">{{ mensaje }}</p>

    <template v-else-if="esquema">
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">Asistencia</p>
          <p class="mt-1 font-mono text-3xl font-bold text-[#0070bb]">{{ sumaAsistencia }}%</p>
        </div>
        <div class="border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">Parciales</p>
          <p class="mt-1 font-mono text-3xl font-bold text-[#003B71] dark:text-sky-300">{{ sumaParciales }}%</p>
        </div>
        <div class="border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">Prácticas</p>
          <p class="mt-1 font-mono text-3xl font-bold text-[#BC9C31]">{{ sumaPracticas }}%</p>
        </div>
      </div>

      <div v-if="seccion === 'ponderacion'" class="space-y-4 border border-slate-200 bg-[#f7f8fa] p-5 dark:border-gray-800 dark:bg-slate-950">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 class="font-serif text-xl text-[#003B71] dark:text-white">Corregir ponderaciones</h4>
            <p class="text-sm text-slate-500">Al subir un %, el sistema baja automáticamente otras secciones para no pasar de 100%.</p>
          </div>
          <p class="font-mono text-2xl font-bold" :class="suma === 100 ? 'text-emerald-700' : 'text-rose-700'">{{ suma }}%</p>
        </div>

        <div class="grid gap-px overflow-hidden border border-slate-300 bg-slate-300 dark:border-slate-700 dark:bg-slate-700 lg:grid-cols-3">
          <section class="bg-white p-4 dark:bg-gray-900">
            <h5 class="font-serif text-lg">Asistencia</h5>
            <label class="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              % nota final
              <input
                :value="esquema.asistencia"
                type="number"
                min="0"
                max="100"
                step="0.01"
                class="mt-2 w-full border border-slate-300 px-3 py-2 font-mono text-lg font-bold dark:border-gray-700 dark:bg-slate-950"
                @input="actualizarAsistencia(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </section>

          <section class="bg-white p-4 dark:bg-gray-900">
            <div class="flex items-center justify-between gap-2">
              <h5 class="font-serif text-lg">Parciales</h5>
              <button type="button" class="text-xs font-bold text-[#0070bb]" @click="agregarRubro('examen')">+ Parcial</button>
            </div>
            <ul class="mt-3 space-y-2">
              <li v-for="item in itemsParcial" :key="item.clave" class="grid grid-cols-[minmax(0,1fr)_70px_auto] gap-2">
                <input v-model="item.nombre" class="border border-slate-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-slate-950" />
                <input
                  :value="item.puntaje"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="border border-slate-300 px-2 py-1.5 text-center font-mono text-sm font-bold dark:border-gray-700 dark:bg-slate-950"
                  @input="actualizarPuntaje(item.clave, Number(($event.target as HTMLInputElement).value))"
                />
                <button type="button" class="text-[10px] font-bold uppercase text-rose-700" @click="quitarRubro(item.clave)">Quitar</button>
              </li>
            </ul>
          </section>

          <section class="bg-white p-4 dark:bg-gray-900">
            <div class="flex items-center justify-between gap-2">
              <h5 class="font-serif text-lg">Prácticas</h5>
              <button type="button" class="text-xs font-bold text-[#0070bb]" @click="agregarRubro('practica')">+ Práctica</button>
            </div>
            <p class="mt-1 text-xs text-slate-500">El porcentaje aquí; el enunciado y entregas van en el aula (estilo Classroom).</p>
            <ul class="mt-3 space-y-2">
              <li v-for="item in itemsPractica" :key="item.clave" class="grid grid-cols-[minmax(0,1fr)_70px_auto] gap-2">
                <input v-model="item.nombre" class="border border-slate-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-slate-950" />
                <input
                  :value="item.puntaje"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="border border-slate-300 px-2 py-1.5 text-center font-mono text-sm font-bold dark:border-gray-700 dark:bg-slate-950"
                  @input="actualizarPuntaje(item.clave, Number(($event.target as HTMLInputElement).value))"
                />
                <button type="button" class="text-[10px] font-bold uppercase text-rose-700" @click="quitarRubro(item.clave)">Quitar</button>
              </li>
            </ul>
          </section>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="max-w-2xl text-sm" :class="guiaPonderacion.ok ? 'text-emerald-700' : 'text-rose-700'">
            <p class="font-bold">{{ guiaPonderacion.corto }}</p>
            <p v-if="!guiaPonderacion.ok" class="mt-1 text-rose-600/90">{{ guiaPonderacion.texto }}</p>
          </div>
          <button type="button" class="bg-[#003B71] px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white disabled:opacity-50" :disabled="guardandoEsquema || !guiaPonderacion.ok" @click="guardarPonderacion">
            {{ guardandoEsquema ? 'Guardando...' : 'Guardar ponderación' }}
          </button>
        </div>
      </div>

      <div v-else class="overflow-x-auto border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="bg-[#003B71] text-[10px] font-bold uppercase tracking-widest text-white">
            <tr>
              <th class="px-4 py-4">Estudiante</th>
              <th class="px-3 py-4 text-center">Asistencia<br /><span class="font-mono normal-case tracking-normal text-white/70">{{ esquema.asistencia }}%</span></th>
              <th v-for="item in esquema.items" :key="item.clave" class="px-3 py-4 text-center">
                {{ item.nombre || item.tipo }}<br /><span class="font-mono normal-case tracking-normal text-white/70">{{ item.puntaje }}%</span>
              </th>
              <th class="px-4 py-4 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="est in estudiantes" :key="est.inscripcion_id" class="border-t border-slate-100 dark:border-gray-800">
              <td class="px-4 py-3">
                <p class="font-bold text-[#003B71] dark:text-white">{{ est.nombre }}</p>
                <p class="text-[10px] text-slate-400">{{ est.email || (est.sin_cuenta ? 'Sin cuenta' : '') }}</p>
              </td>
              <td class="px-3 py-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">{{ est.asistencia == null ? '—' : est.asistencia }}</td>
              <td v-for="item in esquema.items" :key="item.clave" class="px-3 py-3 text-center">
                <input
                  :value="est.notas?.[item.clave] ?? ''"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  :disabled="guardando || !est.id_usuario"
                  class="box-border h-10 w-20 border border-slate-300 bg-white text-center font-mono text-sm font-bold dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  @change="guardarCelda(est, item.clave, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td class="px-4 py-3 text-center">
                <span class="bg-slate-100 px-3 py-1 font-mono text-xs font-bold dark:bg-gray-800">{{ est.total == null ? '—' : est.total }}</span>
              </td>
            </tr>
            <tr v-if="estudiantes.length === 0">
              <td :colspan="(esquema.items?.length || 0) + 3" class="px-4 py-16 text-center text-[10px] font-bold uppercase text-slate-400">No hay estudiantes activos</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
