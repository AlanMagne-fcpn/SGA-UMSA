<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api, { resolveMediaUrl } from '@/services/api';
import Swal from '@/services/dialogs';
import { permisosContenido } from '@/utils/activityLearning';
import QrcodeVue from 'qrcode.vue';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Materiales
const materiales = ref<any[]>([]);
const fechaDeHoy = () => new Date().toISOString().slice(0, 10);
const nuevoMaterial = ref({
    titulo: '',
    tipo: 'Archivo',
    url: '',
    tamano: '',
    fecha: fechaDeHoy(),
});
const archivoInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const subiendoMaterial = ref(false);
const mostrarFormMaterial = ref(false);

const activeTab = ref('resumen');
const loading = ref(true);
const actividadId = route.params.id;

const curso = ref<any>(null);
const puedeSubirMaterial = computed(() => curso.value && permisosContenido(curso.value.tipo, curso.value.requisitos).material);
const claveFecha = (mat: any) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(mat.fechaClase || ''))) return mat.fechaClase;
    const partes = String(mat.fecha || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (partes) return `${partes[3]}-${partes[2].padStart(2, '0')}-${partes[1].padStart(2, '0')}`;
    return 'sin-fecha';
};
const tituloFecha = (clave: string) => {
    if (clave === 'sin-fecha') return 'Sin fecha de clase';
    return new Date(`${clave}T12:00:00`).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const materialesPorFecha = computed(() => {
    const grupos = new Map<string, any[]>();
    for (const mat of materiales.value) {
        const clave = claveFecha(mat);
        grupos.set(clave, [...(grupos.get(clave) || []), mat]);
    }
    return [...grupos.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([clave, items]) => ({ clave, titulo: tituloFecha(clave), items }));
});
const estudiantes = ref<any[]>([]);

// Sesiones y QR
const sesiones = ref<any[]>([]);
const avisoAsistencia = ref('');
const activeSessionId = ref<number | null>(null);
const qrMode = ref<'project' | 'scan'>('project');
const registrosRequeridos = ref(1); // "registros para el dia de hoy"
const qrCounter = ref(1); // Current check number
const isQrVisible = ref(false); // Flag to show QR only after clicking project
const qrRandomToken = ref(Math.random().toString(36).substring(2, 8).toUpperCase());

const qrData = computed(() => {
    return activeSessionId.value ? JSON.stringify({ 
        id_sesion: activeSessionId.value,
        token: qrRandomToken.value,
        check_number: qrCounter.value
    }) : '';
});

const generatedPin = computed(() => {
    return `PIN-${actividadId}-${activeSessionId.value}-${qrRandomToken.value}`;
});

const regenerarCodigo = () => {
    if (qrCounter.value < registrosRequeridos.value) {
        qrCounter.value++;
        qrRandomToken.value = Math.random().toString(36).substring(2, 8).toUpperCase();
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Límite alcanzado',
            text: `Ya has generado los ${registrosRequeridos.value} códigos configurados para hoy.`,
            confirmButtonColor: '#003B71'
        });
    }
};

// Reiniciar estado cuando cambie la sesión
watch(activeSessionId, () => {
    qrCounter.value = 1;
    isQrVisible.value = false;
    qrRandomToken.value = Math.random().toString(36).substring(2, 8).toUpperCase();
});

// Scanner instance
let html5QrcodeScanner: Html5QrcodeScanner | null = null;

// Verificar si el ponente tiene permisos de edición en esta actividad
const tienePermisos = computed(() => {
    if (!curso.value || !authStore.user) return false;
    const userId = authStore.user.id;
    return curso.value.imparticiones?.some((i: any) => 
        i.usuario?.id === userId || 
        i.usuarioId === userId || 
        i.id_usuario === userId
    );
});

