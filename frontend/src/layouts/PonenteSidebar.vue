<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import api from '@/services/api';
import Swal from '@/services/dialogs';

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUIStore();
const profilePhotoUrl = ref('');

const nombreCompleto = computed(() => {
  const p = authStore.user?.persona as any;
  const nombre = `${p?.nombres || ''} ${p?.primer_apellido || ''}`.trim();
  return nombre || authStore.user?.email?.split('@')[0] || 'Ponente';
});

const iniciales = computed(() =>
  String(nombreCompleto.value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'P',
);

const email = computed(() => authStore.user?.email || '');

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
  } catch {
    /* sin foto: se usan iniciales */
  }
};

onMounted(loadPhoto);
onUnmounted(() => {
  if (profilePhotoUrl.value) URL.revokeObjectURL(profilePhotoUrl.value);
});

const navigate = (routeName: string) => {
  router.push({ name: routeName });
  uiStore.closeSidebar();
};

const irPerfil = () => navigate('ponente-datos');

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
    const otroRol = roles.find((r) => r !== rolActual) || roles[0];
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

  const rolConfig: Record<string, { label: string; path: string; icon: string; color: string }> = {
    Coordinador: { label: 'Coordinador', path: '/coordinador', icon: 'manage_accounts', color: '#0ea5e9' },
    Estudiante: { label: 'Estudiante', path: '/estudiante', icon: 'school', color: '#10b981' },
    Ponente: { label: 'Expositor / Ponente', path: '/ponente', icon: 'co_present', color: '#3b82f6' },
    Logística: { label: 'Personal de Apoyo', path: '/logistica', icon: 'support_agent', color: '#14b8a6' },
    'Super Usuario': { label: 'Administrador', path: '/admin', icon: 'shield_person', color: '#ef4444' },
  };

  const htmlButtons = roles
    .map((r) => {
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
    })
    .join('');

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
        buttons.forEach((btn) => {
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
    },
  });
};
</script>

<template>
  <VSheet
    tag="aside"
    :class="[
      uiStore.isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      'fixed top-[75px] bottom-0 left-0 z-[110] flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 text-slate-600 transition-transform duration-300 lg:w-72 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300',
    ]"
  >
    <!-- Perfil → va a datos / configuración -->
    <button
      type="button"
      class="mb-6 w-full rounded-2xl border border-[#028191]/20 bg-gradient-to-br from-[#E4F1DD] via-white to-sky-50 p-4 text-left shadow-sm transition hover:border-[#028191]/45 hover:shadow-md dark:border-sky-800 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950"
      :class="$route.name === 'ponente-datos' ? 'ring-2 ring-[#028191]/40' : ''"
      @click="irPerfil"
    >
      <div class="flex items-center gap-3">
        <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#012248] to-[#028191] text-white shadow-md">
          <img v-if="profilePhotoUrl" :src="profilePhotoUrl" alt="Foto de perfil" class="h-full w-full object-cover">
          <span v-else class="flex h-full w-full items-center justify-center text-base font-black">{{ iniciales }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-black tracking-[0.18em] text-[#028191] uppercase">Ponente</p>
          <h3 class="mt-0.5 truncate text-sm font-black leading-snug text-[#012248] dark:text-white">
            {{ nombreCompleto }}
          </h3>
          <p v-if="email" class="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{{ email }}</p>
        </div>
      </div>
      <div class="mt-3 flex items-center justify-between gap-2 border-t border-[#028191]/15 pt-3 dark:border-sky-900">
        <span class="inline-flex items-center gap-1.5 text-[11px] font-black tracking-wide text-[#1A4756] uppercase dark:text-sky-200">
          <span class="material-symbols-outlined text-[16px] leading-none">manage_accounts</span>
          Mi perfil
        </span>
        <span class="material-symbols-outlined text-[18px] text-[#028191]">chevron_right</span>
      </div>
    </button>

    <VSheet tag="nav" class="flex-1 space-y-1">
      <p class="mb-2 pl-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">Mi área de trabajo</p>

      <VBtn
        @click="navigate('ponente-eventos')"
        :class="[
          $route.name === 'ponente-eventos' || $route.name === 'ponente-curso' || $route.name === 'ponente-curso-detalle'
            ? 'bg-umsa-blue text-white shadow-md'
            : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-sky-900/20',
        ]"
        class="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all"
      >
        <VIcon class="material-symbols-outlined text-[20px]">monitoring</VIcon>
        <span class="text-[11px] tracking-wider uppercase">Mis eventos</span>
      </VBtn>

      <VBtn
        @click="navigate('ponente-historial-notas')"
        :class="[$route.name === 'ponente-historial-notas' ? 'bg-umsa-blue text-white shadow-md' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-sky-900/20']"
        class="mt-1.5 flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all"
      >
        <VIcon class="material-symbols-outlined text-[20px]">history_edu</VIcon>
        <span class="text-[11px] tracking-wider uppercase">Historial de notas</span>
      </VBtn>

      <VBtn
        @click="navigate('ponente-certificados')"
        :class="[$route.name === 'ponente-certificados' ? 'bg-umsa-blue text-white shadow-md' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-sky-900/20']"
        class="mt-1.5 flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all"
      >
        <VIcon class="material-symbols-outlined text-[20px]">workspace_premium</VIcon>
        <span class="text-[11px] tracking-wider uppercase">Certificados</span>
      </VBtn>

      <p class="mt-6 mb-2 pl-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">Cuenta</p>

      <VBtn
        @click="irPerfil"
        :class="[$route.name === 'ponente-datos' ? 'bg-[#1A4756] text-white shadow-md' : 'text-slate-600 hover:bg-[#E4F1DD]/70 dark:text-slate-400 dark:hover:bg-slate-800']"
        class="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all"
      >
        <VIcon class="material-symbols-outlined text-[20px]">settings</VIcon>
        <span class="text-[11px] tracking-wider uppercase">Configuración</span>
      </VBtn>
    </VSheet>

    <div v-if="authStore.tieneMultiplesRoles" class="mt-4 border-t border-slate-100 pt-4 dark:border-gray-800">
      <VBtn
        @click="cambiarRol"
        class="flex w-full items-center justify-between rounded-xl border border-transparent px-4 py-3 font-bold text-slate-500 transition-all hover:bg-slate-50 dark:hover:bg-gray-900"
      >
        <span class="text-[10px] tracking-widest uppercase">Cambiar rol</span>
        <VIcon class="material-symbols-outlined text-[18px]">cached</VIcon>
      </VBtn>
    </div>
  </VSheet>
</template>
