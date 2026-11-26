<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api, { imagenActividad, imagenEvento, resolveMediaUrl } from '@/services/api';
import Swal from '@/services/dialogs';
import { permisosContenido } from '@/utils/activityLearning';
import { leerAcceso } from '@/utils/activityAcceso';
import ActivityAccesoBanner from '@/components/actividades/ActivityAccesoBanner.vue';
import NotasRubricaGrid from '@/components/actividades/NotasRubricaGrid.vue';
import CursoVirtualView from '@/views/actividades/CursoVirtualView.vue';
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
    if (partes) return `${partes[3]!}-${partes[2]!.padStart(2, '0')}-${partes[1]!.padStart(2, '0')}`;
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
const aulaDraft = ref('');
const enlaceDraft = ref('');
const sesionesDraft = ref<{ dia: string; hora_inicio: string; hora_fin: string }[]>([]);
const guardandoLugar = ref(false);
const editandoNotas = ref(false);
const repartoNota = computed(() => {
  const items = Array.isArray(curso.value?.requisitos?.evaluacion?.items) ? curso.value.requisitos.evaluacion.items : [];
  const suma = (tipos: string[]) => items.filter((item: any) => tipos.includes(item.tipo)).reduce((total: number, item: any) => total + Number(item.puntaje || 0), 0);
  return {
    asistencia: Number(curso.value?.requisitos?.evaluacion?.asistencia || 0),
    parciales: suma(['examen', 'seccion']),
    practicas: suma(['practica', 'laboratorio']),
  };
});
const aulaTipo = ref<'material' | 'practica' | 'examen'>('material');
function abrirAula(tipo: 'material' | 'practica' | 'examen' = 'material') {
  aulaTipo.value = tipo;
  switchTab('aula');
}
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

