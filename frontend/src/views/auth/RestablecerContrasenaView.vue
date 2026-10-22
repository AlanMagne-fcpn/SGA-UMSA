<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api';
import Swal from '@/services/dialogs';

const route = useRoute();
const router = useRouter();
const password = ref('');
const confirmar = ref('');
const enviando = ref(false);
const token = String(route.query.token || '');

const guardar = async () => {
  if (password.value.length < 8) {
    Swal.fire('Contraseña corta', 'Usa al menos 8 caracteres.', 'warning');
    return;
  }
  if (password.value !== confirmar.value) {
    Swal.fire('No coinciden', 'Escribe la misma contraseña en ambos campos.', 'warning');
    return;
  }
  if (!token) {
    Swal.fire('Enlace inválido', 'Pide un nuevo enlace desde tu perfil.', 'error');
    return;
  }
  enviando.value = true;
  try {
    await api.post('/auth/reset-password', { token, nueva_password: password.value });
    await Swal.fire('Contraseña actualizada', 'Ya puedes entrar con la nueva contraseña.', 'success');
    router.push('/login');
  } catch (error: any) {
    Swal.fire('No se pudo guardar', error?.response?.data?.message || 'El enlace venció. Pide otro.', 'error');
  } finally {
    enviando.value = false;
  }
};
</script>

<template>
  <main class="min-h-[100svh] bg-slate-100 flex items-center justify-center px-6 pb-8 pt-24 md:pt-28">
    <form class="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm space-y-4" @submit.prevent="guardar">
      <h1 class="text-xl font-black uppercase text-slate-800">Nueva contraseña</h1>
      <p class="text-sm text-slate-500">Este enlace confirma que el correo de la cuenta es tuyo.</p>
      <UiInput v-model="password" type="password" placeholder="Nueva contraseña" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
      <UiInput v-model="confirmar" type="password" placeholder="Confirmar contraseña" class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
      <VBtn type="submit" :disabled="enviando" class="w-full rounded-xl bg-slate-900 text-white py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50">
        Guardar contraseña
      </VBtn>
    </form>
  </main>
</template>
