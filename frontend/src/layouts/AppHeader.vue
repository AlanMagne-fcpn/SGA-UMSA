<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useEventoStore } from '../stores/eventoStore'
import { useUIStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import api from '../services/api'

const eventoStore = useEventoStore()
const uiStore = useUIStore()
const authStore = useAuthStore()
const router = useRouter()

const isDark = ref(false)

const versionActual = computed(() => {
  const current = eventoStore.versionesDisponibles.find(v => v.id === eventoStore.selectedEventoId);
  return current ? current.edicion : 'Sin versión';
});

const eventoActivo = computed(() => Number(eventoStore.activeEvento?.estado) === 1);
interface CoordinatorActivity {
  id: number;
  nombre: string;
  eventoNombre: string;
  count: number;
}

interface CoordinatorNotifications {
  total: number;
  accounts: number;
  activities: CoordinatorActivity[];
}

interface StudentNotification {
  id: string | number;
  prioridad: 'alta' | 'media' | 'baja';
  tipo: 'success' | 'warning' | 'info' | 'error';
  titulo: string;
  mensaje: string;
  fecha: string | Date;
}

const notifications = ref<CoordinatorNotifications>({
  total: 0,
  accounts: 0,
  activities: []
})
const showNotifications = ref(false)
const studentNotifications = ref<StudentNotification[]>([])
const showStudentNotifications = ref(false)
const isProfileOpen = ref(false)
const autoCloseTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const startAutoClose = () => {
  if (autoCloseTimer.value) clearTimeout(autoCloseTimer.value);
  autoCloseTimer.value = setTimeout(() => {
    showNotifications.value = false;
    showStudentNotifications.value = false;
    isProfileOpen.value = false;
  }, 10000);
}

const resetAutoClose = () => {
  if (showNotifications.value || showStudentNotifications.value || isProfileOpen.value) {
    startAutoClose();
  }
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
  showStudentNotifications.value = false;
  if (showNotifications.value) {
    startAutoClose();
  } else {
    if (autoCloseTimer.value) clearTimeout(autoCloseTimer.value);
  }
}


const coordinatorNotificationsRef = ref<HTMLElement | null>(null);
const studentNotificationsRef = ref<HTMLElement | null>(null);

const isCoordinadorOrAdmin = computed(() => {
  const roles = Array.isArray(authStore.user?.usuariosRoles) 
    ? authStore.user!.usuariosRoles.map((ur: { rol?: { nombre_rol?: string } }) => ur.rol?.nombre_rol) 
    : [];
  return roles.includes('Coordinador') || roles.includes('Super Usuario');
});

const isStudent = computed(() => {
  if (!authStore.user) return false;
  const roles = Array.isArray(authStore.user?.usuariosRoles) 
    ? authStore.user!.usuariosRoles.map((ur: { rol?: { nombre_rol?: string } }) => ur.rol?.nombre_rol) 
    : [];
  return roles.includes('Estudiante') || (!isCoordinadorOrAdmin.value);
});

const fetchNotifications = async () => {
  if (!isCoordinadorOrAdmin.value) return;
  try {
    const res = await api.get('/inscripciones/alertas-coordinador');
    notifications.value = res.data;
  } catch (error) {
    console.error('Error fetching coordinator notifications', error);
  }
}

const eliminarAlerta = (id: string | number) => {
  studentNotifications.value = studentNotifications.value.filter(n => n.id !== id);
  const dismissed = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem('dismissedNotifications', JSON.stringify(dismissed));
  }
}

const fetchStudentNotifications = async () => {
  if (!isStudent.value) return;
  try {
    const res = await api.get('/usuarios/alertas/estudiante');
    const dismissed = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
    studentNotifications.value = res.data.filter((n: StudentNotification) => !dismissed.includes(n.id));
  } catch (error) {
    console.error('Error fetching student notifications', error);
  }
}

const toggleDark = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

const closeDropdowns = (e: MouseEvent) => {
  if (coordinatorNotificationsRef.value && !coordinatorNotificationsRef.value.contains(e.target as Node)) {
    showNotifications.value = false;
  }
  if (studentNotificationsRef.value && !studentNotificationsRef.value.contains(e.target as Node)) {
    showStudentNotifications.value = false;
  }
};

