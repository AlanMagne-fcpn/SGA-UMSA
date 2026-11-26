<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import api from '@/services/api';
import Swal from '@/services/dialogs';

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();
const profilePhotoUrl = ref('');

const loadPhoto = async () => {
  try {
    const photoRes = await api.get('/usuarios/perfil/foto', { responseType: 'arraybuffer' });
    if (photoRes.status === 200 && photoRes.data && photoRes.data.byteLength > 0) {
      const text = new TextDecoder().decode(photoRes.data);
      if (text !== 'NONE') {
        const blob = new Blob([photoRes.data], { type: (photoRes.headers['content-type'] as any) || 'image/jpeg' });
        if (profilePhotoUrl.value) URL.revokeObjectURL(profilePhotoUrl.value);
        profilePhotoUrl.value = URL.createObjectURL(blob);
      }
    }
  } catch (e) {
    console.error('Error loading photo in sidebar', e);
  }
};

onMounted(() => {
  loadPhoto();
});

const navigate = (routeName: string) => {
  uiStore.closeSidebar();
  router.push({ name: routeName });
};

const handleLogout = () => {
  uiStore.closeSidebar();
  authStore.logout();
  router.push('/login');
};

const cambiarRol = async () => {
  const roles = authStore.userRoles;
  if (roles.length <= 1) return;

  let rolActual = '';
  const path = router.currentRoute.value.path;
  if (path.startsWith('/coordinador')) rolActual = 'Coordinador';
  else if (path.startsWith('/estudiante')) rolActual = 'Estudiante';
  else if (path.startsWith('/ponente')) rolActual = 'Ponente';
  else if (path.startsWith('/logistica')) rolActual = 'Logística';
  else if (path.startsWith('/admin')) rolActual = 'Super Usuario';

  if (roles.length === 2) {
    const otroRol = roles.find(r => r !== rolActual) || roles[0];
    let targetPath = '/estudiante';
    if (otroRol === 'Coordinador') targetPath = '/coordinador';
    else if (otroRol === 'Ponente') targetPath = '/ponente';
    else if (otroRol === 'Logística') targetPath = '/logistica';
    else if (otroRol === 'Super Usuario') targetPath = '/admin';

    authStore.cambiarRolActivo(otroRol as string);
    router.push(targetPath);
    uiStore.closeSidebar();
    return;
  }

  const rolConfig: Record<string, { label: string, path: string, icon: string, color: string }> = {
    'Coordinador': { label: 'Coordinador', path: '/coordinador', icon: 'manage_accounts', color: '#0ea5e9' },
    'Estudiante': { label: 'Estudiante', path: '/estudiante', icon: 'school', color: '#10b981' },
    'Ponente': { label: 'Expositor / Ponente', path: '/ponente', icon: 'co_present', color: '#3b82f6' },
    'Logística': { label: 'Personal de Apoyo', path: '/logistica', icon: 'support_agent', color: '#14b8a6' },
    'Super Usuario': { label: 'Administrador', path: '/admin', icon: 'shield_person', color: '#ef4444' }
  };

  const htmlButtons = roles.map(r => {
    const config = rolConfig[r] || { label: r, path: '/', icon: 'account_circle', color: '#64748b' };
    const isCurrent = r === rolActual;
    return `
      <button data-role="${r}" data-path="${config.path}" class="swal-role-btn w-full flex items-center justify-between p-4 mb-2.5 rounded-2xl border-2 transition-all ${
        isCurrent 
          ? 'border-slate-300 bg-slate-50 dark:bg-gray-800 opacity-60 cursor-default' 
          : 'border-slate-100 hover:border-blue-400 bg-white dark:bg-gray-900 cursor-pointer shadow-sm hover:shadow'
      }">
        <div class="flex items-center gap-3 text-left">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style="background-color: ${config.color}">
            <span class="material-symbols-outlined text-[20px]">${config.icon}</span>
          </div>
          <span class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">${config.label}</span>
        </div>
        ${isCurrent ? '<span class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-gray-800 px-2 py-1 rounded">Activo</span>' : '<span class="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>'}
      </button>
    `;
  }).join('');

  Swal.fire({
    title: '<span class="text-[#003a70] dark:text-white uppercase font-black tracking-tight text-lg">Cambiar Portal de Acceso</span>',
    html: `
      <div class="text-left py-2">
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Selecciona el rol con el que deseas trabajar:</p>
        <div class="flex flex-col">${htmlButtons}</div>
      </div>
    `,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    cancelButtonColor: '#64748b',
    didOpen: () => {
      const container = Swal.getHtmlContainer();
      if (container) {
        const buttons = container.querySelectorAll('.swal-role-btn');
        buttons.forEach(btn => {
          btn.addEventListener('click', () => {
            const role = btn.getAttribute('data-role');
            const targetPath = btn.getAttribute('data-path');
            if (role && targetPath && role !== rolActual) {
              authStore.cambiarRolActivo(role);
              router.push(targetPath);
              uiStore.closeSidebar();
              Swal.close();
            }
          });
        });
      }
    }
  });
};
</script>

