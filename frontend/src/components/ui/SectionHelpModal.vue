<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  topics: { id: string; label: string; items: string[] }[];
  title?: string;
  context?: string;
}>();

const abierto = ref(false);
const temaId = ref<string | null>(null);

const temaActivo = computed(() => props.topics.find((t) => t.id === temaId.value) || null);

watch(
  () => props.topics,
  () => {
    if (temaId.value && !props.topics.some((t) => t.id === temaId.value)) {
      temaId.value = null;
    }
  },
);

function abrir() {
  temaId.value = null;
  abierto.value = true;
}

function cerrar() {
  abierto.value = false;
  temaId.value = null;
}

function elegir(id: string) {
  temaId.value = id;
}

function volverLista() {
  temaId.value = null;
}
</script>

<template>
  <span class="inline-flex items-center">
    <button
      type="button"
      class="btn-hint-pulse inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#0070bb]/40 bg-[#0070bb]/10 text-sm font-black text-[#0070bb] transition hover:bg-[#0070bb]/20"
      aria-label="Abrir ayuda"
      @click="abrir"
    >
      ?
    </button>

    <Teleport to="body">
      <div
        v-if="abierto"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-4"
        role="presentation"
        @click.self="cerrar"
      >
        <div
          class="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
          :aria-label="title || 'Ayuda'"
        >
          <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div class="min-w-0">
              <p class="text-[10px] font-black uppercase tracking-widest text-[#0070bb]">Ayuda</p>
              <h3 class="mt-1 text-lg font-black text-[#003B71] dark:text-white">
                {{ temaActivo ? temaActivo.label : (title || '¿Tiene duda con…?') }}
              </h3>
              <p v-if="!temaActivo && context" class="mt-1 text-xs font-semibold text-slate-500">{{ context }}</p>
            </div>
            <button
              type="button"
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Cerrar ayuda"
              @click="cerrar"
            >
              <span class="material-symbols-outlined text-[18px] leading-none">close</span>
            </button>
          </div>

          <div class="max-h-[60vh] overflow-y-auto px-5 py-4">
            <template v-if="!temaActivo">
              <p class="mb-3 text-sm text-slate-600 dark:text-slate-300">Elija el tema sobre el que quiere más detalle:</p>
              <ul class="space-y-2">
                <li v-for="tema in topics" :key="tema.id">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-[#0070bb] hover:bg-[#0070bb]/5 dark:border-slate-700 dark:bg-slate-800"
                    @click="elegir(tema.id)"
                  >
                    <span class="text-sm font-bold text-[#003B71] dark:text-white">{{ tema.label }}</span>
                    <span class="material-symbols-outlined text-[18px] text-[#0070bb]">chevron_right</span>
                  </button>
                </li>
              </ul>
            </template>

            <template v-else>
              <ul class="space-y-2.5 text-sm leading-snug text-slate-700 dark:text-slate-200">
                <li v-for="(item, i) in temaActivo.items" :key="i" class="flex gap-2">
                  <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0070bb]" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </template>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            <button
              v-if="temaActivo"
              type="button"
              class="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              @click="volverLista"
            >
              <span class="material-symbols-outlined text-[16px] leading-none">arrow_back</span>
              Otras dudas
            </button>
            <span v-else />
            <button
              type="button"
              class="rounded-xl bg-[#003B71] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white"
              @click="cerrar"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </span>
</template>
