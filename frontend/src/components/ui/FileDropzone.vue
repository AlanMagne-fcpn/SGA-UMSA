<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
  modelValue?: File | File[] | null;
  multiple?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
  maxMb?: number;
}>(), {
  modelValue: null,
  multiple: false,
  accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp',
  label: 'Archivos',
  hint: 'PDF, Word, Excel, JPG, PNG',
  maxMb: 25,
});

const emit = defineEmits<{
  'update:modelValue': [value: File | File[] | null];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const arrastrando = ref(false);

const lista = computed(() => {
  if (!props.modelValue) return [] as File[];
  return Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue];
});

function abrirSelector() {
  inputRef.value?.click();
}

function aceptar(files: FileList | File[] | null) {
  if (!files || !files.length) return;
  const maxBytes = props.maxMb * 1024 * 1024;
  const aceptados = Array.from(files).filter((file) => file.size <= maxBytes);
  if (!aceptados.length) return;
  if (props.multiple) {
    const actuales = Array.isArray(props.modelValue) ? props.modelValue : [];
    emit('update:modelValue', [...actuales, ...aceptados]);
  } else {
    emit('update:modelValue', aceptados[0] || null);
  }
}

function onChange(event: Event) {
  const input = event.target as HTMLInputElement;
  aceptar(input.files);
  input.value = '';
}

function onDrop(event: DragEvent) {
  arrastrando.value = false;
  aceptar(event.dataTransfer?.files || null);
}

function quitar(indice: number) {
  if (props.multiple) {
    const actuales = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    actuales.splice(indice, 1);
    emit('update:modelValue', actuales);
  } else {
    emit('update:modelValue', null);
  }
}

function peso(file: File) {
  return file.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(0)} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-sm font-bold text-[#1A4756] dark:text-slate-200">{{ label }} · {{ maxMb }} MB por archivo</p>
    <div
      class="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all"
      :class="arrastrando
        ? 'border-[#028191] bg-[#028191]/10'
        : 'border-[#028191]/40 bg-[#f4fbfd] hover:border-[#028191] hover:bg-[#028191]/5 dark:border-sky-800 dark:bg-slate-900/60'"
      role="button"
      tabindex="0"
      @click="abrirSelector"
      @keydown.enter.prevent="abrirSelector"
      @keydown.space.prevent="abrirSelector"
      @dragenter.prevent="arrastrando = true"
      @dragover.prevent="arrastrando = true"
      @dragleave.prevent="arrastrando = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="inputRef"
        type="file"
        class="sr-only"
        :accept="accept"
        :multiple="multiple"
        @change="onChange"
        @click.stop
      >
      <span class="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#028191] shadow-sm dark:bg-slate-800">
        <span class="material-symbols-outlined text-[26px]">upload_file</span>
      </span>
      <p class="text-sm font-black text-[#003B71] dark:text-white">Arrastra el documento aquí</p>
      <p class="mt-1 text-xs font-semibold text-slate-500">o haz clic para elegirlo · {{ hint }}</p>
    </div>
    <ul v-if="lista.length" class="space-y-2">
      <li
        v-for="(file, indice) in lista"
        :key="`${file.name}-${file.size}-${indice}`"
        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
      >
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <span class="material-symbols-outlined text-[18px]">description</span>
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold text-[#003B71] dark:text-white">{{ file.name }}</p>
          <p class="text-[11px] text-slate-500">{{ peso(file) }}</p>
        </div>
        <button type="button" class="rounded-full px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50" @click.stop="quitar(indice)">
          Quitar
        </button>
      </li>
    </ul>
  </div>
</template>