<template>
  <VSheet tag="aside" :class="[
    uiStore.isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
    'fixed bottom-0 left-0 top-[75px] z-[110] flex w-[min(18rem,85vw)] flex-col overflow-y-auto overscroll-contain border-r border-slate-200 bg-white px-4 py-6 text-slate-600 transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 sm:w-72 sm:py-8 lg:shadow-none'
  ]">
    <div class="mb-8 rounded-2xl border border-sky-100 bg-sky-50 p-4 dark:border-sky-900/30 dark:bg-sky-900/15">
      <div class="mb-2 flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-umsa-blue text-sm font-black text-white shadow-lg">
          <img v-if="profilePhotoUrl" :src="profilePhotoUrl" alt="Foto" class="h-full w-full object-cover" />
          <VIcon v-else class="material-symbols-outlined text-[20px] text-white">school</VIcon>
        </div>
        <div class="min-w-0">
          <p class="mb-1 text-[9px] font-black uppercase leading-none tracking-widest text-umsa-blue">Estudiante</p>
          <h3 class="truncate text-xs font-black leading-tight text-slate-800 dark:text-white">
            {{ authStore.user?.persona?.nombres || 'Estudiante' }}
          </h3>
        </div>
      </div>
      <div class="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
        <div class="h-2 w-2 animate-pulse rounded-full bg-umsa-blue"></div>
        <span class="text-[9px] font-bold uppercase tracking-widest text-slate-500">SGEA | Portal académico</span>
      </div>
    </div>

    <VSheet tag="nav" class="space-y-1 flex-1">
      <p class="mb-3 mt-2 pl-2 text-[9px] font-black uppercase tracking-widest text-slate-400">General</p>

      <VBtn @click="navigate('estudiante-dashboard')"
        :class="[ $route.name === 'estudiante-dashboard' ? 'bg-umsa-blue text-white shadow-md' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-sky-900/20' ]"
        class="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all">
        <VIcon class="material-symbols-outlined text-[22px]">monitoring</VIcon>
        <span class="text-xs uppercase tracking-wider">Dashboard</span>
      </VBtn>

      <p class="mb-3 mt-6 pl-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descubrimiento</p>

      <VBtn @click="navigate('estudiante-catalogo')"
        :class="[ $route.name === 'estudiante-catalogo' ? 'bg-umsa-blue text-white shadow-md' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-sky-900/20' ]"
        class="mt-1.5 flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all">
        <VIcon class="material-symbols-outlined text-[22px]">travel_explore</VIcon>
        <span class="text-xs uppercase tracking-wider">Eventos disponibles</span>
      </VBtn>

      <p class="mb-3 mt-6 pl-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Mi portal</p>

      <VBtn @click="navigate('estudiante-actividades')"
        :class="[ $route.name === 'estudiante-actividades' || $route.name === 'estudiante-actividades-detalle' ? 'bg-umsa-blue text-white shadow-md' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-sky-900/20' ]"
        class="mt-1.5 flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all">
        <VIcon class="material-symbols-outlined text-[22px]">school</VIcon>
        <span class="text-xs uppercase tracking-wider">Mis actividades</span>
      </VBtn>

      <VBtn @click="navigate('estudiante-certificados')"
        :class="[ $route.name === 'estudiante-certificados' ? 'bg-umsa-blue text-white shadow-md' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-sky-900/20' ]"
        class="mt-1.5 flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all">
        <VIcon class="material-symbols-outlined text-[22px]">workspace_premium</VIcon>
        <span class="text-xs uppercase tracking-wider">Certificados</span>
      </VBtn>
    </VSheet>

    <div class="mt-auto space-y-2.5">
      <button
        v-if="authStore.tieneMultiplesRoles"
        type="button"
        @click="cambiarRol"
        class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold text-slate-600 transition-all hover:bg-slate-100 dark:border-gray-700 dark:bg-gray-900 dark:text-slate-300 dark:hover:bg-gray-800"
      >
        <span class="text-xs uppercase tracking-widest">Cambiar Rol</span>
        <VIcon class="material-symbols-outlined shrink-0 text-[20px]">cached</VIcon>
      </button>

      <button
        type="button"
        @click="handleLogout"
        class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold text-slate-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-slate-300 dark:hover:border-red-900/40 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      >
        <span class="text-xs uppercase tracking-widest">Cerrar Sesión</span>
        <VIcon class="material-symbols-outlined shrink-0 text-[20px]">logout</VIcon>
      </button>
    </div>
  </VSheet>
</template>