const fetchDetalleActividad = async () => {
    loading.value = true;
    try {
        const res = await api.get(`/actividades-academicas/${actividadId}`);
        const data = res.data;
        
        // Bloquear si la actividad está inhabilitada
        if (Number(data.estado) === -1) {
            Swal.fire({
                icon: 'warning',
                title: 'Actividad Inhabilitada',
                text: 'Esta actividad ha sido inhabilitada y no puede ser gestionada ni visualizada.',
                confirmButtonColor: '#003B71'
            });
            router.push({ name: 'ponente-eventos' });
            return;
        }
        
        curso.value = {
            id: data.id,
            tipo: data.tipo,
            requisitos: data.requisitos,
            nombre: data.nombre || 'Simposio / Actividad',
            evento: data.evento?.nombre || 'Evento Académico',
            version: data.version || 'Gestión 2026',
            fechas: `${data.fecha_inicio ? new Date(data.fecha_inicio).toLocaleDateString() : 'Pendiente'} - ${data.fecha_fin ? new Date(data.fecha_fin).toLocaleDateString() : 'Pendiente'}`,
            estudiantesInscritos: data.inscripciones?.length || 0,
            estado: data.estado === 1 ? 'Activo' : 'Cerrado',
            modalidad: data.modalidad || 'Presencial',
            descripcion: data.descripcion || 'Sin descripción disponible.',
            imparticiones: data.imparticiones || [],
            materiales: data.materiales || []
        };
        materiales.value = data.materiales || [];
        
        // Estudiantes
        estudiantes.value = (data.inscripciones || []).map((ins: any) => ({
            id: ins.id,
            nombre: `${ins.usuario?.persona?.nombres || 'Estudiante'} ${ins.usuario?.persona?.primer_apellido || ''}`,
            correo: ins.usuario?.email || '',
            asistencia: '---', 
            estado: ins.nota_principal >= (data.min_nota ?? 51) ? 'Excelente' : 'Regular'
        }));

        const allSesiones: any[] = [];
        if (Array.isArray(data.modalidades)) {
            data.modalidades.forEach((mod: any) => {
                if (Array.isArray(mod.sesiones)) {
                    mod.sesiones.forEach((s: any) => {
                        allSesiones.push({
                            ...s,
                            modalidad_nombre: mod.tipo || 'Presencial'
                        });
                    });
                }
            });
        }

        avisoAsistencia.value = '';
        if (allSesiones.length === 0 && Number(data.estado) === 1) {
            try {
                const abierta = await api.post(`/ponente/sesiones-academicas/actividad/${actividadId}/abierta`);
                allSesiones.push(abierta.data);
            } catch (error: any) {
                const mensaje = error?.response?.data?.message;
                avisoAsistencia.value = Array.isArray(mensaje) ? mensaje.join(' ') : (mensaje || 'La asistencia se abre mientras la actividad está vigente.');
            }
        }
        if (allSesiones.length === 0 && !avisoAsistencia.value) {
            avisoAsistencia.value = 'No hay sesiones configuradas para esta actividad.';
        }
        
        sesiones.value = allSesiones;
        if (allSesiones.length > 0) {
            activeSessionId.value = allSesiones[0].id;
        }

    } catch (error) {
        console.error('Error al cargar detalle:', error);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchDetalleActividad);

onUnmounted(() => {
    stopScanner();
});

const navigateToCalificaciones = () => {
    router.push({ 
        name: 'ponente-actividad-calificaciones',
        params: { actividadId: actividadId }
    });
};

const switchTab = (tab: string) => {
    activeTab.value = tab;
    if (tab === 'qr' && qrMode.value === 'scan') {
        startScanner();
    } else {
        stopScanner();
    }
};

const switchQrMode = (mode: 'project' | 'scan') => {
    qrMode.value = mode;
    if (mode === 'scan') {
        startScanner();
        isQrVisible.value = false;
    } else {
        stopScanner();
        isQrVisible.value = true; // Show QR when clicking "Proyectar QR"
    }
};

const startScanner = async () => {
    await nextTick();
    if (document.getElementById('reader')) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: {width: 250, height: 250}, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
            false
        );
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }
};

