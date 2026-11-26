<script setup lang="ts">
import { computed, watch } from 'vue';
import {
  aulaInicial,
  esPresencial,
  esquemaInicial,
  aplicarPesoEsquema,
  guiaEvaluacion,
  mensajePonderacion,
  modoEvaluacion,
  modoPorTipo,
  nuevaClaveItem,
  permisosContenido,
  sumaEsquema,
  type TipoItem,
} from '@/utils/activityLearning';
import SectionHelpModal from '@/components/ui/SectionHelpModal.vue';

const requisitos = defineModel<any>({ required: true });
const props = defineProps<{ activityType: string; modalidad?: string; busy?: boolean }>();
const modo = computed(() => modoEvaluacion(props.activityType, requisitos.value));
const guia = computed(() => guiaEvaluacion(props.activityType, requisitos.value));
const permisos = computed(() => permisosContenido(props.activityType, requisitos.value));
const presencial = computed(() => modo.value === 'curso' && esPresencial(props.modalidad));
const esquema = computed(() => requisitos.value?.evaluacion);
const suma = computed(() => (esquema.value ? sumaEsquema(esquema.value) : 0));
const editaNotas = computed(() => modo.value === 'curso' || modo.value === 'configurable');

watch(
  () => props.activityType,
  () => {
    const siguiente = modoPorTipo(props.activityType);
    const actual = requisitos.value?.evaluacion?.modo;
    if (actual === siguiente) {
      const aula = { ...(requisitos.value?.aula || {}), video: false };
      if (requisitos.value?.aula?.video !== false) {
        requisitos.value = { ...requisitos.value, aula };
      }
      return;
    }
    if (actual === 'configurable' && siguiente === 'asistencia' && String(props.activityType || '').trim().toLowerCase() !== 'otro') {
      return;
    }
    requisitos.value = { ...requisitos.value, evaluacion: esquemaInicial(siguiente), aula: aulaInicial(siguiente) };
  },
  { immediate: true },
);

function sincronizarAula(parcial: { material?: boolean; practica?: boolean }) {
  const actuales = permisos.value;
  const material = parcial.material ?? actuales.material;
  const practica = parcial.practica ?? actuales.practica;
  const examen = modo.value === 'curso' || (esquema.value?.items || []).some((item: any) => item.tipo === 'examen' || item.tipo === 'seccion');
  const aula = { video: false, material, practica, examen };
  const bloques = {
    ...(esquema.value?.bloques || {}),
    contenido: material,
    practica,
    examen: examen || esquema.value?.bloques?.examen === true,
    secciones: esquema.value?.bloques?.secciones === true,
    laboratorio: false,
  };
  const items = (esquema.value?.items || []).filter((item: any) => {
    if (item.tipo === 'practica') return practica;
    return true;
  });
  requisitos.value = {
    ...requisitos.value,
    aula,
    evaluacion: { ...(esquema.value || {}), bloques, items },
  };
}

function itemBase(tipo: TipoItem, nombre: string, puntaje: number) {
  return { clave: nuevaClaveItem(), tipo, nombre, puntaje, plazo: null };
}

function aplicarEsquemaBalanceado(origen: 'asistencia' | string, valor: number) {
  const base = {
    ...esquema.value,
    items: (esquema.value.items || []).map((item: any) => ({ ...item })),
  };
  const balanceado = aplicarPesoEsquema(base, origen, valor);
  requisitos.value = {
    ...requisitos.value,
    evaluacion: {
      ...base,
      asistencia: balanceado.asistencia,
      items: balanceado.items,
    },
  };
}

function agregarItem(tipo: TipoItem = 'examen') {
  const n = tipo === 'practica' ? itemsPractica.value.length + 1 : itemsParcial.value.length + 1;
  const nombre = tipo === 'practica' ? `Práctica ${n}` : `${n}º parcial`;
  const nuevo = itemBase(tipo, nombre, 0);
  const practica = tipo === 'practica' ? true : permisos.value.practica;
  const base = {
    ...esquema.value,
    bloques: { ...esquema.value.bloques, practica: practica || esquema.value.bloques?.practica, examen: true, laboratorio: false },
    items: [...(esquema.value.items || []), nuevo],
  };
  const balanceado = aplicarPesoEsquema(base, nuevo.clave, 10);
  requisitos.value = {
    ...requisitos.value,
    aula: { ...(requisitos.value.aula || {}), video: false, practica, examen: true, material: requisitos.value.aula?.material !== false },
    evaluacion: {
      ...base,
      asistencia: balanceado.asistencia,
      items: balanceado.items,
    },
  };
}

