<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useEventoStore } from '@/stores/eventoStore';

const { t } = useI18n();
const route = useRoute();
const eventoStore = useEventoStore();
const esPaginaEvento = computed(() => ['evento-publico', 'curso-publico'].includes(String(route.name)));
const evento = computed(() => {
  const id = route.name === 'evento-publico' ? Number(route.params.eventoId)
    : route.name === 'curso-publico' ? eventoStore.eventosPorCurso[Number(route.params.id)] : null;
  return id ? eventoStore.eventosAplanados.find(item => Number(item.id) === id) : null;
});
const mostrarContacto = computed(() => !esPaginaEvento.value || evento.value?.secciones?.contacto !== false);
const direccion = computed(() => [evento.value?.direccion, evento.value?.ubicacion].find(value => String(value || '').trim()));
const organizadores = computed<{ nombre: string; link: string }[]>(() => {
  let raw: unknown = evento.value?.organizadores;
  if (typeof raw === 'string') {
    const texto = raw.trim();
    if (!texto || texto === 'null') return [];
    try { raw = JSON.parse(texto); } catch { raw = texto.split(/[,;\n]/); }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    const nombre = String(typeof item === 'string' ? item : item?.nombre || '').trim();
    const link = typeof item === 'object' ? String(item?.link || '').trim() : '';
    return { nombre, link: /^https?:\/\//i.test(link) ? link : '' };
  }).filter(item => item.nombre);
});
const instituciones = [{ nombre: 'UMSA', link: 'https://www.umsa.bo/' }, { nombre: 'FCPN', link: 'https://www.fcpn.edu.bo/' }];
</script>

<template>
  <VSheet tag="footer" id="footer" class="scroll-mt-24 bg-primary-dark dark:bg-gray-900 text-white pt-16 pb-8 transition-colors duration-300">
    <div class="container mx-auto px-4 lg:px-8">
      <p class="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200 mb-8">Validado por la Universidad Mayor de San Andrés y la Facultad de Ciencias Puras y Naturales</p>
      <div v-if="mostrarContacto" class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 class="font-bold text-lg mb-4 border-b-2 border-umsa-blue dark:border-blue-500 pb-2 inline-block">{{ t('footer.where_we_are') }}</h3>
          <p class="text-gray-300 leading-relaxed whitespace-pre-line">{{ esPaginaEvento ? direccion || 'Ubicación por confirmar.' : t('footer.address') }}</p>
        </div>
        <div>
          <h3 class="font-bold text-lg mb-4 border-b-2 border-umsa-blue dark:border-blue-500 pb-2 inline-block">{{ t('footer.contact_us') }}</h3>
          <template v-if="esPaginaEvento">
            <p v-if="evento?.telefono" class="text-gray-300 leading-relaxed">{{ t('footer.phone') }}: <a :href="`tel:${evento.telefono}`" class="hover:underline">{{ evento.telefono }}</a></p>
            <p v-if="evento?.email" class="text-gray-300 leading-relaxed">{{ t('footer.email') }}: <a :href="`mailto:${evento.email}`" class="hover:underline">{{ evento.email }}</a></p>
            <p v-if="!evento?.telefono && !evento?.email" class="text-gray-300 leading-relaxed">Contacto por confirmar.</p>
          </template>
          <p v-else class="text-gray-300 leading-relaxed">www.umsa.bo · www.fcpn.edu.bo</p>
        </div>
        <div>
          <h3 class="font-bold text-lg mb-4 border-b-2 border-umsa-blue dark:border-blue-500 pb-2 inline-block">{{ t('footer.organization') }}</h3>
          <div v-if="esPaginaEvento && organizadores.length" class="flex flex-wrap items-center gap-6 text-gray-300 leading-relaxed font-semibold">
            <template v-for="(organizador, index) in organizadores" :key="index">
              <a v-if="organizador.link" :href="organizador.link" target="_blank" rel="noopener noreferrer" class="hover:underline">{{ organizador.nombre }}</a>
              <span v-else>{{ organizador.nombre }}</span>
            </template>
          </div>
          <p v-else-if="esPaginaEvento" class="text-gray-300 leading-relaxed">Organización y auspicio por confirmar.</p>
          <div v-else class="flex flex-wrap items-center gap-6 text-gray-300 leading-relaxed font-semibold">
            <a v-for="institucion in instituciones" :key="institucion.nombre" :href="institucion.link" target="_blank" rel="noopener noreferrer" class="hover:underline">{{ institucion.nombre }}</a>
          </div>
        </div>
      </div>
    </div>
  </VSheet>
</template>