const fetchDetalleActividad = async (silencioso = false) => {
    if (!silencioso) loading.value = true;
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
        
        const descripcionLimpia = String(data.descripcion || '')
          .replace(/\[INHABILITACION_MOTIVO\]:?[^\n\[]*/gi, '')
          .replace(/\[FECHA(_INHABILITACION)?\]:?[^\n\[]*/gi, '')
          .replace(/\[SOLICITUD_ACTIVACION\]:?[^\n\[]*/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        curso.value = {
            id: data.id,
            tipo: data.tipo,
            requisitos: data.requisitos,
            nombre: data.nombre || 'Simposio / Actividad',
            evento: data.evento?.nombre || 'Evento Académico',
            eventoId: data.evento?.id || data.id_evento || null,
            version: data.version || data.evento?.gestion || 'Gestión 2026',
            fechas: `${data.fecha_inicio ? new Date(data.fecha_inicio).toLocaleDateString() : 'Pendiente'} - ${data.fecha_fin ? new Date(data.fecha_fin).toLocaleDateString() : 'Pendiente'}`,
            estudiantesInscritos: data.inscripciones?.length || 0,
            estado: data.estado === 1 ? 'Activo' : 'Cerrado',
            modalidad: data.modalidad || data.modalidades?.[0]?.tipo || 'Presencial',
            descripcion: descripcionLimpia,
            imagen: imagenActividad(data),
            imagenEvento: imagenEvento(data.evento),
            horas: data.horas ?? null,
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
        const acceso = leerAcceso(data.requisitos);
        aulaDraft.value = acceso.aula_fisica;
        enlaceDraft.value = acceso.enlace_virtual;
        sesionesDraft.value = allSesiones
          .filter((s) => !s.fecha && s.dia)
          .map((s) => ({
            dia: s.dia,
            hora_inicio: String(s.hora_inicio || '19:00').slice(0, 5),
            hora_fin: String(s.hora_fin || '21:00').slice(0, 5),
          }));

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
    switchTab('notas');
};

const guardarLugarYSesion = async (payload?: { aula_fisica: string; enlace_virtual: string; sesiones: { dia: string; hora_inicio: string; hora_fin: string }[] }) => {
  if (payload) {
    aulaDraft.value = payload.aula_fisica;
    enlaceDraft.value = payload.enlace_virtual;
    sesionesDraft.value = payload.sesiones.map((sesion) => ({ ...sesion }));
  }
  guardandoLugar.value = true;
  try {
    await api.patch(`/actividades-academicas/${actividadId}/acceso-sesion`, {
      aula_fisica: aulaDraft.value,
      enlace_virtual: enlaceDraft.value,
      sesiones: sesionesDraft.value,
    });
    Swal.fire({ icon: 'success', title: 'Aula y horario guardados', timer: 1400, showConfirmButton: false });
    await fetchDetalleActividad();
  } catch (error: any) {
    const detalle = error?.response?.data?.message;
    Swal.fire('No se guardó', Array.isArray(detalle) ? detalle.join(' ') : (detalle || 'Revisa el aula y el horario.'), 'error');
  } finally {
    guardandoLugar.value = false;
  }
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

  <div v-else-if="curso" class="mx-auto max-w-7xl animate-in space-y-6 pb-20 fade-in duration-500">
    <nav aria-label="Dónde estás" class="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1A4756]">
      <RouterLink :to="{ name: 'ponente-eventos' }" class="hover:text-[#028191]">Mis eventos</RouterLink>
      <span aria-hidden="true">›</span>
      <RouterLink v-if="curso.eventoId" :to="{ name: 'ponente-curso', params: { evento_id: curso.eventoId } }" class="hover:text-[#028191]">{{ curso.evento }}</RouterLink>
      <span v-else>{{ curso.evento }}</span>
      <span aria-hidden="true">›</span>
      <span class="text-[#012248]">{{ curso.nombre }}</span>
    </nav>

    <!-- Hero tipo estudiante: banner del evento / portada del curso -->
    <section class="overflow-hidden rounded-[2rem] border border-slate-200/60 shadow-2xl dark:border-slate-800">
      <div class="group/hero relative flex min-h-[320px] flex-col justify-end md:min-h-[420px]">
        <img
          :src="curso.imagenEvento || curso.imagen"
          data-course-image
          :alt="curso.evento"
          class="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-[2s] ease-out group-hover/hero:scale-105"
        >
        <div class="absolute inset-0 bg-gradient-to-t from-[#011628] via-[#012248]/85 to-[#012248]/25"></div>
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(2,129,145,0.28),transparent_55%)]"></div>

        <div class="relative z-10 flex flex-col gap-6 p-6 md:p-10 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div class="min-w-0 max-w-3xl">
            <div class="mb-4 flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-umsa-gold px-3 py-1 text-[9px] font-black tracking-widest text-white uppercase shadow-lg md:text-[10px]">{{ curso.version }}</span>
              <span class="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[9px] font-black tracking-widest text-white uppercase backdrop-blur-md md:text-[10px]">
                <span class="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></span>{{ curso.estado }}
              </span>
              <span class="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[9px] font-black tracking-widest text-sky-100 uppercase backdrop-blur-md md:text-[10px]">{{ curso.tipo || curso.modalidad }}</span>
            </div>

            <h1 class="text-3xl leading-none font-black tracking-tight text-white drop-shadow-lg md:text-5xl lg:text-6xl">{{ curso.nombre }}</h1>

            <RouterLink
              v-if="curso.eventoId"
              :to="{ name: 'ponente-curso', params: { evento_id: curso.eventoId } }"
              class="mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/20 bg-white/95 px-4 py-3 text-left text-[#012248] shadow-xl backdrop-blur-sm transition hover:bg-white"
            >
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#012248] text-white">
                <span class="material-symbols-outlined text-[20px] leading-none">event</span>
              </span>
              <span class="min-w-0">
                <span class="block text-[10px] font-black tracking-[0.18em] text-[#028191] uppercase">Pertenece al evento</span>
                <span class="block truncate text-base font-black">{{ curso.evento }}</span>
              </span>
            </RouterLink>
            <div v-else class="mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/20 bg-white/95 px-4 py-3 text-left text-[#012248]">
              <span class="min-w-0">
                <span class="block text-[10px] font-black tracking-[0.18em] text-[#028191] uppercase">Pertenece al evento</span>
                <span class="block text-base font-black">{{ curso.evento }}</span>
              </span>
            </div>

            <p v-if="curso.descripcion" class="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200/95 md:text-base">{{ curso.descripcion }}</p>
            <p class="mt-3 text-xs font-bold tracking-wide text-sky-100/90 uppercase">{{ curso.modalidad }} · {{ curso.fechas }}</p>
          </div>

          <div v-if="tienePermisos" class="flex w-full shrink-0 flex-col gap-2.5 sm:flex-row lg:w-[240px] lg:flex-col">
            <button type="button" class="btn-hint-pulse flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-[#028191] shadow-xl" @click="abrirAula('material')">
              <span class="material-symbols-outlined text-[20px] leading-none">view_list</span>
              Secciones del curso
            </button>
            <button type="button" class="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-5 text-xs font-black tracking-widest text-white uppercase backdrop-blur-md transition hover:bg-white/25" @click="switchTab('qr')">
              <span class="material-symbols-outlined text-[20px] leading-none">qr_code_scanner</span>
              Generar QR
            </button>
            <button type="button" class="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#028191] px-5 text-xs font-black tracking-widest text-white uppercase shadow-xl" @click="navigateToCalificaciones()">
              <span class="material-symbols-outlined text-[20px] leading-none">grading</span>
              Distribución de notas
            </button>
          </div>

          <div v-else class="flex min-w-[180px] flex-col items-center gap-2 rounded-2xl border border-white/20 bg-black/35 p-5 text-center backdrop-blur-md">
            <span class="material-symbols-outlined text-3xl text-umsa-gold/70">visibility</span>
            <p class="text-[10px] font-black tracking-widest text-white/80 uppercase">Vista de catálogo</p>
            <p class="text-[9px] font-bold text-white/50 uppercase">No asignado como ponente</p>
          </div>
        </div>
      </div>

      <div class="border-t border-slate-100 bg-[#f7fbfd] p-4 md:p-5 dark:border-slate-800 dark:bg-slate-950">
        <ActivityAccesoBanner
          compact
          :editable="tienePermisos"
          :requisitos="curso.requisitos"
          :modalidad="curso.modalidad"
          :sesiones="sesionesDraft"
          :guardando="guardandoLugar"
          @guardar="guardarLugarYSesion"
        />
      </div>
    </section>

    <div class="flex gap-2 overflow-x-auto rounded-2xl border border-[#028191]/25 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold" :class="activeTab === 'resumen' ? 'bg-[#028191] text-white shadow-sm' : 'text-[#1A4756] hover:bg-[#E4F1DD]/60'" @click="switchTab('resumen')">
        <span class="material-symbols-outlined text-[18px] leading-none">dashboard</span>
        Panel central
      </button>
      <template v-if="tienePermisos">
        <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold" :class="activeTab === 'aula' ? 'bg-[#028191] text-white shadow-sm' : 'text-[#1A4756] hover:bg-[#E4F1DD]/60'" @click="abrirAula('material')">
          <span class="material-symbols-outlined text-[18px] leading-none">view_list</span>
          Secciones
        </button>
      </template>
      <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold" :class="activeTab === 'estudiantes' ? 'bg-[#028191] text-white shadow-sm' : 'text-[#1A4756] hover:bg-[#E4F1DD]/60'" @click="switchTab('estudiantes')">
        <span class="material-symbols-outlined text-[18px] leading-none">groups</span>
        Nómina ({{ curso.estudiantesInscritos }})
      </button>
      <template v-if="tienePermisos">
        <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold" :class="activeTab === 'notas' ? 'bg-[#028191] text-white shadow-sm' : 'text-[#1A4756] hover:bg-[#E4F1DD]/60'" @click="switchTab('notas')">
          <span class="material-symbols-outlined text-[18px] leading-none">grading</span>
          Notas
        </button>
        <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold" :class="activeTab === 'qr' ? 'bg-[#028191] text-white shadow-sm' : 'text-[#1A4756] hover:bg-[#E4F1DD]/60'" @click="switchTab('qr')">
          <span class="material-symbols-outlined text-[18px] leading-none">qr_code_2</span>
          Asistencia
        </button>
        <button type="button" class="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold" :class="activeTab === 'certificados' ? 'bg-[#028191] text-white shadow-sm' : 'text-[#1A4756] hover:bg-[#E4F1DD]/60'" @click="router.push({ name: 'ponente-certificados' })">
          <span class="material-symbols-outlined text-[18px] leading-none">workspace_premium</span>
          Mis certificados
        </button>
      </template>
    </div>

    <div v-show="activeTab === 'resumen'" class="space-y-5">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E4F1DD] text-[#1A4756]">
            <span class="material-symbols-outlined text-[22px] leading-none">event_upcoming</span>
          </div>
          <p class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Modalidad y fechas</p>
          <h4 class="mt-1 text-base font-black text-[#012248] dark:text-white">{{ curso.modalidad }}</h4>
          <p class="mt-1 text-sm font-semibold text-slate-500">{{ curso.fechas }}</p>
          <p v-if="curso.horas" class="mt-2 text-xs font-bold text-[#028191]">{{ curso.horas }} hrs académicas</p>
        </article>

        <button type="button" class="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#028191] hover:shadow-md dark:border-slate-700 dark:bg-slate-900" @click="switchTab('estudiantes')">
          <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-[#0070BB]">
            <span class="material-symbols-outlined text-[22px] leading-none">groups</span>
          </div>
          <p class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Participantes</p>
          <h4 class="mt-1 text-3xl font-black text-[#012248] dark:text-white">{{ curso.estudiantesInscritos }}</h4>
          <p class="mt-2 text-xs font-bold text-[#028191]">Ver nómina →</p>
        </button>

        <button
          v-if="tienePermisos"
          type="button"
          class="btn-hint-pulse rounded-2xl border border-[#028191]/30 bg-gradient-to-br from-[#028191] to-[#1A4756] p-5 text-left text-white shadow-md"
          @click="switchTab('qr')"
        >
          <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <span class="material-symbols-outlined text-[22px] leading-none">qr_code_2</span>
          </div>
          <p class="text-[11px] font-bold tracking-widest text-sky-100 uppercase">Asistencia de hoy</p>
          <h4 class="mt-1 text-base font-black">Registrar sesión</h4>
          <p class="mt-2 text-xs font-semibold text-sky-100">Abrir QR / PIN →</p>
        </button>

        <button
          v-if="tienePermisos"
          type="button"
          class="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#028191] hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
          @click="abrirAula('material')"
        >
          <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E4F1DD] text-[#1A4756]">
            <span class="material-symbols-outlined text-[22px] leading-none">auto_stories</span>
          </div>
          <p class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Aula virtual</p>
          <h4 class="mt-1 text-base font-black text-[#012248] dark:text-white">Secciones y material</h4>
          <p class="mt-2 text-xs font-bold text-[#028191]">Gestionar contenidos →</p>
        </button>
      </div>

      <section v-if="tienePermisos" class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#012248] text-white">
            <span class="material-symbols-outlined text-[20px] leading-none">pie_chart</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black tracking-[0.16em] text-[#028191] uppercase">Distribución de la nota</p>
            <div class="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm font-black text-[#012248] dark:text-white">
              <span>Asistencia {{ repartoNota.asistencia }}%</span>
              <span>Parciales {{ repartoNota.parciales }}%</span>
              <span>Prácticas {{ repartoNota.practicas }}%</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-hint-pulse inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black tracking-widest text-[#003B71] uppercase hover:bg-slate-50 dark:border-slate-600 dark:text-sky-200"
            :aria-label="editandoNotas ? 'Cerrar edición de notas' : 'Editar distribución de notas'"
            @click="editandoNotas = !editandoNotas"
          >
            <span class="material-symbols-outlined text-[16px] leading-none">{{ editandoNotas ? 'close' : 'edit' }}</span>
            {{ editandoNotas ? 'Cerrar' : 'Editar' }}
          </button>
        </div>
        <div v-if="editandoNotas" class="px-5 py-4">
          <NotasRubricaGrid :actividad-id="String(actividadId)" seccion-inicial="ponderacion" @guardado="fetchDetalleActividad(true)" />
        </div>
        <div v-else class="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
          <div class="px-4 py-4 text-center">
            <p class="text-2xl font-black text-[#028191]">{{ repartoNota.asistencia }}%</p>
            <p class="mt-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Asistencia</p>
          </div>
          <div class="px-4 py-4 text-center">
            <p class="text-2xl font-black text-[#012248] dark:text-white">{{ repartoNota.parciales }}%</p>
            <p class="mt-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Parciales</p>
          </div>
          <div class="px-4 py-4 text-center">
            <p class="text-2xl font-black text-[#1A4756] dark:text-sky-200">{{ repartoNota.practicas }}%</p>
            <p class="mt-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Prácticas</p>
          </div>
        </div>
      </section>
    </div>

    <CursoVirtualView v-if="activeTab === 'aula' && tienePermisos" :activity-id="Number(actividadId)" embedded :initial-type="aulaTipo" />

    <section v-if="activeTab === 'notas' && tienePermisos" class="space-y-4">
      <div class="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 class="text-lg font-semibold text-[#003B71] dark:text-white">Distribución de notas</h3>
        <p class="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Aquí solo se reparte el 100% entre asistencia, parciales y prácticas. El material y las entregas se gestionan en la pestaña Secciones.
        </p>
        <button type="button" class="btn-hint-pulse mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#028191]" @click="abrirAula('material')">
          Ir a Secciones <span class="material-symbols-outlined text-[16px] leading-none">arrow_forward</span>
        </button>
      </div>
      <NotasRubricaGrid :actividad-id="String(actividadId)" @guardado="fetchDetalleActividad(true)" />
    </section>

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


  </div>
</template>