function quitarItem(index: number) {
  const items = esquema.value.items.filter((_: any, i: number) => i !== index);
  requisitos.value = { ...requisitos.value, evaluacion: { ...esquema.value, items } };
}

function actualizarAsistencia(valor: number) {
  aplicarEsquemaBalanceado('asistencia', Number.isFinite(valor) ? valor : 0);
}

function actualizarPuntaje(clave: string, valor: number) {
  aplicarEsquemaBalanceado(clave, Number.isFinite(valor) ? valor : 0);
}

function aplicarPlantilla(nombre: 'clasico' | 'practica' | 'examenes') {
  const plantillas = {
    clasico: {
      asistencia: 20,
      items: [
        itemBase('examen', '1er parcial', 25),
        itemBase('examen', '2do parcial', 25),
        itemBase('practica', 'Práctica 1', 30),
      ],
    },
    practica: {
      asistencia: 20,
      items: [
        itemBase('examen', '1er parcial', 20),
        itemBase('practica', 'Práctica 1', 30),
        itemBase('practica', 'Práctica 2', 30),
      ],
    },
    examenes: {
      asistencia: 20,
      items: [
        itemBase('examen', '1er parcial', 40),
        itemBase('examen', '2do parcial', 40),
      ],
    },
  } as const;
  const elegida = plantillas[nombre];
  const tienePractica = elegida.items.some((item) => item.tipo === 'practica');
  requisitos.value = {
    ...requisitos.value,
    aula: { video: false, material: true, practica: tienePractica, examen: true },
    evaluacion: {
      ...esquema.value,
      modo: modo.value,
      bloques: { contenido: true, secciones: true, practica: tienePractica, laboratorio: false, examen: true },
      asistencia: elegida.asistencia,
      items: elegida.items,
    },
  };
}