const stopScanner = () => {
    if (html5QrcodeScanner) {
        try {
            html5QrcodeScanner.clear();
        } catch (error) {
            console.error("Failed to clear scanner", error);
        }
        html5QrcodeScanner = null;
    }
};

let isProcessingScan = false;

const onScanSuccess = async (decodedText: string) => {
    if (isProcessingScan) return;
    
    try {
        const data = JSON.parse(decodedText);
        if (!data.id_inscripcion_modalidad) throw new Error("QR inválido para asistencia de estudiante.");
        if (!activeSessionId.value) throw new Error("Debe seleccionar una sesión activa.");

        isProcessingScan = true;
        
        // Pausar scanner
        if (html5QrcodeScanner) html5QrcodeScanner.pause(true);

        const res = await api.post('/ponente/asistencias/registro-qr', {
            id_inscripcion_modalidad: data.id_inscripcion_modalidad,
            id_sesion: activeSessionId.value
        });

        await Swal.fire({
            icon: 'success',
            title: 'Asistencia Registrada',
            text: res.data.mensaje || 'Estudiante registrado correctamente.',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (e: any) {
        await Swal.fire({
            icon: 'error',
            title: 'Error de Lectura',
            text: e.response?.data?.message || e.message || 'QR inválido o ya registrado.',
            timer: 3000,
            showConfirmButton: false
        });
    } finally {
        isProcessingScan = false;
        if (html5QrcodeScanner) html5QrcodeScanner.resume();
    }
};

const onScanFailure = (error: any) => {
    // ignorar errores constantes de frame vacío
};

const simularEscaneo = async () => {
    try {
        if (!activeSessionId.value) throw new Error("Debe seleccionar una sesión activa.");

        await Swal.fire({
            icon: 'success',
            title: 'Asistencia Registrada (Simulación)',
            text: 'Se registró la asistencia del estudiante de prueba correctamente.',
            timer: 2000,
            showConfirmButton: false
        });
        
        if (estudiantes.value.length > 0) {
            estudiantes.value[0].asistencia = 'Presente';
            estudiantes.value[0].estado = 'Presente';
        }

    } catch (e: any) {
        await Swal.fire({
            icon: 'error',
            title: 'Error de Simulación',
            text: e.message || 'Error al simular escaneo.',
            timer: 3000,
            showConfirmButton: false
        });
    }
};

const handleFileChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    selectedFile.value = file || null;
};

const guardarMaterial = async () => {
    if (!nuevoMaterial.value.titulo.trim()) {
        Swal.fire('Atención', 'El título del material es obligatorio.', 'warning');
        return;
    }

    subiendoMaterial.value = true;
    try {
        let finalUrl = '';
        let finalSize = '';

        if (nuevoMaterial.value.tipo === 'Archivo') {
            if (!selectedFile.value) {
                Swal.fire('Atención', 'Debe seleccionar un archivo.', 'warning');
                subiendoMaterial.value = false;
                return;
            }
            // Subir archivo al servidor
            const formData = new FormData();
            formData.append('file', selectedFile.value);

            const uploadRes = await api.post(`/actividades-academicas/${actividadId}/materiales/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            finalUrl = uploadRes.data.path;
            
            // Formatear tamaño
            const sizeInMb = (selectedFile.value.size / (1024 * 1024)).toFixed(2);
            finalSize = `${sizeInMb} MB`;
        } else {
            if (!nuevoMaterial.value.url.trim()) {
                Swal.fire('Atención', 'Debe ingresar un enlace (URL).', 'warning');
                subiendoMaterial.value = false;
                return;
            }
            finalUrl = nuevoMaterial.value.url.trim();
        }

        // Agregar al array local
        const fechaClase = nuevoMaterial.value.fecha || fechaDeHoy();
        const nuevo = {
            id: Date.now().toString(),
            titulo: nuevoMaterial.value.titulo.trim(),
            tipo: nuevoMaterial.value.tipo === 'Archivo' ? 'Archivo' : 'Enlace',
            nombreArchivo: selectedFile.value?.name || '',
            url: finalUrl,
            tamaño: finalSize || '',
            fechaClase,
            fecha: new Date(`${fechaClase}T12:00:00`).toLocaleDateString('es-BO')
        };

        const listaActualizada = [...materiales.value, nuevo];

        // Guardar en la base de datos
        await api.patch(`/actividades-academicas/${actividadId}/materiales`, {
            materiales: listaActualizada
        });

        materiales.value = listaActualizada;
        
        // Resetear form
        nuevoMaterial.value = {
            titulo: '',
            tipo: 'Archivo',
            url: '',
            tamano: '',
            fecha: fechaDeHoy(),
        };
        selectedFile.value = null;
        if (archivoInput.value) archivoInput.value.value = '';
        mostrarFormMaterial.value = false;

        Swal.fire({
            icon: 'success',
            title: 'Material Guardado',
            text: 'El material ha sido subido correctamente.',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (e: any) {
        console.error(e);
        Swal.fire('Error', e.response?.data?.message || 'Error al guardar el material.', 'error');
    } finally {
        subiendoMaterial.value = false;
    }
};

const eliminarMaterial = async (id: string) => {
    const result = await Swal.fire({
        title: '¿Eliminar material?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const listaActualizada = materiales.value.filter((m: any) => m.id !== id);
            await api.patch(`/actividades-academicas/${actividadId}/materiales`, {
                materiales: listaActualizada
            });
            materiales.value = listaActualizada;
            Swal.fire('Eliminado', 'El material ha sido eliminado.', 'success');
        } catch (e: any) {
            console.error(e);
            Swal.fire('Error', e.response?.data?.message || 'Error al eliminar el material.', 'error');
        }
    }
};

const openMaterial = (mat: any) => {
    if (!mat.url) return;
    const url = resolveMediaUrl(mat.url);
    window.open(url, '_blank');
};

</script>

<template>
  <div v-if="loading" class="animate-in fade-in flex flex-col items-center justify-center p-40 text-slate-400">
      <VIcon class="material-symbols-outlined animate-spin text-5xl">sync</VIcon>
      <p class="text-[10px] font-black uppercase tracking-widest mt-4">Sincronizando información académica...</p>
  </div>

  <div v-else-if="curso" class="animate-in fade-in duration-500 max-w-7xl mx-auto space-y-8 pb-20">
    <!-- Header Retorno -->
    <VBtn @click="router.back()" class="flex items-center gap-2 text-slate-500 hover:text-umsa-blue transition-colors font-black text-[11px] uppercase tracking-widest">
      <VIcon class="material-symbols-outlined text-[16px]">arrow_back</VIcon>
      Volver al Listado
    </VBtn>

    <!-- Header Principal -->
    <div class="bg-gradient-to-br from-umsa-blue via-[#005a96] to-[#004270] rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-umsa-blue/20 flex flex-col lg:flex-row justify-between items-center gap-6 md:gap-8 border border-white/10">
      <div class="absolute top-0 right-0 w-96 h-96 bg-umsa-gold/20 rounded-full blur-3xl -mr-32 -mt-32 mix-blend-screen pointer-events-none"></div>
      
      <div class="relative z-10 w-full lg:w-2/3 text-center lg:text-left">
        <div class="flex items-center justify-center lg:justify-start gap-2 md:gap-3 mb-6 flex-wrap">
          <span class="px-3 md:px-4 py-1 md:py-1.5 bg-umsa-gold text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-umsa-gold/30">
            {{ curso.version }}
          </span>
          <span class="px-3 md:px-4 py-1 md:py-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-full">
            <span class="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {{ curso.estado }}
          </span>
        </div>
        
        <h1 class="text-2xl md:text-4xl lg:text-5xl font-black leading-tight uppercase italic mb-2 tracking-tight">
          {{ curso.nombre }}
        </h1>
        <p class="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-4">
          Evento: {{ curso.evento }}
        </p>
        <p class="text-blue-50 text-xs md:text-sm lg:text-base leading-relaxed max-w-3xl border-l-4 border-umsa-gold pl-4 font-medium opacity-90 mx-auto lg:mx-0">
          {{ curso.descripcion }}
        </p>
      </div>

      <div v-if="tienePermisos" class="relative z-10 flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:min-w-[220px] lg:flex-col">
        <RouterLink :to="`/ponente/curso/${actividadId}/aula`" class="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#003B71]"><VIcon size="20">video_library</VIcon>Editar aula virtual</RouterLink>
        <button type="button" class="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-xs font-black uppercase tracking-widest text-umsa-blue shadow-xl lg:w-full" @click="switchTab('qr')">
          <VIcon class="material-symbols-outlined text-[20px]">qr_code_scanner</VIcon>
          Generar QR
        </button>
        <button type="button" class="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-umsa-gold px-6 text-xs font-black uppercase tracking-widest text-white shadow-xl lg:w-full" @click="navigateToCalificaciones()">
          <VIcon class="material-symbols-outlined text-[20px]">grading</VIcon>
          Notas
        </button>
      </div>
      
      <!-- Si no tiene permisos, mostrar badge de catálogo -->
      <VCard v-else class="relative z-10 bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 text-center flex flex-col items-center gap-2 w-full lg:w-auto">
            <VIcon class="material-symbols-outlined text-3xl md:text-4xl text-umsa-gold/50">visibility</VIcon>
            <p class="text-[10px] font-black uppercase tracking-widest text-white/60">Vista de Catálogo</p>
            <p class="text-[8px] font-bold text-white/40 uppercase">No asignado como ponente</p>
      </VCard>
    </div>

    <div class="flex gap-2 overflow-x-auto rounded-2xl border border-sky-100 bg-sky-50/70 p-1.5 dark:border-slate-700 dark:bg-slate-900">
      <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold" :class="activeTab === 'resumen' ? 'bg-white text-[#003B71] shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:text-[#003B71]'" @click="switchTab('resumen')">
        <VIcon class="material-symbols-outlined text-[18px] text-[#0070BB]">dashboard</VIcon>
        Panel central
      </button>
      <template v-if="tienePermisos">
        <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold" :class="activeTab === 'materiales' ? 'bg-white text-[#003B71] shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:text-[#003B71]'" @click="switchTab('materiales')">
          <VIcon class="material-symbols-outlined text-[18px] text-[#0070BB]">auto_stories</VIcon>
          Materiales
        </button>
      </template>
      <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold" :class="activeTab === 'estudiantes' ? 'bg-white text-[#003B71] shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:text-[#003B71]'" @click="switchTab('estudiantes')">
        <VIcon class="material-symbols-outlined text-[18px] text-[#0070BB]">groups</VIcon>
        Nómina ({{ curso.estudiantesInscritos }})
      </button>
      <template v-if="tienePermisos">
        <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold" :class="activeTab === 'qr' ? 'bg-white text-[#003B71] shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:text-[#003B71]'" @click="switchTab('qr')">
          <VIcon class="material-symbols-outlined text-[18px] text-[#0070BB]">qr_code_2</VIcon>
          Asistencia
        </button>
        <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold" :class="activeTab === 'certificados' ? 'bg-white text-[#003B71] shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:text-[#003B71]'" @click="router.push({ name: 'ponente-certificados' })">
          <VIcon class="material-symbols-outlined text-[18px] text-[#0070BB]">workspace_premium</VIcon>
          Mis certificados
        </button>
      </template>
    </div>

    <div v-show="activeTab === 'resumen'" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div class="flex items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:col-span-2">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-500">Modalidad y fechas</p>
          <h4 class="mt-1 text-lg font-semibold text-[#003B71] dark:text-white">{{ curso.modalidad }} · {{ curso.fechas }}</h4>
        </div>
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0070BB] dark:bg-slate-800">
          <VIcon class="material-symbols-outlined text-2xl">event_upcoming</VIcon>
        </div>
      </div>
      <div class="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p class="text-sm font-medium text-slate-500">Participantes inscritos</p>
        <h4 class="mt-2 text-3xl font-semibold text-[#003B71] dark:text-white">{{ curso.estudiantesInscritos }}</h4>
      </div>
      <button v-if="tienePermisos" type="button" class="rounded-2xl border border-sky-200 bg-sky-50 p-6 text-left shadow-sm transition hover:border-[#0070BB] dark:border-sky-900 dark:bg-slate-800" @click="switchTab('qr')">
        <p class="text-sm font-medium text-[#0070BB]">Asistencia</p>
        <h4 class="mt-1 text-lg font-semibold text-[#003B71] dark:text-white">Registrar la sesión de hoy</h4>
        <span class="mt-4 inline-block text-sm font-semibold text-[#0070BB]">Abrir asistencia</span>
      </button>
    </div>

    <!-- Tabla de Estudiantes (Disponible para todos) -->
    <VCard v-if="activeTab === 'estudiantes'" class="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm overflow-hidden p-2">
        <div class="overflow-x-auto">
            <VTable class="w-full text-left min-w-[600px]">
                <thead class="bg-slate-50/50 dark:bg-black/20">
                    <tr>
                        <th class="px-4 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estudiante</th>
                        <th class="px-4 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo Institucional</th>
                        <th class="px-4 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estatus Académico</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="est in estudiantes" :key="est.id" class="border-b border-slate-50 dark:border-gray-800/50 hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-all">
                        <td class="px-4 md:px-8 py-5">
                           <div class="text-sm font-black text-slate-700 dark:text-white uppercase italic tracking-tighter">{{ est.nombre }}</div>
                        </td>
                        <td class="px-4 md:px-8 py-5 text-xs text-slate-500 font-bold">{{ est.correo }}</td>
                        <td class="px-4 md:px-8 py-5 text-right">
                            <span class="px-3 py-1 bg-blue-50 dark:bg-blue-900/10 text-umsa-blue text-[9px] font-black uppercase rounded-lg border border-blue-100 dark:border-blue-800/50 whitespace-nowrap">
                                Pre-Inscrito
                            </span>
                        </td>
                    </tr>
                </tbody>
            </VTable>
        </div>
    </VCard>

    <!-- SECCIONES SEGURAS -->
    <VCard v-if="activeTab === 'qr' && tienePermisos" class="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 shadow-xl">
        <div class="flex flex-col xl:flex-row gap-8 xl:gap-12 items-start">
            <div class="flex-1 w-full xl:max-w-lg">
                <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase italic mb-4">Registro de Asistencia</h3>
                <p class="text-slate-500 text-sm leading-relaxed mb-6">Selecciona la sesión activa y el método de registro de asistencia.</p>
                
                <div class="mb-8 bg-slate-50 dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700">
                    <label for="sesion-activa" class="text-[10px] font-black text-slate-400 uppercase mb-2 block">Sesión Académica Activa</label>
                    <select v-if="sesiones.length > 0" id="sesion-activa" v-model="activeSessionId" class="w-full max-w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-umsa-blue/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                        <option v-for="s in sesiones" :key="s.id" :value="s.id">
                            {{ s.modalidad_nombre || 'Presencial' }} · {{ s.fecha ? new Date(s.fecha).toLocaleDateString() : (s.dia || 'Sin fecha') }}<template v-if="s.hora_inicio"> · {{ String(s.hora_inicio).slice(0, 5) }}–{{ String(s.hora_fin || '').slice(0, 5) }}</template>
                        </option>
                    </select>
                    <div v-else class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p class="text-xs font-semibold text-amber-800 dark:text-amber-300">{{ avisoAsistencia }}</p>
                    </div>
                    
                    <!-- Registros Requeridos -->
                    <div v-if="sesiones.length > 0" class="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
                        <label for="registros-hoy" class="text-[10px] font-black text-slate-400 uppercase mb-2 block">Registros para el día de hoy</label>
                        <input id="registros-hoy" v-model.number="registrosRequeridos" type="number" min="1" class="w-full max-w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-umsa-blue/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row gap-4">
                    <VBtn @click="switchQrMode('project')" :class="qrMode === 'project' ? 'bg-umsa-blue text-white shadow-xl shadow-umsa-blue/20' : 'bg-slate-100 text-slate-500'" class="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Proyectar QR
                    </VBtn>
                    <VBtn @click="switchQrMode('scan')" :class="qrMode === 'scan' ? 'bg-umsa-blue text-white shadow-xl shadow-umsa-blue/20' : 'bg-slate-100 text-slate-500'" class="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Escanear Alumnos
                    </VBtn>
                </div>
            </div>

            <!-- Panel Derecho (Proyectar o Escanear) -->
            <div class="flex-1 flex justify-center items-center w-full min-h-[320px] mt-8 xl:mt-0">
                <VCard v-if="qrMode === 'project'" class="bg-white p-6 md:p-10 rounded-[2.5rem] border-[8px] md:border-[12px] border-slate-100 shadow-2xl flex flex-col items-center justify-center w-full max-w-sm transition-all animate-in zoom-in-95 duration-500">
                    <div v-if="!isQrVisible || !activeSessionId" class="text-center p-12 text-slate-400 flex flex-col items-center gap-4">
                        <VIcon class="material-symbols-outlined text-5xl opacity-20">ads_click</VIcon>
                        <p class="text-xs font-black uppercase tracking-widest leading-relaxed">Configura los registros<br>y haz clic en "Proyectar QR"</p>
                    </div>
                    <template v-else>
                        <QrcodeVue :value="qrData" :size="200" :level="'H'" class="md:hidden" />
                        <QrcodeVue :value="qrData" :size="250" :level="'H'" class="hidden md:block" />
                        <p class="text-xs font-bold text-slate-400 mt-6 text-center">Los alumnos deben escanear este código con la cámara de su celular desde el portal</p>
                        
                        <!-- PIN Section -->
                        <div class="mt-6 border-t border-slate-100 dark:border-gray-800 pt-4 w-full text-center">
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">O comparte el PIN de asistencia:</p>
                            <div class="bg-slate-50 dark:bg-gray-800 px-6 py-3 rounded-xl border border-slate-200 dark:border-gray-700 mb-4">
                                <span class="text-2xl font-black text-primary-dark dark:text-white tracking-[0.2em]">{{ generatedPin }}</span>
                            </div>
                            
                            <!-- Regenerate Button -->
                            <VBtn @click="regenerarCodigo" class="text-[10px] font-black text-umsa-blue dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mx-auto hover:text-umsa-gold transition-colors">
                                <VIcon class="material-symbols-outlined text-[16px]">sync</VIcon>
                                Regenerar Código (Actual: {{ qrCounter }})
                            </VBtn>
                        </div>
                    </template>
                </VCard>

                <div v-if="qrMode === 'scan'" class="w-full max-w-md bg-black rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col items-center">
                    <div id="reader" class="w-full min-h-[300px] border-none bg-black"></div>
                    
                    <!-- Simular Escaneo Button -->
                    <VBtn @click="simularEscaneo" class="mb-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2">
                        <VIcon class="material-symbols-outlined text-[16px]">qr_code_scanner</VIcon>
                        Simular Escaneo (Prueba)
                    </VBtn>
                </div>
            </div>
        </div>
    </VCard>

    <section v-if="activeTab === 'materiales' && tienePermisos" class="space-y-6 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-8">
        <div class="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div>
                <h3 class="text-xl font-semibold text-[#003B71] dark:text-white">Material de la actividad</h3>
                <p class="mt-1 text-sm text-slate-500">Cada recurso queda en la fecha de la clase. El estudiante lo ve igual, en su pestaña Materiales, cuando su inscripción está aprobada.</p>
            </div>
            <button v-if="puedeSubirMaterial" type="button" class="shrink-0 rounded-xl bg-[#0070BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#003B71]" @click="mostrarFormMaterial = !mostrarFormMaterial">
                {{ mostrarFormMaterial ? 'Cancelar' : 'Agregar material' }}
            </button>
        </div>

        <form v-if="mostrarFormMaterial && puedeSubirMaterial" class="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-5 dark:border-slate-700 dark:bg-slate-800" @submit.prevent="guardarMaterial">
            <h4 class="text-base font-semibold text-[#003B71] dark:text-white">Nuevo recurso</h4>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div class="min-w-0 md:col-span-1">
                    <label for="fecha-clase" class="mb-1 block text-sm font-medium text-slate-600">Fecha de la clase</label>
                    <input id="fecha-clase" v-model="nuevoMaterial.fecha" type="date" required class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </div>
                <div class="min-w-0">
                    <label for="titulo-material" class="mb-1 block text-sm font-medium text-slate-600">Título</label>
                    <input id="titulo-material" v-model="nuevoMaterial.titulo" type="text" required placeholder="Diapositivas de la sesión" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </div>
                <div class="min-w-0">
                    <label for="tipo-recurso" class="mb-1 block text-sm font-medium text-slate-600">Tipo</label>
                    <select id="tipo-recurso" v-model="nuevoMaterial.tipo" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                        <option value="Archivo">Documento</option>
                        <option value="Enlace">Enlace web</option>
                    </select>
                </div>
            </div>
            <div v-if="nuevoMaterial.tipo === 'Enlace'">
                <label for="url-material" class="mb-1 block text-sm font-medium text-slate-600">Dirección</label>
                <input id="url-material" v-model="nuevoMaterial.url" type="url" placeholder="https://..." class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
            </div>
            <div v-else>
                <label for="archivo-material" class="mb-1 block text-sm font-medium text-slate-600">Documento</label>
                <label for="archivo-material" class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sky-300 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                    <span class="rounded-lg bg-sky-100 px-3 py-1.5 text-sm font-semibold text-[#003B71]">Elegir archivo</span>
                    <span class="min-w-0 truncate">{{ selectedFile ? `${selectedFile.name} · ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Ningún archivo elegido' }}</span>
                    <input id="archivo-material" ref="archivoInput" type="file" class="sr-only" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip" @change="handleFileChange" />
                </label>
            </div>
            <div class="flex justify-end">
                <button type="submit" class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" :disabled="subiendoMaterial">
                    {{ subiendoMaterial ? 'Guardando...' : 'Publicar en esta fecha' }}
                </button>
            </div>
        </form>

        <p v-if="materiales.length === 0" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Todavía no hay material. Agrega el primero y elige la fecha de la clase.</p>
        <div v-else class="space-y-6">
            <section v-for="grupo in materialesPorFecha" :key="grupo.clave" class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                <h4 class="bg-sky-50 px-4 py-3 text-sm font-semibold capitalize text-[#003B71] dark:bg-slate-800 dark:text-sky-100">{{ grupo.titulo }}</h4>
                <ul>
                    <li v-for="mat in grupo.items" :key="mat.id" class="flex items-center gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                        <VIcon class="material-symbols-outlined shrink-0 text-2xl" :class="mat.tipo === 'Enlace' ? 'text-[#0070BB]' : 'text-rose-600'">{{ mat.tipo === 'Enlace' ? 'link' : 'description' }}</VIcon>
                        <button type="button" class="min-w-0 flex-1 text-left" @click="openMaterial(mat)">
                            <span class="block truncate text-sm font-semibold text-slate-800 dark:text-white">{{ mat.titulo }}</span>
                            <span class="block truncate text-xs text-slate-500">{{ mat.tipo === 'Enlace' ? 'Enlace' : (mat.nombreArchivo || 'Documento') }}<template v-if="mat.tamaño"> · {{ mat.tamaño }}</template></span>
                        </button>
                        <button type="button" class="shrink-0 text-sm font-semibold text-rose-600 hover:text-rose-800" @click="eliminarMaterial(mat.id)">Quitar</button>
                    </li>
                </ul>
            </section>
        </div>
    </section>

  </div>
</template>
