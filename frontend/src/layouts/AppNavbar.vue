<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { useEventoStore } from '@/stores/eventoStore';
import { useAuthStore } from '@/stores/auth';
import { getImageUrl } from '@/services/api';

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const eventoStore = useEventoStore();
const authStore = useAuthStore();

// La identidad del sistema no depende del evento seleccionado.
const brandTitle = 'SGEA';
const brandDescription = computed(() => t('navbar.system_name'));

const navLinks = computed(() => [
  { name: t('navbar.home'), href: '/' },
  { name: t('navbar.events'), href: '/eventos' },
  { name: t('navbar.info'), href: `${route.params.eventoId ? `/eventos/${route.params.eventoId}` : '/eventos'}#informacion` },
  { name: t('navbar.organization'), href: `${route.params.eventoId ? `/eventos/${route.params.eventoId}` : '/eventos'}#organizacion` },
  { name: t('navbar.location'), href: `${route.params.eventoId ? `/eventos/${route.params.eventoId}` : '/eventos'}#ubicacion` },
  { name: t('navbar.contact'), href: `${route.params.eventoId ? `/eventos/${route.params.eventoId}` : '/eventos'}#footer` },
]);

const isMenuOpen = ref(false);
const isDark = ref(false);

const scrollTo = async (destination: string) => {
  isMenuOpen.value = false;
  const [path, hash] = destination.split('#');
  if (route.path !== path) await router.push(path || '/');
  await nextTick();
  if (hash) (document.getElementById(hash) || document.getElementById('eventos'))?.scrollIntoView({ behavior: 'smooth' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
};

const toggleDark = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
};

const toggleLang = () => {
  locale.value = locale.value === 'es' ? 'en' : 'es';
  localStorage.setItem('lang', locale.value);
};

onMounted(async () => {
  if (localStorage.getItem('theme') === 'dark') {
    isDark.value = true;
    document.documentElement.classList.add('dark');
  }
  
  if (eventoStore.eventosAplanados.length === 0) {
    await eventoStore.fetchEventosInfo();
  }
});
</script>

<template>
  <VSheet tag="nav" v-if="!authStore.isAuthenticated || ['/', '/login', '/register'].includes(route.path)"
       class="fixed top-0 left-0 right-0 z-[100] transition-all duration-500 bg-white/90 dark:bg-[#020810]/95 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50 shadow-md">
    <div class="w-full px-4 md:px-6">
      <div class="flex justify-between items-center h-16 md:h-18">
        
        <!-- SECCIÓN IZQUIERDA: IDENTIDAD DEL EVENTO (MINIMALISTA) -->
        <div class="flex items-center shrink-0 h-full">
          <RouterLink to="/" @click="isMenuOpen = false" class="flex items-center gap-2 group cursor-pointer">
            
            <!-- LOGO ESTÁTICO TRANSPARENTE -->
            <div class="relative flex items-center transition-all duration-300 group-hover:scale-105">
              <img src="/logo/logoOficial.png" 
                   class="h-10 md:h-12 w-auto object-contain" alt="SGEA" />
            </div>

            <!-- TEXTO DEL EVENTO (MINIATURA PREMIUM) -->
            <div class="flex flex-col items-start justify-center">
              <div data-system-brand class="text-sm md:text-lg font-black uppercase tracking-tighter italic leading-none text-[#0070BB]">
                {{ brandTitle }}
              </div>
              <h1 class="text-[6px] md:text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] leading-none max-w-[120px] md:max-w-[250px] truncate">
                {{ brandDescription }}
              </h1>
            </div>
          </RouterLink>
        </div>

        <!-- Middle: Navigation Links (Más Compactos) -->
        <div class="hidden 2xl:flex flex-1 justify-center px-1">
          <ul class="flex items-center gap-0.5">
            <li v-for="link in navLinks" :key="link.name">
              <a :href="link.href" 
                 @click.prevent="scrollTo(link.href)" 
                 class="relative px-3 py-1.5 text-[10px] xl:text-xs font-black text-slate-600 dark:text-slate-300 transition-all duration-500 uppercase tracking-widest hover:scale-105 rounded-lg group overflow-hidden">
                
                <span class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg"
                      :style="{ 
                        backgroundColor: isDark ? '#0ea5e908' : '#2563eb08',
                        boxShadow: isDark 
                          ? `inset 0 0 8px #0ea5e915`
                          : 'inset 0 0 8px #2563eb15'
                      }"></span>
                
                <span class="relative z-10 transition-all duration-300 group-hover:text-slate-900 dark:group-hover:text-sky-300 dark:group-hover:[text-shadow:0_0_5px_rgba(14,165,233,0.6)]">
                  {{ link.name }}
                </span>
              </a>
            </li>
          </ul>
        </div>

        <!-- Right: Actions (Legibilidad y Tamaño Premium) -->
        <div class="flex items-center gap-2 md:gap-3 shrink-0">
          
          <!-- BOTÓN IDIOMA (TEXTO COMPLETO Y MÁS GRANDE) -->
          <VBtn @click="toggleLang" class="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-xs font-black uppercase tracking-widest transition-all shadow-sm">
            <VIcon class="material-symbols-outlined text-base">language</VIcon>
            <span>{{ t('navbar.language') }}</span>
          </VBtn>

          <VBtn @click="toggleDark" :aria-label="isDark ? 'Activar modo claro' : 'Activar modo oscuro'" class="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-800/80 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm">
            <svg v-if="!isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </VBtn>

          <!-- Botones de Acceso (Tamaño Premium) -->
          <div class="flex items-center gap-2 ml-1 md:ml-2">
            <router-link to="/register" 
                         class="hidden xl:flex items-center justify-center gap-2 px-6 py-2.5 text-white rounded-full font-black text-[11px] md:text-xs tracking-widest uppercase transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95 shadow-md"
                         :style="{ 
                           background: isDark 
                             ? `linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)` 
                             : `linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)`,
                           boxShadow: isDark 
                             ? `0 4px 15px -1px rgba(14, 165, 233, 0.5)` 
                             : `0 4px 15px -1px rgba(14, 165, 233, 0.3)`
                         }">
              <VIcon class="material-symbols-outlined text-lg">person_add</VIcon>
              <span>{{ t('navbar.register') }}</span>
            </router-link>

            <router-link to="/login" 
                         class="hidden sm:flex items-center justify-center gap-2 px-8 py-2.5 text-white rounded-full font-black text-[11px] md:text-xs tracking-widest uppercase transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95 ml-1 shadow-md"
                         :style="{ 
                           background: isDark 
                             ? 'linear-gradient(135deg, #004a99 0%, #001a35 100%)'
                             : 'linear-gradient(135deg, #002a52 0%, #010a14 100%)',
                           boxShadow: isDark 
                             ? `0 6px 18px -3px rgba(14, 165, 233, 0.4)`
                             : '0 6px 18px -3px rgba(0,0,0,0.2)'
                         }">
              <VIcon class="material-symbols-outlined text-lg">lock</VIcon>
              <span>{{ t('navbar.login') }}</span>
            </router-link>
          </div>
          
          <!-- LOGOS INSTITUCIONALES (TAMAÑO EQUILIBRADO) -->
          <div class="hidden sm:flex items-center gap-2 border-l pl-4 border-slate-200 dark:border-slate-800 ml-1">
              <a href="https://www.fcpn.edu.bo/" target="_blank" 
                 class="w-10 h-10 flex items-center justify-center hover:scale-110 transition-all cursor-pointer">
                <img :src="getImageUrl('logo', 'EscudoFCPN.png')" 
                     class="w-full h-full object-contain dark:opacity-90" alt="FCPN" />
              </a>
              <a href="https://www.umsa.bo/" target="_blank" 
                 class="w-10 h-10 rounded-full border border-slate-100 dark:border-slate-700 p-1 flex items-center justify-center bg-white dark:bg-slate-900 shadow-sm hover:scale-110 transition-all cursor-pointer">
                <img :src="getImageUrl('logo', 'LOGO UMSA OFICIAL.png')" 
                     class="w-full h-full object-contain dark:opacity-90" alt="UMSA" />
              </a>
          </div>

          <!-- BOTÓN MENÚ MÓVIL (HAMBURGUESA) -->
          <VBtn @click="isMenuOpen = !isMenuOpen"
                  class="2xl:hidden p-2 ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
            <VIcon class="material-symbols-outlined text-2xl">
              {{ isMenuOpen ? 'close' : 'menu' }}
            </VIcon>
          </VBtn>
        </div>
      </div>

      <!-- MENÚ MÓVIL DESPLEGABLE (PREMIUM) -->
      <div v-show="isMenuOpen" 
           class="2xl:hidden absolute top-full left-0 right-0 bg-white/95 dark:bg-[#020810]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all duration-300">
        <div class="px-6 py-8 flex flex-col gap-6">
          
          <!-- Enlaces de Navegación -->
          <ul class="flex flex-col gap-4">
            <li v-for="link in navLinks" :key="link.name">
              <a :href="link.href" 
                 @click.prevent="scrollTo(link.href)" 
                 class="flex items-center justify-between text-base font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest hover:text-sky-500 dark:hover:text-sky-400 transition-colors">
                {{ link.name }}
                <VIcon class="material-symbols-outlined text-slate-400">chevron_right</VIcon>
              </a>
            </li>
          </ul>

          <div class="h-px bg-slate-200 dark:bg-slate-800 w-full"></div>

          <!-- Acciones en Móvil -->
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <VBtn @click="toggleLang" class="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                <VIcon class="material-symbols-outlined text-lg">language</VIcon>
                {{ t('navbar.language') }}
              </VBtn>
              <VBtn @click="toggleDark" :aria-label="isDark ? 'Activar modo claro' : 'Activar modo oscuro'" class="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700">
                <VIcon class="material-symbols-outlined text-xl">{{ isDark ? 'light_mode' : 'dark_mode' }}</VIcon>
              </VBtn>
            </div>

            <router-link to="/register" 
                         @click="isMenuOpen = false"
                         class="flex items-center justify-center gap-3 py-4 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-lg"
                         :style="{ background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)' }">
              <VIcon class="material-symbols-outlined">person_add</VIcon>
              {{ t('navbar.register') }}
            </router-link>

            <router-link to="/login" 
                         @click="isMenuOpen = false"
                         class="flex items-center justify-center gap-3 py-4 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-lg"
                         :style="{ 
                           background: 'linear-gradient(135deg, #004a99 0%, #001a35 100%)'
                         }">
              <VIcon class="material-symbols-outlined">lock</VIcon>
              {{ t('navbar.login') }}
            </router-link>
          </div>

          <!-- Logos Institucionales en Móvil -->
          <div class="flex justify-center items-center gap-6 pt-4">
             <a href="https://www.fcpn.edu.bo/" target="_blank">
               <img :src="getImageUrl('logo', 'EscudoFCPN.png')" class="h-10 w-auto opacity-70" alt="FCPN" />
             </a>
             <a href="https://www.umsa.bo/" target="_blank">
               <img :src="getImageUrl('logo', 'LOGO UMSA OFICIAL.png')" class="h-10 w-auto opacity-70" alt="UMSA" />
             </a>
          </div>
        </div>
      </div>
    </div>
  </VSheet>
</template>
