<template>
  <VCard class="mx-auto mt-4 w-full max-w-lg rounded-2xl bg-white p-5 text-center shadow-md sm:mt-10 sm:p-6">
    <h1 class="mb-4 text-xl font-bold text-gray-800 sm:text-2xl">Mi Código QR</h1>
    <p class="mb-6 text-sm text-gray-600 sm:text-base">Muestra este código al docente o personal de logística para registrar tu asistencia.</p>
    
    <div v-if="loading" class="flex justify-center my-10">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="text-red-500 my-10">
      {{ error }}
      <br>
      <VBtn @click="fetchQr" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Reintentar</VBtn>
    </div>

    <div v-else class="flex flex-col items-center">
      <div class="inline-block max-w-full rounded-xl border-4 border-indigo-100 bg-white p-3 shadow-inner sm:p-4">
        <qrcode-vue :value="qrToken" :size="220" level="H" class="mx-auto max-w-full" />
      </div>
      <p class="mt-4 text-xs text-gray-400 sm:text-sm">Este código se actualiza automáticamente cada 5 minutos por seguridad.</p>
    </div>
  </VCard>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import QrcodeVue from 'qrcode.vue';
import { QrService } from '@/services/qr.service';

const qrToken = ref('');
const loading = ref(true);
const error = ref('');
let intervalId: ReturnType<typeof setInterval>;

const fetchQr = async () => {
  loading.value = true;
  error.value = '';
  try {
    const data = await QrService.getEstudianteQr();
    qrToken.value = data.qr_token;
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Error al obtener el código QR';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchQr();
  // Refrescar cada 4.5 minutos (270,000 ms) antes de que expire a los 5 minutos
  intervalId = setInterval(fetchQr, 270000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>