onMounted(async () => {
  await eventoStore.fetchEventosInfo();
  await fetchEventosAsignados();
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
  document.addEventListener('click', closeDropdowns);
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns);
})

// Reactivar fetch cuando el usuario esté listo o cambie
watch(() => isCoordinadorOrAdmin.value, (val) => {
  if (val) {
    fetchNotifications();
    setInterval(fetchNotifications, 60000);
  }
}, { immediate: true });

watch(() => isStudent.value, (val) => {
  if (val) {
    fetchStudentNotifications();
    setInterval(fetchStudentNotifications, 60000);
  }
}, { immediate: true });

const asignadosIds = ref<number[]>([]);

const fetchEventosAsignados = async () => {
  if (isCoordinadorOrAdmin.value && !authStore.esSuperUsuario) {
    try {
      const res = await api.get('/admin/eventos/lista?limit=1000');
      const data = res.data?.data || res.data || [];
      asignadosIds.value = data.map((e: any) => e.id);
      const permitido = eventoStore.eventosAplanados.some((e) => e.id === eventoStore.selectedEventoId && asignadosIds.value.includes(e.id));
      if (!permitido) {
        const primero = eventoStore.eventosAplanados.find((e) => asignadosIds.value.includes(e.id));
        if (primero) eventoStore.setEventoPorNombre(primero.nombre);
      }
    } catch (e) {
      console.error('Error fetching assigned events:', e);
    }
  }
};

const esAsignado = (nombre: string) => {
  if (authStore.esSuperUsuario) return true;
  const match = eventoStore.eventosAplanados.filter(e => e.nombre === nombre);
  return match.some(e => asignadosIds.value.includes(e.id));
};

const eventosFiltrados = computed(() => {
  const todos = eventoStore.nombresEventos;
  if (authStore.esSuperUsuario) return todos;
  return todos.filter(nombre => esAsignado(nombre));
});

const onNombreChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  eventoStore.setEventoPorNombre(target.value);
}

const goToProfile = () => {
  router.push('/coordinador/perfil');
}
</script>