function pct(valor: unknown) {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

const itemsConIndice = computed(() =>
  (Array.isArray(esquema.value?.items) ? esquema.value.items : []).map((item: any, index: number) => ({ item, index })),
);
const itemsParcial = computed(() => itemsConIndice.value.filter(({ item }) => item.tipo === 'examen' || item.tipo === 'seccion'));
const itemsPractica = computed(() => itemsConIndice.value.filter(({ item }) => item.tipo === 'practica'));
const sumaAsistencia = computed(() => pct(esquema.value?.asistencia));
const sumaParciales = computed(() => pct(itemsParcial.value.reduce((acc, { item }) => acc + Number(item.puntaje || 0), 0)));
const sumaPracticas = computed(() => pct(itemsPractica.value.reduce((acc, { item }) => acc + Number(item.puntaje || 0), 0)));
const guiaPonderacion = computed(() =>
  esquema.value
    ? mensajePonderacion(esquema.value)
    : { ok: false as const, falta: 100, texto: 'Configure la ponderación.', corto: 'Configure la ponderación.' },
);

const temasAyuda = computed(() => {
  const temas = [
    { id: 'califica', label: 'Cómo se califica', items: guia.value.comoSeCalifica },
    { id: 'certificados', label: 'Certificados', items: guia.value.certificados },
    { id: 'configuras', label: 'Qué configuras aquí', items: guia.value.queConfiguras },
  ];
  if (editaNotas.value) {
    temas.push(
      { id: 'ponderacion', label: 'Ponderación de la nota', items: ['Reparte el 100% entre asistencia, parciales y prácticas.', 'Sin fechas aquí: solo pesos de la nota.', 'El docente carga notas y publica prácticas en el aula.'] },
      { id: 'asistencia', label: 'Asistencia en la nota', items: ['Porcentaje de la nota final por asistencia.', 'Logística o el ponente registra por sesión (PIN/lista).'] },
      { id: 'parciales', label: 'Parciales', items: ['Subdivide el % de parciales en uno o más exámenes.', 'Pueden rendirse de forma presencial.'] },
      { id: 'practicas', label: 'Prácticas', items: ['El docente publica tareas tipo Classroom y revisa entregas.', 'Solo afectan la nota si les asignas % en la ponderación.'] },
      { id: 'material', label: 'Material de apoyo', items: ['PDF, Word, Excel, imágenes y enlaces.', 'No cuenta para la nota; es apoyo para los participantes.', 'Sin videos.'] },
    );
  }
  return temas;
});
</script>

<template>
  <section aria-label="Contenido del docente" class="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 text-slate-900 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-white">
    <div class="space-y-5 p-5 md:p-6">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0070bb]">Reglas de evaluación</p>
            <SectionHelpModal
              title="¿Tiene duda con…?"
              :context="guia.titulo"
              :topics="temasAyuda"
            />
          </div>
          <h3 class="mt-1 text-lg font-black uppercase italic tracking-tight text-[#003B71] dark:text-white">{{ guia.titulo }}</h3>
          <p class="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Esquema típico: {{ guia.tipico }}</p>
          <p v-if="presencial" class="mt-1 text-xs font-medium text-[#0070bb]">Presencial: material/prácticas en aula virtual; parciales pueden ser en aula física.</p>
        </div>
      </header>

      <p
        v-if="modo === 'asistencia'"
        class="rounded-xl border border-[#0070bb]/25 bg-[#0070bb]/5 px-3 py-2 text-sm text-[#003B71] dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100"
      >
        <strong class="font-black uppercase tracking-wide">Nota fija:</strong>
        100% asistencia. No hace falta repartir parciales ni prácticas.
      </p>

      <div v-if="editaNotas" class="grid gap-3 sm:grid-cols-2">
        <label class="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <input type="checkbox" aria-label="Prácticas" :checked="permisos.practica" :disabled="busy" class="mt-1 h-4 w-4 accent-[#0070bb]" @change="sincronizarAula({ practica: ($event.target as HTMLInputElement).checked })" />
          <span class="min-w-0 flex-1">
            <strong class="block text-sm">Prácticas</strong>
            <span class="mt-1 block text-sm text-slate-600 dark:text-slate-300">Tareas con entrega en el aula.</span>
          </span>
        </label>
        <label class="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <input type="checkbox" aria-label="Permitir archivos" :checked="permisos.material" :disabled="busy" class="mt-1 h-4 w-4 accent-[#0070bb]" @change="sincronizarAula({ material: ($event.target as HTMLInputElement).checked })" />
          <span class="min-w-0 flex-1">
            <strong class="block text-sm">Material de apoyo</strong>
            <span class="mt-1 block text-sm text-slate-600 dark:text-slate-300">Archivos y enlaces. Sin videos.</span>
          </span>
        </label>
      </div>

      <div v-if="editaNotas && esquema" class="space-y-5">
        <div class="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0070bb]">Ponderación</p>
            <h4 class="mt-1 text-xl font-black uppercase italic text-[#003B71] dark:text-white">100 puntos = 100%</h4>
          </div>
          <div class="text-right">
            <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">Total</p>
            <p class="text-4xl font-black leading-none" :class="suma === 100 ? 'text-emerald-700' : 'text-rose-700'">{{ suma }}%</p>
          </div>
        </div>

        <div class="flex h-2 overflow-hidden bg-slate-200 dark:bg-slate-800" aria-hidden="true">
          <div class="bg-[#0070bb]" :style="{ width: Math.min(100, sumaAsistencia) + '%' }" />
          <div class="bg-[#003B71]" :style="{ width: Math.min(100, sumaParciales) + '%' }" />
          <div class="bg-[#BC9C31]" :style="{ width: Math.min(100, sumaPracticas) + '%' }" />
        </div>
        <div class="flex flex-wrap gap-5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          <span>Asistencia {{ sumaAsistencia }}%</span>
          <span>Parciales {{ sumaParciales }}%</span>
          <span>Prácticas {{ sumaPracticas }}%</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="border border-slate-400 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-slate-600 dark:bg-slate-900" :disabled="busy" @click="aplicarPlantilla('clasico')">Clásico 20·25·25·30</button>
          <button type="button" class="border border-slate-400 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-slate-600 dark:bg-slate-900" :disabled="busy" @click="aplicarPlantilla('practica')">Más práctica</button>
          <button type="button" class="border border-slate-400 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-slate-600 dark:bg-slate-900" :disabled="busy" @click="aplicarPlantilla('examenes')">Solo parciales</button>
        </div>

        <div class="grid gap-px overflow-hidden border border-slate-300 bg-slate-300 dark:border-slate-700 dark:bg-slate-700 lg:grid-cols-3">
          <section class="bg-white p-5 dark:bg-slate-900">
            <div class="flex items-baseline justify-between gap-3">
              <h5 class="font-serif text-xl text-[#003B71] dark:text-white">Asistencia</h5>
              <span class="font-mono text-lg font-bold text-[#0070bb]">{{ sumaAsistencia }}%</span>
            </div>
            <label class="mt-4 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              % nota final
              <input
                :value="esquema.asistencia"
                type="number"
                min="0"
                max="100"
                step="0.01"
                aria-label="Porcentaje de asistencia"
                class="mt-2 w-full border border-slate-300 bg-[#f7f8fa] px-3 py-3 font-mono text-xl font-bold dark:border-slate-600 dark:bg-slate-950"
                :disabled="busy"
                @input="actualizarAsistencia(Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </section>

          <section class="bg-white p-5 dark:bg-slate-900">
            <div class="flex items-baseline justify-between gap-3">
              <h5 class="font-serif text-xl text-[#003B71] dark:text-white">Parciales</h5>
              <span class="font-mono text-lg font-bold text-[#003B71] dark:text-sky-300">{{ sumaParciales }}%</span>
            </div>
            <ul class="mt-4 space-y-3">
              <li v-for="({ item, index }, i) in itemsParcial" :key="item.clave || index" class="grid grid-cols-[minmax(0,1fr)_72px_auto] items-center gap-2">
                <input :aria-label="'Nombre del parcial ' + (i + 1)" v-model="item.nombre" placeholder="1er parcial" class="border border-slate-300 bg-[#f7f8fa] px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-950" />
                <input
                  :aria-label="'Ponderación del parcial ' + (i + 1)"
                  :value="item.puntaje"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="border border-slate-300 bg-[#f7f8fa] px-2 py-2 text-center font-mono text-sm font-bold dark:border-slate-600 dark:bg-slate-950"
                  :disabled="busy"
                  @input="actualizarPuntaje(item.clave, Number(($event.target as HTMLInputElement).value))"
                />
                <button type="button" class="text-[10px] font-bold uppercase text-rose-700" :disabled="busy" @click="quitarItem(index)">Quitar</button>
              </li>
            </ul>
            <p v-if="!itemsParcial.length" class="mt-4 text-sm text-slate-400">Sin parciales.</p>
            <button type="button" class="mt-4 text-sm font-semibold text-[#0070bb]" :disabled="busy" @click="agregarItem('examen')">+ Parcial</button>
          </section>

          <section class="bg-white p-5 dark:bg-slate-900">
            <div class="flex items-baseline justify-between gap-3">
              <h5 class="font-serif text-xl text-[#003B71] dark:text-white">Prácticas</h5>
              <span class="font-mono text-lg font-bold text-[#BC9C31]">{{ sumaPracticas }}%</span>
            </div>
            <ul class="mt-4 space-y-3">
              <li v-for="({ item, index }, i) in itemsPractica" :key="item.clave || index" class="grid grid-cols-[minmax(0,1fr)_72px_auto] items-center gap-2">
                <input :aria-label="'Nombre de la práctica ' + (i + 1)" v-model="item.nombre" placeholder="Práctica 1" class="border border-slate-300 bg-[#f7f8fa] px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-950" />
                <input
                  :aria-label="'Ponderación de la práctica ' + (i + 1)"
                  :value="item.puntaje"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="border border-slate-300 bg-[#f7f8fa] px-2 py-2 text-center font-mono text-sm font-bold dark:border-slate-600 dark:bg-slate-950"
                  :disabled="busy"
                  @input="actualizarPuntaje(item.clave, Number(($event.target as HTMLInputElement).value))"
                />
                <button type="button" class="text-[10px] font-bold uppercase text-rose-700" :disabled="busy" @click="quitarItem(index)">Quitar</button>
              </li>
            </ul>
            <p v-if="!itemsPractica.length" class="mt-4 text-sm text-slate-400">Sin prácticas en la nota.</p>
            <button type="button" class="mt-4 text-sm font-semibold text-[#0070bb]" :disabled="busy" @click="agregarItem('practica')">+ Práctica</button>
          </section>
        </div>

        <div
          class="border px-4 py-3 text-sm"
          :class="guiaPonderacion.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'"
        >
          <p class="font-bold">{{ guiaPonderacion.corto }}</p>
          <p class="mt-1">{{ guiaPonderacion.texto }}</p>
          <p v-if="!guiaPonderacion.ok" class="mt-1 text-xs opacity-90">
            Resumen: Asistencia {{ sumaAsistencia }}% · Parciales {{ sumaParciales }}% · Prácticas {{ sumaPracticas }}%.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
