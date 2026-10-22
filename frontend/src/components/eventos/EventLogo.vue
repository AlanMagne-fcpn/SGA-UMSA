<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{ src?: string | null; nombre: string }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
const iniciales = computed(() => String(props.nombre || 'Evento').trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toLocaleUpperCase('es'));
</script>

<template>
  <span class="inline-flex shrink-0 items-center justify-center overflow-hidden bg-white text-xs text-[#0070BB]" :title="!src || failed ? `${nombre}: logo no disponible` : nombre">
    <img v-if="src && !failed" :key="src" :src="src" :alt="`Logo de ${nombre}`" data-event-logo class="h-full w-full object-contain" @error="failed = true" />
    <span v-else role="img" :aria-label="`${nombre}: logo no disponible`" class="font-black leading-none">{{ iniciales }}</span>
  </span>
</template>