<template>
  <VSheet tag="header" class="fixed top-0 left-0 right-0 h-[75px] bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 z-[100] px-4 md:px-8 flex items-center justify-between shadow-sm transition-all duration-300">
    <!-- Aviso de Servidor Offline -->
    <div v-if="!uiStore.isServerOnline" 
         class="fixed top-0 left-0 right-0 h-1 bg-red-500 animate-pulse z-[200]"></div>
    <div v-if="!uiStore.isServerOnline" 
         class="fixed top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg z-[200] flex items-center gap-2 border border-red-400">
      <VIcon class="material-symbols-outlined text-sm">wifi_off</VIcon>
      Sin Conexión con el Servidor
    </div>

    <div class="flex min-w-0 flex-1 items-center gap-4 md:gap-6">
      
      <!-- Botón Menú Móvil -->
      <VBtn @click="uiStore.toggleSidebar" class="flex-shrink-0 p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors lg:hidden flex items-center justify-center">
        <VIcon class="material-symbols-outlined text-2xl">{{ uiStore.isSidebarOpen ? 'menu_open' : 'menu' }}</VIcon>
      </VBtn>

      <div class="hidden sm:flex min-w-0 shrink-0 items-center gap-3 border-r border-slate-200 pr-4 dark:border-gray-800 md:pr-6">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#003B71] to-[#0070BB] shadow-lg shadow-[#003B71]/40">
          <VIcon class="material-symbols-outlined text-[16px] text-white">manage_accounts</VIcon>
        </div>
        <div class="min-w-0">
          <p class="text-[10px] font-black uppercase leading-none tracking-widest text-umsa-blue dark:text-sky-400">Sistema SGEA</p>
          <h1 class="truncate text-sm font-black leading-tight text-slate-800 dark:text-white">Portal del Coordinador</h1>
        </div>
      </div>

      <div class="min-w-0 flex-1 lg:hidden">
        <select :value="eventoStore.selectedEventoNombre || ''" @change="onNombreChange"
          :class="eventoActivo ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-600'"
          class="h-9 w-full max-w-[220px] truncate rounded-lg border px-2 text-[11px] font-semibold">
          <option v-for="nombre in eventosFiltrados" :key="nombre" :value="nombre">{{ nombre }}</option>
        </select>
      </div>

      <div class="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
        <div class="relative min-w-0 max-w-sm flex-1">
          <label class="absolute -top-2 left-3 z-10 bg-white px-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-400 dark:bg-gray-900">Evento académico</label>
          <VIcon class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px]"
            :class="eventoActivo ? 'text-emerald-600' : 'text-slate-400'">event_seat</VIcon>
          <select :value="eventoStore.selectedEventoNombre || ''" @change="onNombreChange"
            :class="eventoActivo ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-700'"
            class="h-11 w-full truncate rounded-xl border py-2 pl-10 pr-3 text-sm font-semibold">
            <option v-for="nombre in eventosFiltrados" :key="nombre" :value="nombre">{{ nombre }}</option>
          </select>
        </div>

        <div v-if="eventoStore.selectedEventoNombre" class="relative w-36 shrink-0">
          <label class="absolute -top-2 left-3 z-10 bg-white px-1 text-[8px] font-black uppercase tracking-[0.14em] dark:bg-gray-900"
            :class="eventoActivo ? 'text-emerald-600' : 'text-slate-400'">Gestión</label>
          <div :class="eventoActivo ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-700'"
            class="flex h-11 items-center truncate rounded-xl border pl-3 pr-3 text-sm font-semibold">
            {{ versionActual }}
          </div>
        </div>
      </div>
    </div>

    <!-- Controles -->
    <div class="flex items-center space-x-2 md:space-x-4 shrink-0">
      
      <!-- Campanita de Notificaciones (Solo Coordinador/Admin) -->
      <div v-if="isCoordinadorOrAdmin" class="relative" ref="coordinatorNotificationsRef">
        <VBtn @click="toggleNotifications"
          class="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-200 dark:hover:bg-gray-700 transition-all relative">
          <VIcon class="material-symbols-outlined text-[18px] md:text-[20px] transition-transform" :class="notifications.total > 0 ? 'animate-bounce' : ''">notifications</VIcon>
          <span v-if="notifications.total > 0" class="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm">
            {{ notifications.total }}
          </span>
        </VBtn>

        <!-- Dropdown de Notificaciones -->
        <div v-if="showNotifications" @mousemove="resetAutoClose"
          class="absolute right-0 mt-4 w-80 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-gray-800 z-[200] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div class="p-6 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center bg-slate-50/50 dark:bg-gray-800/50">
            <h3 class="text-xs font-black text-primary-dark dark:text-white uppercase tracking-widest">Gestión Académica</h3>
            <span class="text-[9px] font-bold text-slate-400 uppercase">{{ notifications.total }} Pendientes</span>
          </div>
          
          <div class="max-h-96 overflow-y-auto">
            <!-- Solicitudes de Registro -->
            <div v-if="notifications.accounts > 0" 
              @click="router.push('/coordinador/solicitudes'); showNotifications = false"
              class="p-5 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer border-b border-slate-50 dark:border-gray-800 last:border-0 group">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <VIcon class="material-symbols-outlined">person_add</VIcon>
                </div>
                <div class="flex-1">
                  <p class="text-[11px] font-black text-primary-dark dark:text-white uppercase leading-tight">Nuevos Registros</p>
                  <p class="text-[10px] text-slate-500 dark:text-gray-400 mt-1">Hay {{ notifications.accounts }} cuentas esperando aprobación.</p>
                </div>
              </div>
            </div>

            <!-- Solicitudes de Actividades -->
            <div v-for="act in notifications.activities" :key="act.id"
              @click="router.push(`/coordinador/gestion-eventos/${act.id}?tab=solicitudes`); showNotifications = false"
              class="p-5 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer border-b border-slate-50 dark:border-gray-800 last:border-0 group">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                  <VIcon class="material-symbols-outlined">app_registration</VIcon>
                </div>
                <div class="flex-1">
                  <p class="text-[11px] font-black text-primary-dark dark:text-white uppercase leading-tight">{{ act.nombre }}</p>
                  <p class="text-[9px] text-umsa-gold font-bold uppercase tracking-tighter">{{ act.eventoNombre }}</p>
                  <p class="text-[10px] text-slate-500 dark:text-gray-400 mt-1">Hay {{ act.count }} solicitudes de inscripción.</p>
                </div>
              </div>
            </div>

            <div v-if="notifications.total === 0" class="p-12 text-center">
              <VIcon class="material-symbols-outlined text-4xl text-slate-200 dark:text-gray-800 mb-2">notifications_off</VIcon>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay pendientes</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Campanita de Notificaciones (Estudiante / Usuario Regular) -->
      <div v-if="isStudent" class="relative" ref="studentNotificationsRef">
        <VBtn @click="showStudentNotifications = !showStudentNotifications; showNotifications = false; if(showStudentNotifications) startAutoClose()"
          class="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-200 dark:hover:bg-gray-700 transition-all relative">
          <VIcon class="material-symbols-outlined text-[18px] md:text-[20px]" :class="studentNotifications.some(n => n.prioridad === 'alta') ? 'animate-pulse text-primary-dark dark:text-white' : ''">notifications</VIcon>
          <span v-if="studentNotifications.length > 0" class="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 rounded-full border border-white dark:border-gray-950 flex items-center justify-center text-[9px] font-bold text-white px-1">
            {{ studentNotifications.length }}
          </span>
        </VBtn>

        <!-- Dropdown Estudiante -->
        <div v-if="showStudentNotifications" @mousemove="resetAutoClose"
          class="absolute right-0 mt-4 w-80 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-gray-800 z-[200] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div class="p-6 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center bg-slate-50/50 dark:bg-gray-800/50">
            <h3 class="text-xs font-black text-primary-dark dark:text-white uppercase tracking-widest">Notificaciones</h3>
            <span class="text-[9px] font-bold text-slate-400 uppercase">{{ studentNotifications.length }} Activas</span>
          </div>
          
          <div class="max-h-96 overflow-y-auto">
            <div v-for="notif in studentNotifications" :key="notif.id"
              @click="router.push('/estudiante/perfil'); eliminarAlerta(notif.id); showStudentNotifications = false"
              class="p-5 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer border-b border-slate-50 dark:border-gray-800 last:border-0 group">
              <div class="flex items-start gap-4">
                <div :class="[
                  'w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110',
                  notif.tipo === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                ]">
                  <VIcon class="material-symbols-outlined">{{ notif.tipo === 'success' ? 'verified' : 'priority_high' }}</VIcon>
                </div>
                <div class="flex-1">
                  <p class="text-[11px] font-black text-primary-dark dark:text-white uppercase leading-tight">{{ notif.titulo }}</p>
                  <p class="text-[10px] text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">{{ notif.mensaje }}</p>
                  <div class="flex items-center gap-1 mt-2 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                    <VIcon class="material-symbols-outlined text-[10px]">schedule</VIcon>
                    {{ new Date(notif.fecha).toLocaleDateString() }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="studentNotifications.length === 0" class="p-12 text-center">
              <VIcon class="material-symbols-outlined text-4xl text-slate-200 dark:text-gray-800 mb-2">notifications_off</VIcon>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay nuevas alertas</p>
            </div>
          </div>
        </div>
      </div>

      <VBtn @click="toggleDark" class="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700">
        <VIcon class="material-symbols-outlined text-[18px] md:text-[20px]">{{ isDark ? 'light_mode' : 'dark_mode' }}</VIcon>
      </VBtn>
      <div @click="goToProfile" class="w-9 h-9 md:w-10 md:h-10 bg-slate-100 dark:bg-gray-800 border-2 border-white dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm ring-2 ring-slate-200 dark:ring-gray-600 overflow-hidden cursor-pointer hover:ring-emerald-500 transition-all">  
        <VIcon class="material-symbols-outlined text-xl text-slate-500">account_circle</VIcon>
      </div>
    </div>
  </VSheet>
</template>

<style scoped>
.font-clarendon {
  font-family: Urbanist, sans-serif;
}

.animate-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
