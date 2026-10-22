<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { getImageUrl } from '@/services/api';
import Swal from '@/services/dialogs';
import { useAuthStore } from '@/stores/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ActivityRequirementsEditor from '@/components/actividades/ActivityRequirementsEditor.vue';
import ActivityContentAccess from '@/components/actividades/ActivityContentAccess.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref('estudiantes');
const isLoading = ref(false);
const actividad = ref<any>(null);
const inscritos = ref<any[]>([]);
const imparticiones = ref<any[]>([]);
const solicitudSeleccionada = ref<any>(null);

// Estado para la edición
const isEditing = ref(false);
const editForm = ref({
    nombre: '',
    tipo: '',
    descripcion: '',
    modalidad: 'Presencial',
    min_nota: 51,
    min_asistencia: 80,
    fecha_inicio: '',
    fecha_fin: '',
    horas: 0,
    id_evento: null as number | null,
    sesiones: [] as any[],
    requisitos: {} as any,
    logistica_ids: [] as number[]
});
const nuevaSesion = ref({ dia: 'Lunes', hora_inicio: '19:00', hora_fin: '21:00' });
const imagenArchivo = ref<File | null>(null);
const imagenPreview = ref<string | null>(null);
const isSaving = ref(false);
const requisitosError = ref('');

const prepararRequisitos = (valor: any) => {
    requisitosError.value = '';
    try {
        const parsed = typeof valor === 'string' ? JSON.parse(valor) : (valor ?? {});
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        const copia = JSON.parse(JSON.stringify(parsed));
        if (copia.base != null && (typeof copia.base !== 'object' || Array.isArray(copia.base))) throw new Error();
        if (copia.custom != null && (!Array.isArray(copia.custom) || copia.custom.some((item: any) => !item || typeof item !== 'object' || (item.options != null && !Array.isArray(item.options))))) throw new Error();
        if (copia.presentacion != null && (typeof copia.presentacion !== 'object' || Array.isArray(copia.presentacion))) throw new Error();
        return { ...copia, base: { ...(copia.base || {}) }, custom: copia.custom || [], presentacion: { objetivos: '', publico_objetivo: '', ...(copia.presentacion || {}) } };
    } catch {
        requisitosError.value = 'No se pudieron cargar los requisitos existentes. No se guardarán cambios para evitar perder esa configuración.';
        return null;
    }
};

const descartarEdicion = () => {
    isEditing.value = false;
    if (imagenPreview.value) URL.revokeObjectURL(imagenPreview.value);
    imagenPreview.value = null;
    imagenArchivo.value = null;
};

const abrirEdicion = () => {
    const mod = actividad.value?.modalidades?.[0];
    if (!actividad.value) return;
    editForm.value = {
        nombre: actividad.value.nombre || '', tipo: actividad.value.tipo || '', descripcion: actividad.value.descripcion || '',
        modalidad: mod?.tipo || 'Presencial', min_nota: mod?.min_nota ?? 51, min_asistencia: mod?.min_asistencia ?? 80,
        fecha_inicio: actividad.value.fecha_inicio?.slice(0, 10) || '', fecha_fin: actividad.value.fecha_fin?.slice(0, 10) || '',
        horas: actividad.value.horas || 0, id_evento: actividad.value.evento?.id || null,
        sesiones: JSON.parse(JSON.stringify(mod?.sesiones || [])), requisitos: prepararRequisitos(actividad.value.requisitos),
        logistica_ids: [...(actividad.value.logistica_ids || [])],
    };
    nuevaSesion.value = { dia: 'Lunes', hora_inicio: '19:00', hora_fin: '21:00' };
    isEditing.value = true;
};

// Estado para ponentes y logística
const ponentesExistentes = ref<any[]>([]);
const ponenteSeleccionado = ref<string>('');
const ponenteForm = ref({
    email: '',
    nombres: '',
    primer_apellido: '',
    tematica: ''
});

const logisticaExistentes = ref<any[]>([]);
const filtroLogistica = ref('');

const logisticaFiltrada = computed(() => {
  if (!filtroLogistica.value) return logisticaExistentes.value;
  const f = filtroLogistica.value.toLowerCase();
  return logisticaExistentes.value.filter(u => 
    u.displayName?.toLowerCase().includes(f) || 
    (u.email || '').toLowerCase().includes(f)
  );
});

// Computed: personal de logística realmente asignado a esta actividad
const logisticaAsignada = computed(() => {
  const ids: number[] = actividad.value?.logistica_ids || [];
  return logisticaExistentes.value.filter(u => ids.includes(u.id));
});

const toggleLogisticaUsuario = (id: number) => {
  if (!editForm.value.logistica_ids) {
    editForm.value.logistica_ids = [];
  }
  const idx = editForm.value.logistica_ids.indexOf(id);
  if (idx > -1) {
    editForm.value.logistica_ids.splice(idx, 1);
  } else {
    editForm.value.logistica_ids.push(id);
  }
};

const asistenciasActividad = ref<any[]>([]);
const sesionSeleccionada = ref<any>(null);
const asistenciaSesionForm = ref<Record<number, number>>({});
const isSavingAsistencia = ref(false);

const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
};

const formatDate = (dateStr: any) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const userTimezoneOffset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() + userTimezoneOffset);
    return localDate.toLocaleDateString();
};

const getAsistenciasSesionCount = (sesionId: number) => {
    return asistenciasActividad.value.filter(a => a.sesionAcademica?.id === sesionId && Number(a.estado) === 1).length;
};

const verListaAsistenciaSesion = (sesion: any) => {
    sesionSeleccionada.value = sesion;
    const estados: Record<number, number> = {};
    alumnosActivos.value.forEach(est => {
        const inscModId = est.modalidades?.[0]?.id;
        if (inscModId) {
            const asis = asistenciasActividad.value.find(a => a.sesionAcademica?.id === sesion.id && a.inscripcionModalidad?.id === inscModId);
            estados[inscModId] = asis ? Number(asis.estado) : 0;
        }
    });
    asistenciaSesionForm.value = estados;
    openModal('modal-lista-asistencia-dinamica');
};

const toggleAsistenciaLocal = (inscModId: number) => {
    if (inscModId === undefined) return;
    asistenciaSesionForm.value[inscModId] = asistenciaSesionForm.value[inscModId] === 1 ? 0 : 1;
};

const guardarAsistenciaSesion = async () => {
    if (!sesionSeleccionada.value) return;
    try {
        isSavingAsistencia.value = true;
        const payload = {
            id_sesion_academica: sesionSeleccionada.value.id,
            asistencias: Object.entries(asistenciaSesionForm.value).map(([id_inscripcion_modalidad, estado]) => ({
                id_inscripcion_modalidad: Number(id_inscripcion_modalidad),
                estado: Number(estado)
            }))
        };
        
        Swal.fire({ title: 'Registrando asistencias...', didOpen: () => Swal.showLoading() });
        await api.post('/admin/asistencias/batch', payload);
        
        // Recargar asistencias
        const asisRes = await api.get(`/admin/asistencias/actividad/${route.params.id}`);
        asistenciasActividad.value = Array.isArray(asisRes.data) ? asisRes.data : (asisRes.data?.data || []);
        
        closeModal('modal-lista-asistencia-dinamica');
        Swal.fire('Guardado', 'La asistencia de la sesión ha sido actualizada.', 'success');
    } catch (error) {
        console.error('Error al guardar asistencia:', error);
        Swal.fire('Error', 'No se pudo registrar la asistencia.', 'error');
    } finally {
        isSavingAsistencia.value = false;
    }
};



const fetchData = async () => {
    try {
        isLoading.value = true;

        // Carga de la actividad (crítica)
        const actRes = await api.get(`/actividades-academicas/${route.params.id}`);
        actividad.value = actRes.data;

        // Preparar formulario de edición con valores seguros
        const mod = actividad.value.modalidades?.[0];
        editForm.value = {
            nombre: actividad.value.nombre || '',
            tipo: actividad.value.tipo || '',
            descripcion: actividad.value.descripcion || '',
            modalidad: mod?.tipo || 'Presencial',
            min_nota: mod?.min_nota ?? 51,
            min_asistencia: mod?.min_asistencia ?? 80,
            fecha_inicio: actividad.value.fecha_inicio || '',
            fecha_fin: actividad.value.fecha_fin || '',
            horas: actividad.value.horas || 0,
            id_evento: actividad.value.evento?.id || null,
            sesiones: Array.isArray(mod?.sesiones) ? JSON.parse(JSON.stringify(mod.sesiones)) : [],
            requisitos: prepararRequisitos(actividad.value.requisitos),
            logistica_ids: [...(actividad.value.logistica_ids || [])]
        };

        // Carga de inscripciones (crítica - muestra solicitudes y alumnos)
        try {
            const insRes = await api.get(`/admin/inscripciones/actividad/${route.params.id}`);
            inscritos.value = Array.isArray(insRes.data) ? insRes.data : (insRes.data?.data || []);
        } catch (e) {
            console.warn('No se pudieron cargar las inscripciones:', e);
            inscritos.value = [];
        }

        // Carga de imparticiones (no crítica - endpoint por actividad)
        try {
            const impRes = await api.get(`/imparticiones/actividad/${route.params.id}`);
            imparticiones.value = Array.isArray(impRes.data) ? impRes.data : (impRes.data?.data || []);
        } catch (e) {
            console.warn('No se pudieron cargar las imparticiones:', e);
            imparticiones.value = [];
        }

        // Carga de ponentes existentes (no crítica)
        try {
            const usersRes = await api.get('/usuarios?rol=Ponente&limit=100');
            ponentesExistentes.value = usersRes.data.data || usersRes.data;
        } catch (e) {
            console.warn('No se pudieron cargar los ponentes:', e);
            ponentesExistentes.value = [];
        }

        // Carga de personal de logística existente (no crítica)
        try {
            const usersRes = await api.get('/usuarios?rol=Logistica,Logística&limit=100');
            const dataU = usersRes.data?.data || usersRes.data || [];
            logisticaExistentes.value = dataU.map((u: any) => {
                const persona = u.persona || {};
                const gaObj = u.afiliaciones?.[0]?.gradoAcademico || {};
                const prefijo = gaObj.abreviacion ? `${gaObj.abreviacion}. ` : '';
                return { ...u, displayName: `${prefijo}${persona.nombres || ''} ${persona.primer_apellido || ''}`.trim() };
            });
        } catch (e) {
            console.warn('No se pudieron cargar los usuarios de logística:', e);
            logisticaExistentes.value = [];
        }

        // Carga de asistencias de la actividad (no crítica)
        try {
            const asisRes = await api.get(`/admin/asistencias/actividad/${route.params.id}`);
            asistenciasActividad.value = Array.isArray(asisRes.data) ? asisRes.data : (asisRes.data?.data || []);
        } catch (e) {
            console.warn('No se pudieron cargar las asistencias:', e);
            asistenciasActividad.value = [];
        }

    } catch (error) {
        console.error("Error al cargar la actividad:", error);
    } finally {
        isLoading.value = false;
    }
};

import { watch } from 'vue';

onMounted(() => {
    const carga = fetchData();
    if (route.query.tab) activeTab.value = route.query.tab as string;
    if (route.query.edit === 'true') {
        carga.then(abrirEdicion);
        // Limpiamos el query para no reabrir el modal al recargar
        router.replace({ query: { ...route.query, edit: undefined } });
    }
});

const handleImageChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            Swal.fire('Revisa la portada', 'Selecciona una imagen JPG, PNG o WebP.', 'warning');
            e.target.value = '';
            return;
        }
        if (imagenPreview.value) URL.revokeObjectURL(imagenPreview.value);
        imagenArchivo.value = file;
        imagenPreview.value = URL.createObjectURL(file);
    }
};

const agregarSesion = () => {
    if (!nuevaSesion.value.hora_inicio || !nuevaSesion.value.hora_fin || nuevaSesion.value.hora_inicio >= nuevaSesion.value.hora_fin) {
        Swal.fire('Revisa el horario', 'La hora de fin debe ser posterior a la de inicio.', 'warning');
        return;
    }
    if (editForm.value.sesiones.some(s => s.dia === nuevaSesion.value.dia && s.hora_inicio < nuevaSesion.value.hora_fin && s.hora_fin > nuevaSesion.value.hora_inicio)) {
        Swal.fire('Revisa el horario', 'Ya existe una sesión en ese día que se superpone con este horario.', 'warning');
        return;
    }
    editForm.value.sesiones.push({ ...nuevaSesion.value });
};

const eliminarSesion = (idx: number) => {
    editForm.value.sesiones.splice(idx, 1);
};

const guardarCambios = async () => {
    if (isSaving.value) return;
    try {
        if (requisitosError.value || !editForm.value.requisitos) {
            Swal.fire('Revisa los requisitos', requisitosError.value, 'error');
            return;
        }
        if (!editForm.value.nombre.trim() || !editForm.value.tipo.trim() || !editForm.value.fecha_inicio || !editForm.value.fecha_fin || editForm.value.fecha_fin < editForm.value.fecha_inicio || !Number.isFinite(Number(editForm.value.horas)) || Number(editForm.value.horas) <= 0) {
            Swal.fire('Revisa la actividad', 'Completa el título, el tipo, las fechas en orden y una carga horaria mayor a cero.', 'warning');
            return;
        }
        const requisitos = editForm.value.requisitos.custom;
        if (requisitos.some((req: any) => !String(req.label || '').trim() || (req.type === 'select' && !(req.options || []).some((option: string) => option.trim())))) {
            Swal.fire('Revisa los requisitos', 'Cada requisito necesita un nombre y las listas deben tener opciones.', 'warning');
            return;
        }
        const nombres = requisitos.map((req: any) => req.label.trim().toLowerCase());
        if (new Set(nombres).size !== nombres.length) {
            Swal.fire('Revisa los requisitos', 'Los nombres de los requisitos no pueden repetirse.', 'warning');
            return;
        }
        if ([editForm.value.min_nota, editForm.value.min_asistencia].some(value => String(value).trim() === '' || !Number.isFinite(Number(value)))) {
            Swal.fire('Revisa la aprobación', 'Completa la nota y la asistencia mínimas con números entre 0 y 100.', 'warning');
            return;
        }
        if (editForm.value.min_nota === undefined || editForm.value.min_nota === null || editForm.value.min_nota < 0 || editForm.value.min_nota > 100) {
            Swal.fire('Error', 'La nota mínima debe estar entre 0 y 100 y no puede ser negativa.', 'error');
            return;
        }

        if (editForm.value.min_asistencia === undefined || editForm.value.min_asistencia === null || editForm.value.min_asistencia < 0 || editForm.value.min_asistencia > 100) {
            Swal.fire('Error', 'La asistencia mínima debe estar entre 0 y 100 y no puede ser negativa.', 'error');
            return;
        }

        isSaving.value = true;
        Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
        const formData = new FormData();
        Object.entries(editForm.value).forEach(([key, val]) => {
            // Omitir solo null/undefined/string vacío — NO arrays vacíos
            if (val === null || val === undefined || val === '') return;
            if (key === 'sesiones' || key === 'logistica_ids') {
                formData.append(key, JSON.stringify(val));
            } else if (key === 'requisitos') {
                const requisitos = JSON.parse(JSON.stringify(val));
                requisitos.custom = requisitos.custom.map((req: any) => ({ ...req, label: req.label.trim(), ...(req.type === 'select' ? { options: req.options.map((option: string) => option.trim()).filter(Boolean) } : {}) }));
                formData.append(key, JSON.stringify(requisitos));
            } else {
                formData.append(key, String(val));
            }
        });
        // Siempre enviar logistica_ids aunque esté vacío
        if (!formData.has('logistica_ids')) {
            formData.append('logistica_ids', JSON.stringify([]));
        }
        if (imagenArchivo.value) formData.append('imagen', imagenArchivo.value);

        await api.put(`/actividades-academicas/${actividad.value.id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        await fetchData();
        descartarEdicion();
        Swal.fire('Éxito', 'Actividad actualizada correctamente', 'success');
    } catch (error: any) {
        console.error('Error al actualizar actividad:', error);
        
        // Formatear error de class-validator (array de strings) o string normal
        let errorMsg = 'No se pudo actualizar la actividad';
        const rawMsg = error.response?.data?.message;
        if (Array.isArray(rawMsg)) {
            errorMsg = rawMsg.join('\n');
        } else if (typeof rawMsg === 'string') {
            errorMsg = rawMsg;
        }

        Swal.fire({
            icon: 'error',
            title: 'Error de Validación',
            text: errorMsg
        });
    } finally {
        isSaving.value = false;
    }
};

const inhabilitarActividad = async () => {
    const { value: motivo } = await Swal.fire({
        title: '¿INHABILITAR ACTIVIDAD?',
        text: `Indique la razón para inhabilitar "${actividad.value.nombre}":`,
        input: 'textarea',
        inputPlaceholder: 'Escriba el motivo aquí...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'INHABILITAR',
        cancelButtonText: 'CANCELAR',
        inputValidator: (value: string) => {
          if (!value) return '¡Es obligatorio indicar un motivo!'
        }
    });

    if (motivo) {
        try {
            await api.patch(`/actividades-academicas/${actividad.value.id}`, { 
                estado: -1, 
                descripcion: `[INHABILITACION_MOTIVO]:${motivo}\n[FECHA]:${new Date().toLocaleString()}\n` 
            });
            await Swal.fire('Inhabilitada', 'La actividad ha sido marcada como inactiva.', 'success');
        } catch (e) { 
            Swal.fire('Error', 'No se pudo inhabilitar la actividad', 'error'); 
        }
    }
};

const solicitarActivacion = async () => {
    const result = await Swal.fire({
        title: '¿SOLICITAR ACTIVACIÓN?',
        text: `Se enviará un mensaje al Super Usuario para solicitar la reactivación de "${actividad.value.nombre}".`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#003B71',
        confirmButtonText: 'SÍ, ENVIAR SOLICITUD',
        cancelButtonText: 'CANCELAR'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({ title: 'Enviando solicitud...', didOpen: () => Swal.showLoading() });
            await api.post(`/actividades-academicas/${actividad.value.id}/solicitar-activacion`);
            Swal.fire('Solicitud Enviada', 'El Super Usuario ha sido notificado.', 'success');
        } catch (e) {
            Swal.fire('Error', 'No se pudo enviar la solicitud.', 'error');
        }
    }
};

const switchTab = (tab: string) => { activeTab.value = tab; };
const activeModal = ref('');
const openModal = (id: string) => { activeModal.value = id; };
const closeModal = (id: string) => { if (activeModal.value === id) activeModal.value = ''; };

// Computed para solicitudes (pendientes) - uso == para compatibilidad con valores numéricos del backend
const solicitudes = computed(() => inscritos.value.filter(i => i.estado == 0));
const alumnosActivos = computed(() => inscritos.value.filter(i => i.estado == 1));

const cambiarEstadoInscripcion = async (id: number, nuevoEstado: number) => {
    try {
        const accion = nuevoEstado === 1 ? 'aprobar' : 'rechazar';
        let observacion = '';

        if (nuevoEstado === 2) {
            const { value: text, isConfirmed } = await Swal.fire({
                title: 'Justificación de Rechazo',
                input: 'textarea',
                inputLabel: 'Explica detalladamente por qué no se acepta la solicitud:',
                inputPlaceholder: 'Ej: El perfil no cumple con los requisitos mínimos...',
                inputAttributes: { 'aria-label': 'Escribe el motivo aquí' },
                showCancelButton: true,
                confirmButtonText: 'Confirmar Rechazo',
                confirmButtonColor: '#d33',
                cancelButtonText: 'Cancelar',
                inputValidator: (value: string) => {
                    if (!value) return '¡Es obligatorio indicar un motivo para el rechazo!';
                    return null;
                }
            });
            if (!isConfirmed) return;
            observacion = text;
        } else {
            const result = await Swal.fire({
                title: '¿Confirmar aprobación?',
                text: "El estudiante será notificado de su alta en el curso.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, aprobar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;
        }

        Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
        await api.put(`/admin/inscripciones/${id}`, { estado: nuevoEstado, observacion });
        
        Swal.fire('Completado', `La solicitud ha sido gestionada con éxito.`, 'success');
        if (solicitudSeleccionada.value) closeModal('modal-detalle-postulante');
        fetchData();
    } catch (error) {
        Swal.fire('Error', 'No se pudo completar la acción.', 'error');
    }
};

const verDetalleSolicitud = (sol: any) => {
    solicitudSeleccionada.value = sol;
    openModal('modal-detalle-postulante');
};

const getGeneroLabel = (genero: number) => {
    const labels: Record<number, string> = {
        0: 'Masculino',
        1: 'Femenino',
        2: 'Otro',
        3: 'Prefiero no decir'
    };
    return labels[genero] || 'No especificado';
};

const guardarNota = async (id: number, nota: number) => {
    try {
        await api.patch(`/admin/inscripciones/${id}/nota`, { nota });
        Swal.fire({
            title: 'Nota Guardada',
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    } catch (error) {
        Swal.fire('Error', 'No se pudo guardar la nota', 'error');
    }
};

const cargarDatosPonente = () => {
    const p = ponentesExistentes.value.find(u => u.email === ponenteSeleccionado.value);
    if (p) {
        ponenteForm.value.email = p.email;
        ponenteForm.value.nombres = p.persona?.nombres || '';
        ponenteForm.value.primer_apellido = p.persona?.primer_apellido || '';
    } else {
        ponenteForm.value = { email: '', nombres: '', primer_apellido: '', tematica: '' };
    }
};

const asignarPonente = async () => {
    try {
        if (!ponenteForm.value.email || !ponenteForm.value.nombres) {
            return Swal.fire('Atención', 'Email y Nombres son obligatorios', 'warning');
        }
        
        Swal.fire({ title: 'Procesando vinculación...', didOpen: () => Swal.showLoading() });
        
        await api.post('/imparticiones/asignar-ponente', {
            ...ponenteForm.value,
            id_actividad: actividad.value.id,
            id_evento: actividad.value.evento.id
        });
        
        await fetchData();
        closeModal('modal-ponente');
        ponenteForm.value = { email: '', nombres: '', primer_apellido: '', tematica: '' };
        ponenteSeleccionado.value = '';
        Swal.fire('¡Logrado!', 'El docente ha sido vinculado y/o creado exitosamente.', 'success');
    } catch (error) {
        Swal.fire('Error', 'Hubo un problema al vincular al docente. Verifica los datos.', 'error');
    }
};

const editarTematica = async (imp: any) => {
    const { value: nuevaTematica, isConfirmed } = await Swal.fire({
        title: 'Editar Temática',
        html: `<p class="text-sm text-gray-500 mb-2">Ponente: <strong>${imp.usuario?.persona?.nombres} ${imp.usuario?.persona?.primer_apellido}</strong></p>`,
        input: 'textarea',
        inputLabel: 'Título de la presentación / Temática:',
        inputValue: imp.tematica || '',
        inputPlaceholder: 'Ej: Avances en biología molecular aplicada...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#003B71',
    });

    if (isConfirmed) {
        try {
            await api.patch(`/imparticiones/${imp.id}/tematica`, { tematica: nuevaTematica || '' });
            await fetchData();
            Swal.fire({ title: 'Temática actualizada', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        } catch (e) {
            Swal.fire('Error', 'No se pudo actualizar la temática.', 'error');
        }
    }
};


// ── Reportes ─────────────────────────────────────────────────────────────
const generarPDF = () => {
  if (!actividad.value) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const nombreActividad = actividad.value.nombre || 'Actividad';

  // Header
  doc.setFillColor(0, 59, 113);
  doc.rect(0, 0, 210, 38, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ACTA DE CALIFICACIONES', 105, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(nombreActividad.toUpperCase(), 105, 22, { align: 'center' });
  doc.text(`Generado: ${new Date().toLocaleDateString('es-BO')}`, 105, 30, { align: 'center' });

  // Info actividad
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.text(`Tipo: ${actividad.value.tipo || '-'}    Modalidad: ${actividad.value.modalidades?.[0]?.tipo || '-'}    Horas: ${actividad.value.horas || '-'}`, 14, 48);
  doc.text(`Período: ${actividad.value.fecha_inicio ? new Date(actividad.value.fecha_inicio).toLocaleDateString('es-BO') : '-'} → ${actividad.value.fecha_fin ? new Date(actividad.value.fecha_fin).toLocaleDateString('es-BO') : '-'}`, 14, 55);

  // Tabla estudiantes
  const rows = alumnosActivos.value.map((ins, idx) => [
    (idx + 1).toString().padStart(2, '0'),
    `${ins.usuario?.persona?.primer_apellido || ''} ${ins.usuario?.persona?.segundo_apellido || ''} ${ins.usuario?.persona?.nombres || ''}`.trim(),
    ins.usuario?.persona?.documento_identidad || '-',
    ins.nota_principal !== null && ins.nota_principal !== undefined ? String(ins.nota_principal) : '-',
    (ins.nota_principal || 0) >= (actividad.value.modalidades?.[0]?.min_nota || 51) ? 'APROBADO' : 'REPROBADO'
  ]);

  autoTable(doc, {
    startY: 62,
    head: [['N°', 'Apellidos y Nombres', 'C.I.', 'Nota', 'Estado']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 59, 113], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 3: { halign: 'center' }, 4: { halign: 'center' } },
  });

  // Footer firma
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  doc.setDrawColor(180, 180, 180);
  doc.line(14, finalY + 30, 90, finalY + 30);
  doc.line(120, finalY + 30, 196, finalY + 30);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Coordinador del Evento', 52, finalY + 36, { align: 'center' });
  doc.text('V°B° Dirección TWAN', 158, finalY + 36, { align: 'center' });

  doc.save(`Acta_${nombreActividad.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
  Swal.fire({ title: 'PDF Generado', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500 });
};

const generarExcel = () => {
  if (!actividad.value) return;
  const nombreActividad = actividad.value.nombre || 'Actividad';
  const sesiones = actividad.value.modalidades?.[0]?.sesiones || [];

  // Hoja 1: Calificaciones
  const dataNotas = [
    ['N°', 'Apellidos y Nombres', 'C.I.', 'Nota', 'Estado'],
    ...alumnosActivos.value.map((ins, idx) => [
      idx + 1,
      `${ins.usuario?.persona?.primer_apellido || ''} ${ins.usuario?.persona?.segundo_apellido || ''} ${ins.usuario?.persona?.nombres || ''}`.trim(),
      ins.usuario?.persona?.documento_identidad || '',
      ins.nota_principal ?? '',
      (ins.nota_principal || 0) >= (actividad.value.modalidades?.[0]?.min_nota || 51) ? 'APROBADO' : 'REPROBADO'
    ])
  ];

  // Hoja 2: Asistencias por sesión
  const headerAsistencia = ['N°', 'Apellidos y Nombres', 'C.I.', ...sesiones.map((_: any, i: number) => `Sesión ${i+1}`), 'Total Asistencias', '% Asistencia'];
  const dataAsistencia = [
    headerAsistencia,
    ...alumnosActivos.value.map((ins, idx) => {
      const inscModId = ins.modalidades?.[0]?.id;
      const asistPorSesion = sesiones.map((s: any) => {
        const a = asistenciasActividad.value.find((x: any) => x.sesionAcademica?.id === s.id && x.inscripcionModalidad?.id === inscModId);
        return a && Number(a.estado) === 1 ? 1 : 0;
      });
      const total = asistPorSesion.reduce((acc: number, v: number) => acc + v, 0);
      const pct = sesiones.length > 0 ? Math.round((total / sesiones.length) * 100) : 0;
      return [
        idx + 1,
        `${ins.usuario?.persona?.primer_apellido || ''} ${ins.usuario?.persona?.segundo_apellido || ''} ${ins.usuario?.persona?.nombres || ''}`.trim(),
        ins.usuario?.persona?.documento_identidad || '',
        ...asistPorSesion,
        total,
        `${pct}%`
      ];
    })
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(dataNotas);
  const ws2 = XLSX.utils.aoa_to_sheet(dataAsistencia);
  XLSX.utils.book_append_sheet(wb, ws1, 'Calificaciones');
  XLSX.utils.book_append_sheet(wb, ws2, 'Asistencias');
  XLSX.writeFile(wb, `Reporte_${nombreActividad.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  Swal.fire({ title: 'Excel Generado', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500 });
};

// ── Modal dedicado de asignación de logística ──────────────────────────
// Estado temporal mientras el modal está abierto
const logisticaIdsTemp = ref<number[]>([]);
const filtroLogisticaModal = ref('');
const isSavingLogistica = ref(false);

const logisticaFiltradaModal = computed(() => {
  if (!filtroLogisticaModal.value) return logisticaExistentes.value;
  const f = filtroLogisticaModal.value.toLowerCase();
  return logisticaExistentes.value.filter(u =>
    u.displayName?.toLowerCase().includes(f) ||
    (u.email || '').toLowerCase().includes(f)
  );
});

const abrirModalLogistica = () => {
  // Clonar los IDs actuales para no mutar el estado hasta guardar
  logisticaIdsTemp.value = [...(actividad.value?.logistica_ids || [])];
  filtroLogisticaModal.value = '';
  openModal('modal-asignar-logistica');
};

const toggleLogisticaTemp = (id: number) => {
  const idx = logisticaIdsTemp.value.indexOf(id);
  if (idx > -1) {
    logisticaIdsTemp.value.splice(idx, 1);
  } else {
    logisticaIdsTemp.value.push(id);
  }
};

const guardarLogistica = async () => {
  try {
    isSavingLogistica.value = true;
    const formData = new FormData();
    formData.append('logistica_ids', JSON.stringify(logisticaIdsTemp.value));
    await api.put(`/actividades-academicas/${actividad.value.id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    await fetchData();
    closeModal('modal-asignar-logistica');
    Swal.fire({ title: 'Personal asignado', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
  } catch (e: any) {
    const msg = e.response?.data?.message;
    Swal.fire('Error', Array.isArray(msg) ? msg.join(', ') : (msg || 'No se pudo guardar la asignación'), 'error');
  } finally {
    isSavingLogistica.value = false;
  }
};
const eliminarPonente = async (id: number) => {
    try {
        const result = await Swal.fire({
            title: '\u00bfRemover docente?',
            text: "Esta acci\u00f3n quitar\u00e1 al docente de la planilla de esta actividad.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'S\u00ed, remover',
            cancelButtonText: 'Mantener'
        });
        if (result.isConfirmed) {
            await api.delete(`/imparticiones/${id}`);
            await fetchData();
            Swal.fire('Eliminado', 'Docente removido de la actividad.', 'success');
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo completar la eliminaci\u00f3n.', 'error');
    }
};
</script>

<template>
  <div class="animate-in fade-in duration-500 max-w-7xl mx-auto space-y-8">
    <VBtn @click="router.go(-1)" class="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase hover:text-primary-dark dark:hover:text-white transition-colors mb-4">
      <VIcon class="material-symbols-outlined text-sm">arrow_back</VIcon> Volver
    </VBtn>

    <div v-if="actividad" class="rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between shadow-2xl relative overflow-hidden border-r-8 border-umsa-gold min-h-[200px]"
         :style="actividad.imagen ? { backgroundImage: `url(${getImageUrl('cursos', actividad.imagen)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: '#1e293b' }"
         :class="Number(actividad.estado) === -1 ? 'grayscale' : ''">
      <!-- Overlay degradado para adaptar a la paleta institucional -->
      <div class="absolute inset-0 bg-gradient-to-r" :class="Number(actividad.estado) === -1 ? 'from-gray-900/95 via-gray-800/80 to-transparent' : 'from-umsa-blue/95 via-primary-dark/80 to-transparent'"></div>
      
      <div class="relative z-10">
        <div v-if="Number(actividad.estado) === -1" class="flex items-center gap-2 text-red-500 mb-2">
            <VIcon class="material-symbols-outlined">lock</VIcon>
            <span class="text-[10px] font-black uppercase tracking-[0.3em]">Actividad Bloqueada - Modo Lectura</span>
        </div>
        <h2 id="titulo-curso" class="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tight">{{ actividad.nombre }}</h2>
        <p class="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Panel de Administración Integral • {{ actividad.tipo }}</p>
      </div>

      <div class="relative z-10 flex gap-4 mt-6 md:mt-0">
        <RouterLink :to="`${route.path.startsWith('/admin') ? '/admin' : '/coordinador'}/cursos/${actividad.id}/aula`" class="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-bold text-[#003B71]"><VIcon size="18">video_library</VIcon>Editar aula virtual</RouterLink>
        <template v-if="Number(actividad.estado) !== -1">
            <VBtn @click="abrirEdicion" class="bg-emerald-500 text-primary-dark px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:brightness-110 transition-all uppercase tracking-widest flex items-center gap-2">
            <VIcon class="material-symbols-outlined text-sm">edit</VIcon> Editar actividad
            </VBtn>
            <VBtn @click="inhabilitarActividad" class="bg-red-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:brightness-110 transition-all uppercase tracking-widest flex items-center gap-2">
            <VIcon class="material-symbols-outlined text-sm">block</VIcon> Inhabilitar
            </VBtn>
        </template>
        <template v-else>
            <VBtn @click="solicitarActivacion" class="bg-umsa-gold text-white px-8 py-3 rounded-2xl text-[10px] font-black shadow-lg hover:brightness-110 transition-all uppercase tracking-widest flex items-center gap-2">
                <VIcon class="material-symbols-outlined text-sm">lock_open</VIcon> Solicitar Reactivación
            </VBtn>
        </template>
      </div>
    </div>

    <!-- Tabs Nav -->
    <div class="flex space-x-8 border-b border-slate-200 dark:border-gray-800 px-4 mb-8 overflow-x-auto">
      <VBtn @click="switchTab('estudiantes')" :class="activeTab === 'estudiantes' ? 'border-b-4 border-umsa-gold text-primary-dark dark:text-white font-black' : 'text-slate-400 font-bold hover:text-primary-dark dark:hover:text-white'" class="pb-4 text-[11px] uppercase tracking-widest transition-colors whitespace-nowrap">Estudiantes & Notas ({{ alumnosActivos.length }})</VBtn>
      <VBtn @click="switchTab('solicitudes')" :class="activeTab === 'solicitudes' ? 'border-b-4 border-umsa-gold text-primary-dark dark:text-white font-black' : 'text-slate-400 font-bold hover:text-primary-dark dark:hover:text-white'" class="pb-4 text-[11px] uppercase tracking-widest transition-colors flex items-center gap-1 whitespace-nowrap">
        <VIcon class="material-symbols-outlined text-sm text-umsa-blue">how_to_reg</VIcon> Solicitudes ({{ solicitudes.length }})
      </VBtn>
      <VBtn @click="switchTab('ponentes')" :class="activeTab === 'ponentes' ? 'border-b-4 border-umsa-gold text-primary-dark dark:text-white font-black' : 'text-slate-400 font-bold hover:text-primary-dark dark:hover:text-white'" class="pb-4 text-[11px] uppercase tracking-widest transition-colors whitespace-nowrap">Plantel Docente</VBtn>
      <VBtn @click="switchTab('logistica')" :class="activeTab === 'logistica' ? 'border-b-4 border-umsa-gold text-primary-dark dark:text-white font-black' : 'text-slate-400 font-bold hover:text-primary-dark dark:hover:text-white'" class="pb-4 text-[11px] uppercase tracking-widest transition-colors flex items-center gap-1 whitespace-nowrap">
        <VIcon class="material-symbols-outlined text-sm text-emerald-500">support_agent</VIcon> Logística ({{ logisticaAsignada.length }})
      </VBtn>
      <VBtn @click="switchTab('asistencia')" :class="activeTab === 'asistencia' ? 'border-b-4 border-umsa-gold text-primary-dark dark:text-white font-black' : 'text-slate-400 font-bold hover:text-primary-dark dark:hover:text-white'" class="pb-4 text-[11px] uppercase tracking-widest transition-colors flex items-center gap-1 whitespace-nowrap"><VIcon class="material-symbols-outlined text-sm">qr_code_scanner</VIcon> Asistencia</VBtn>
      <VBtn @click="switchTab('reportes')" :class="activeTab === 'reportes' ? 'border-b-4 border-umsa-gold text-primary-dark dark:text-white font-black' : 'text-slate-400 font-bold hover:text-primary-dark dark:hover:text-white'" class="pb-4 text-[11px] uppercase tracking-widest transition-colors whitespace-nowrap">Reportes & Actas</VBtn>
    </div>

    <!-- Tab 1: Estudiantes -->
    <div v-if="activeTab === 'estudiantes'" class="tab-content block space-y-6 animate-in fade-in">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-black text-primary-dark dark:text-white uppercase italic">Nómina de Inscritos</h3>
            <div class="flex gap-3">
                <VBtn @click="openModal('modal-estudiante')" class="bg-primary-dark text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-500 transition-all flex items-center gap-2"><VIcon class="material-symbols-outlined text-sm">person_add</VIcon> Inscribir</VBtn>
                <VBtn class="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-primary-dark dark:text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2"><VIcon class="material-symbols-outlined text-sm">upload_file</VIcon> Importar Notas</VBtn>
            </div>
        </div>
        <VCard class="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-800 overflow-hidden">
            <VTable class="w-full text-left">
                <thead class="bg-slate-50 dark:bg-gray-800/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-gray-800">
                    <tr><th class="px-8 py-5 w-16">N°</th><th class="px-8 py-5">Estudiante</th><th class="px-4 py-5 text-center">Nota Parcial</th><th class="px-4 py-5 text-center">Nota Final</th><th class="px-8 py-5 text-center">Acciones</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-gray-800">
                    <tr v-for="(ins, idx) in alumnosActivos" :key="ins.id" class="hover:bg-slate-50 dark:hover:bg-gray-800/80 transition-colors">
                        <td class="px-8 py-6 font-bold text-slate-400">{{ (idx + 1).toString().padStart(2, '0') }}</td>
                        <td class="px-8 py-6">
                            <p class="font-black text-primary-dark dark:text-white text-sm uppercase">{{ ins.usuario?.persona?.primer_apellido }} {{ ins.usuario?.persona?.segundo_apellido }} {{ ins.usuario?.persona?.nombres }}</p>
                            <p class="text-[10px] text-slate-400 font-medium">CI: {{ ins.usuario?.persona?.documento_identidad }}</p>
                        </td>
                        <td class="px-4 py-6 text-center">
                            <UiInput type="number" v-model="ins.nota_principal" class="w-16 text-center bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-xs font-bold text-primary-dark dark:text-white focus:ring-2 focus:ring-umsa-gold outline-none" />
                        </td>
                        <td class="px-4 py-6 text-center">
                            <span :class="(ins.nota_principal || 0) >= (actividad?.modalidades?.[0]?.min_nota || 51) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'" class="px-3 py-1 rounded-lg font-black text-xs">
                                {{ ins.nota_principal || 0 }} / 100
                            </span>
                        </td>
                        <td class="px-8 py-6 flex justify-center gap-2">
                            <VBtn @click="guardarNota(ins.id, ins.nota_principal)" class="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all" title="Guardar Nota">
                                <VIcon class="material-symbols-outlined text-sm">save</VIcon>
                            </VBtn>
                            <VBtn class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><VIcon class="material-symbols-outlined text-sm">delete</VIcon></VBtn>
                        </td>
                    </tr>
                    <tr v-if="alumnosActivos.length === 0">
                        <td colspan="5" class="p-20 text-center text-slate-400 font-bold uppercase text-[10px]">No hay estudiantes activos inscritos</td>
                    </tr>
                </tbody>
            </VTable>
        </VCard>
    </div>

    <!-- Tab Solicitudes (Aprobar/Rechazar) -->
    <div v-if="activeTab === 'solicitudes'" class="tab-content block space-y-6 animate-in fade-in">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-black text-primary-dark dark:text-white uppercase italic">Solicitudes de Inscripción</h3>
            <div class="flex items-center gap-3">
                <span class="bg-blue-100 dark:bg-blue-900/30 text-umsa-blue px-3 py-1 text-[10px] font-black uppercase rounded-lg">{{ solicitudes.length }} Pendientes</span>
                <VBtn @click="fetchData" class="p-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-400 hover:text-emerald-500 transition-colors" title="Actualizar">
                    <VIcon class="material-symbols-outlined text-[18px]">refresh</VIcon>
                </VBtn>
            </div>
        </div>
        <VCard class="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-800 overflow-hidden">
            <VTable class="w-full text-left">
                <thead class="bg-slate-50 dark:bg-gray-800/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-gray-800">
                    <tr><th class="px-8 py-5">Postulante</th><th class="px-4 py-5 text-center">Fecha Solicitud</th><th class="px-4 py-5 text-center">Estado</th><th class="px-8 py-5 text-center">Evaluación</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-gray-800">
                    <tr v-for="sol in solicitudes" :key="sol.id" class="hover:bg-slate-50 dark:hover:bg-gray-800/80 transition-colors">
                        <td class="px-8 py-6">
                            <p class="font-black text-primary-dark dark:text-white text-sm uppercase">{{ sol.usuario?.persona?.primer_apellido }} {{ sol.usuario?.persona?.segundo_apellido }} {{ sol.usuario?.persona?.nombres }}</p>
                            <p class="text-[10px] text-slate-400 font-medium">CI: {{ sol.usuario?.persona?.documento_identidad }}</p>
                        </td>
                        <td class="px-4 py-6 text-center text-xs font-bold text-slate-500">{{ new Date(sol.fecha_creacion).toLocaleDateString() }}</td>
                        <td class="px-4 py-6 text-center"><span class="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-lg font-black text-[9px] uppercase">Pendiente</span></td>
                        <td class="px-8 py-6 flex justify-center gap-3">
                            <VBtn @click="verDetalleSolicitud(sol)" class="bg-primary-dark text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-umsa-gold transition-all flex items-center gap-1 shadow-sm"><VIcon class="material-symbols-outlined text-sm">visibility</VIcon> Ver Perfil</VBtn>
                            <VBtn @click="cambiarEstadoInscripcion(sol.id, 1)" class="border border-emerald-500 text-emerald-500 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1">Aprobar</VBtn>
                        </td>
                    </tr>
                    <tr v-if="solicitudes.length === 0">
                        <td colspan="4" class="p-20 text-center text-slate-400 font-bold uppercase text-[10px]">No hay solicitudes pendientes</td>
                    </tr>
                </tbody>
            </VTable>
        </VCard>
    </div>

    <!-- Tab 2: Ponentes -->
    <div v-if="activeTab === 'ponentes'" class="tab-content block space-y-6 animate-in fade-in">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-black text-primary-dark dark:text-white uppercase italic">Plantel Docente</h3>
            <VBtn @click="openModal('modal-ponente')" class="bg-primary-dark text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-500 transition-all flex items-center gap-2"><VIcon class="material-symbols-outlined text-sm">person_add</VIcon> Asignar Ponente</VBtn>
        </div>
        <VCard class="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-800 overflow-hidden">
            <VTable class="w-full text-left">
                <thead class="bg-slate-50 dark:bg-gray-800/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-gray-800">
                    <tr><th class="px-8 py-5">Ponente</th><th class="px-8 py-5">Temática / Presentación</th><th class="px-8 py-5 text-center">Acciones</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-gray-800">
                    <tr v-for="imp in imparticiones" :key="imp.id" class="hover:bg-slate-50 dark:hover:bg-gray-800/80 transition-colors">
                        <td class="px-8 py-6">
                            <div class="flex items-center gap-4">
                                <div>
                                    <p class="font-black text-primary-dark dark:text-white text-sm uppercase">
                                        {{ imp.usuario?.persona?.primer_apellido }} {{ imp.usuario?.persona?.segundo_apellido }} {{ imp.usuario?.persona?.nombres }}
                                    </p>
                                    <p class="text-[10px] text-blue-500 font-medium italic">{{ imp.usuario?.email }}</p>
                                </div>
                            </div>
                        </td>
                        <td class="px-8 py-6">
                            <span v-if="imp.tematica" class="text-sm text-slate-700 dark:text-gray-300 italic">{{ imp.tematica }}</span>
                            <span v-else class="text-[10px] text-slate-400 uppercase font-bold">Sin temática — </span>
                            <VBtn @click="editarTematica(imp)" class="text-[9px] font-black text-umsa-blue dark:text-blue-400 hover:underline uppercase tracking-wide" title="Editar temática">
                                {{ imp.tematica ? 'Editar' : 'Asignar' }}
                            </VBtn>
                        </td>
                        <td class="px-8 py-6 text-center flex justify-center gap-2">
                            <VBtn @click="eliminarPonente(imp.id)" class="p-2 border border-red-200 dark:border-red-900 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all" title="Remover Docente"><VIcon class="material-symbols-outlined text-sm">delete</VIcon></VBtn>
                        </td>
                    </tr>
                    <tr v-if="imparticiones.length === 0">
                        <td colspan="3" class="p-20 text-center text-slate-400 font-bold uppercase text-[10px]">No hay docentes asignados a esta actividad</td>
                    </tr>
                </tbody>
            </VTable>
        </VCard>
    </div>

    <!-- Tab Logística -->
    <div v-if="activeTab === 'logistica'" class="tab-content block space-y-6 animate-in fade-in">
        <div class="flex justify-between items-center mb-4">
            <div>
                <h3 class="text-xl font-black text-primary-dark dark:text-white uppercase italic">Personal de Logística</h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Personal asignado a esta actividad</p>
            </div>
            <VBtn @click="abrirModalLogistica" class="bg-emerald-500 text-primary-dark px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:brightness-110 transition-all flex items-center gap-2">
                <VIcon class="material-symbols-outlined text-sm">manage_accounts</VIcon> Gestionar Asignación
            </VBtn>
        </div>

        <!-- Grid de cards del personal asignado -->
        <div v-if="logisticaAsignada.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <VCard v-for="user in logisticaAsignada" :key="user.id"
                 class="bg-white dark:bg-gray-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-gray-800 flex items-center gap-5 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-md transition-all group">
                <!-- Avatar inicial -->
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                    <span class="text-white font-black text-xl uppercase">{{ user.displayName?.charAt(0) || 'L' }}</span>
                </div>
                <!-- Info -->
                <div class="flex-1 min-w-0">
                    <p class="font-black text-primary-dark dark:text-white text-sm uppercase leading-tight truncate">{{ user.displayName }}</p>
                    <p class="text-[10px] text-blue-500 font-medium mt-0.5 truncate">{{ user.email }}</p>
                    <span class="mt-2 inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide">
                        <VIcon class="material-symbols-outlined text-xs">support_agent</VIcon> Logística
                    </span>
                </div>
            </VCard>
        </div>

        <!-- Estado vacío -->
        <VCard v-else class="bg-white dark:bg-gray-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-gray-700 p-16 text-center">
            <VIcon class="material-symbols-outlined text-5xl text-slate-300 dark:text-gray-600 mb-4 block">group_off</VIcon>
            <h4 class="font-black text-slate-400 dark:text-gray-500 uppercase text-sm mb-2">Sin Personal Asignado</h4>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-6">Aún no se ha asignado personal de logística a esta actividad</p>
            <VBtn @click="abrirModalLogistica" class="bg-emerald-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2 mx-auto">
                <VIcon class="material-symbols-outlined text-sm">add</VIcon> Asignar Personal
            </VBtn>
        </VCard>
    </div>

    <!-- Tab 3: Asistencia -->
    <div v-if="activeTab === 'asistencia'" class="tab-content block space-y-6 animate-in fade-in">
        <!-- VISTA PARA COORDINADOR/ADMINISTRADOR: HISTORIAL DE ASISTENCIA -->
        <div v-if="authStore.rolActivo === 'Coordinador' || authStore.esSuperUsuario" class="space-y-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-black text-primary-dark dark:text-white uppercase italic">Historial de Asistencias</h3>
                <span class="bg-blue-100 dark:bg-blue-900/30 text-umsa-blue px-3 py-1 text-[10px] font-black uppercase rounded-lg">
                    {{ authStore.esSuperUsuario ? 'Vista de Administrador' : 'Vista de Coordinador' }}
                </span>
            </div>
            
            <VCard class="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-800 overflow-hidden">
                <VTable class="w-full text-left">
                    <thead class="bg-slate-50 dark:bg-gray-800/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-gray-800">
                        <tr>
                            <th class="px-8 py-5">Fecha / Sesión</th>
                            <th class="px-8 py-5">Modo de Registro</th>
                            <th class="px-8 py-5 text-center">Asistentes</th>
                            <th class="px-8 py-5 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-gray-800">
                        <tr v-for="(sesion, index) in (actividad.modalidades?.[0]?.sesiones || [])" :key="sesion.id" class="hover:bg-slate-50 dark:hover:bg-gray-800/80 transition-colors">
                            <td class="px-8 py-6">
                                <p class="font-black text-primary-dark dark:text-white text-sm uppercase">Sesión {{ Number(index) + 1 }}: {{ sesion.dia }}</p>
                                <p class="text-[10px] text-slate-400 font-medium">
                                    {{ sesion.fecha ? formatDate(sesion.fecha) : 'Horario Recurrente' }} • {{ formatTime(sesion.hora_inicio) }} - {{ formatTime(sesion.hora_fin) }}
                                </p>
                            </td>
                            <td class="px-8 py-6">
                                <span :class="sesion.cod_verificacion ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-blue-100 text-umsa-blue dark:bg-blue-900/30'" class="px-3 py-1 rounded-lg font-black text-[9px] uppercase">
                                    {{ sesion.cod_verificacion ? 'PIN / QR Proyectado' : 'Registro Manual' }}
                                </span>
                            </td>
                            <td class="px-8 py-6 text-center">
                                <span class="text-green-600 dark:text-green-400 font-black text-sm">
                                    {{ getAsistenciasSesionCount(sesion.id) }} / {{ alumnosActivos.length }}
                                </span>
                            </td>
                            <td class="px-8 py-6 text-center">
                                <VBtn @click="verListaAsistenciaSesion(sesion)" class="bg-primary-dark text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-1 mx-auto">
                                    <VIcon class="material-symbols-outlined text-sm">visibility</VIcon> Ver Lista
                                </VBtn>
                            </td>
                        </tr>
                        <tr v-if="!(actividad.modalidades?.[0]?.sesiones?.length)">
                            <td colspan="4" class="p-20 text-center text-slate-400 font-bold uppercase text-[10px]">No hay sesiones programadas para esta actividad</td>
                        </tr>
                    </tbody>
                </VTable>
            </VCard>
        </div>

        <!-- VISTA PARA PONENTE: CONTROL DE ASISTENCIA (Lo que ya existía) -->
        <div v-else class="space-y-6">
            <div class="flex flex-col md:flex-row md:justify-between md:items-end mb-4 gap-4">
                <div>
                    <h3 class="text-xl font-black text-primary-dark dark:text-white uppercase italic">Control de Asistencia</h3>
                    <p class="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Selecciona la sesión activa:</p>
                </div>
                <UiSelect class="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-primary-dark dark:text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-umsa-gold">
                    <option>Sesión 1: Martes 14/Nov (Teoría)</option>
                </UiSelect>
            </div>
            <div class="grid grid-cols-12 gap-8">
                <VCard class="col-span-12 lg:col-span-5 bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-sm border border-slate-100 dark:border-gray-800 text-center relative overflow-hidden">
                    <h3 class="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Proyectar Código QR</h3>
                    <div class="relative bg-slate-50 dark:bg-gray-800 p-6 rounded-3xl border-2 border-dashed border-umsa-gold mb-6 flex justify-center">
                        <VIcon class="material-symbols-outlined text-[150px] text-primary-dark dark:text-white">qr_code_2</VIcon>
                        <div class="absolute top-0 left-0 w-full h-[3px] bg-emerald-500 shadow-[0_0_15px_#BC9C31] animate-[scan_2s_infinite_linear]"></div>
                    </div>
                    <p class="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-2">O ingresa el PIN:</p>
                    <div class="bg-slate-100 dark:bg-gray-800 px-8 py-3 rounded-2xl border border-slate-200 dark:border-gray-700 mb-6">
                        <span class="text-4xl font-black text-primary-dark dark:text-white tracking-[0.3em]">482-91A</span>
                    </div>
                </VCard>
                <VCard class="col-span-12 lg:col-span-7 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-800 overflow-hidden flex flex-col">
                    <div class="p-6 bg-slate-50 dark:bg-gray-800/50 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center">
                        <div>
                            <h3 class="text-xs font-black text-primary-dark dark:text-white uppercase tracking-widest">Asistencia en Vivo</h3>
                            <p class="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase mt-1 flex items-center gap-1"><span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> 32 / 45 Presentes</p>
                        </div>
                        <VBtn class="bg-red-50 dark:bg-red-900/30 text-red-500 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">Cerrar Registro</VBtn>
                    </div>
                    <div class="p-6 flex-1 overflow-y-auto max-h-[400px] space-y-3">
                        <div class="flex items-center justify-between p-4 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center"><VIcon class="material-symbols-outlined text-sm font-bold">check</VIcon></div>
                                <div><p class="font-black text-primary-dark dark:text-white text-sm uppercase">Pérez Nogales Brenda</p></div>
                            </div>
                            <span class="bg-green-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase">Presente</span>
                        </div>
                    </div>
                </VCard>
            </div>
        </div>
    </div>

    <!-- Tab 4: Reportes -->
    <div v-if="activeTab === 'reportes'" class="tab-content block space-y-6 animate-in fade-in">
        <div class="mb-6">
            <h3 class="text-xl font-black text-primary-dark dark:text-white uppercase italic">Reportes & Actas</h3>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Genera documentos oficiales con datos reales de la actividad</p>
        </div>

        <!-- Resumen estadístico -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <VCard class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-100 dark:border-gray-800 text-center">
                <p class="text-3xl font-black text-primary-dark dark:text-white">{{ alumnosActivos.length }}</p>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Inscritos</p>
            </VCard>
            <VCard class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-100 dark:border-gray-800 text-center">
                <p class="text-3xl font-black text-emerald-500">{{ alumnosActivos.filter(i => (i.nota_principal||0) >= (actividad?.modalidades?.[0]?.min_nota||51)).length }}</p>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Aprobados</p>
            </VCard>
            <VCard class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-100 dark:border-gray-800 text-center">
                <p class="text-3xl font-black text-red-400">{{ alumnosActivos.filter(i => i.nota_principal !== null && i.nota_principal !== undefined && (i.nota_principal||0) < (actividad?.modalidades?.[0]?.min_nota||51)).length }}</p>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Reprobados</p>
            </VCard>
            <VCard class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-100 dark:border-gray-800 text-center">
                <p class="text-3xl font-black text-umsa-gold">{{ actividad?.modalidades?.[0]?.sesiones?.length || 0 }}</p>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Sesiones</p>
            </VCard>
        </div>

        <!-- Acciones de descarga -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- PDF -->
            <VCard class="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-800 flex flex-col hover:border-red-300 dark:hover:border-red-800 hover:shadow-lg transition-all group">
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <VIcon class="material-symbols-outlined text-3xl text-red-500">picture_as_pdf</VIcon>
                    </div>
                    <div>
                        <h4 class="font-black text-primary-dark dark:text-white uppercase text-sm">Acta de Calificaciones</h4>
                        <p class="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Formato PDF — {{ alumnosActivos.length }} estudiantes</p>
                    </div>
                </div>
                <p class="text-xs text-slate-500 dark:text-gray-400 mb-6 flex-1">Genera un acta oficial con la nómina completa de estudiantes, sus calificaciones finales y estado de aprobación, lista para firmas.</p>
                <VBtn @click="generarPDF" class="w-full py-3 bg-red-500 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95">
                    <VIcon class="material-symbols-outlined text-sm">download</VIcon> Descargar PDF
                </VBtn>
            </VCard>

            <!-- Excel -->
            <VCard class="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-gray-800 flex flex-col hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-lg transition-all group">
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <VIcon class="material-symbols-outlined text-3xl text-emerald-500">table_chart</VIcon>
                    </div>
                    <div>
                        <h4 class="font-black text-primary-dark dark:text-white uppercase text-sm">Reporte Completo</h4>
                        <p class="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Formato Excel — Calificaciones + Asistencias</p>
                    </div>
                </div>
                <p class="text-xs text-slate-500 dark:text-gray-400 mb-6 flex-1">Exporta dos hojas: (1) Calificaciones finales y (2) Asistencia por sesión para cada estudiante, con porcentaje de asistencia calculado.</p>
                <VBtn @click="generarExcel" class="w-full py-3 bg-emerald-500 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95">
                    <VIcon class="material-symbols-outlined text-sm">download</VIcon> Descargar Excel
                </VBtn>
            </VCard>
        </div>
    </div>
  </div>

  <!-- Modal Lista de Asistencia (Dinámica) -->
  <VDialog v-if="activeModal === 'modal-lista-asistencia-dinamica'" :model-value="true" persistent class="sgea-dialog" width="100%" max-width="calc(100vw - 32px)">
      <VCard v-if="sesionSeleccionada" class="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95 duration-300">
          <div class="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-gray-800 pb-4">
              <div>
                  <h3 class="text-2xl font-black text-primary-dark dark:text-white italic uppercase">Lista de Asistencia</h3>
                  <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">
                      Sesión: {{ sesionSeleccionada.dia }} • {{ formatTime(sesionSeleccionada.hora_inicio) }} - {{ formatTime(sesionSeleccionada.hora_fin) }}
                  </p>
              </div>
              <VBtn @click="closeModal('modal-lista-asistencia-dinamica')" class="text-slate-400 hover:text-red-500 transition-colors"><VIcon class="material-symbols-outlined">close</VIcon></VBtn>
          </div>
          <div class="space-y-4 max-h-[400px] overflow-y-auto pr-1" style="scrollbar-width: thin;">
              <div v-for="ins in alumnosActivos" :key="ins.id" class="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-gray-700 rounded-2xl">
                  <div class="flex items-center gap-4">
                      <div :class="asistenciaSesionForm[ins.modalidades?.[0]?.id] === 1 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'" class="w-10 h-10 rounded-full flex items-center justify-center font-bold">
                          <VIcon class="material-symbols-outlined text-sm">{{ asistenciaSesionForm[ins.modalidades?.[0]?.id] === 1 ? 'check' : 'close' }}</VIcon>
                      </div>
                      <div>
                          <p class="font-black text-primary-dark dark:text-white text-sm uppercase">
                              {{ ins.usuario?.persona?.primer_apellido }} {{ ins.usuario?.persona?.segundo_apellido }} {{ ins.usuario?.persona?.nombres }}
                          </p>
                          <p class="text-[10px] text-slate-400 font-medium">CI: {{ ins.usuario?.persona?.documento_identidad }}</p>
                      </div>
                  </div>
                  <div class="flex items-center gap-3">
                      <VBtn @click="toggleAsistenciaLocal(ins.modalidades?.[0]?.id)" :class="asistenciaSesionForm[ins.modalidades?.[0]?.id] === 1 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600 dark:bg-gray-700 dark:text-gray-300'" class="px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                          {{ asistenciaSesionForm[ins.modalidades?.[0]?.id] === 1 ? 'Presente' : 'Ausente' }}
                      </VBtn>
                  </div>
              </div>
              <div v-if="alumnosActivos.length === 0" class="text-center p-8 text-slate-400 font-bold uppercase text-xs">
                  No hay estudiantes activos inscritos en esta actividad
              </div>
          </div>
          <div class="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-gray-800">
              <VBtn @click="closeModal('modal-lista-asistencia-dinamica')" class="px-6 py-3 text-slate-500 font-black uppercase text-[10px] hover:bg-slate-50 dark:hover:bg-gray-800 rounded-xl">Cancelar</VBtn>
              <VBtn @click="guardarAsistenciaSesion" :disabled="isSavingAsistencia" class="px-8 py-3 bg-primary-dark text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 shadow-lg transition-all disabled:opacity-50">
                  {{ isSavingAsistencia ? 'Guardando...' : 'Guardar Cambios' }}
              </VBtn>
          </div>
      </VCard>
  </VDialog>

  <!-- Modal Estudiante -->
  <VDialog v-if="activeModal === 'modal-estudiante'" :model-value="true" persistent class="sgea-dialog" width="100%" max-width="calc(100vw - 32px)">
      <VCard class="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-lg p-10 shadow-2xl">
          <div class="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-gray-800 pb-4">
              <h3 class="text-2xl font-black text-primary-dark dark:text-white italic uppercase">Formulario Estudiante</h3>
              <VBtn @click="closeModal('modal-estudiante')" class="text-slate-400 hover:text-red-500 transition-colors"><VIcon class="material-symbols-outlined">close</VIcon></VBtn>
          </div>
          <div class="space-y-5">
              <div class="grid grid-cols-2 gap-4">
                  <div><label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombres</label><UiInput type="text" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10" /></div>
                  <div><label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apellidos</label><UiInput type="text" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10" /></div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                  <div><label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cédula de Identidad</label><UiInput type="text" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10" /></div>
                  <div><label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</label><UiInput type="text" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10" /></div>
              </div>
              <div><label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo Electrónico</label><UiInput type="email" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10" /></div>
          </div>
          <div class="mt-8 flex justify-end gap-4 pt-4 border-t border-slate-100 dark:border-gray-800">
              <VBtn @click="closeModal('modal-estudiante')" class="px-6 py-3 text-slate-500 font-black uppercase text-[10px] hover:bg-slate-50 dark:hover:bg-gray-800 rounded-xl">Cancelar</VBtn>
              <VBtn @click="closeModal('modal-estudiante')" class="px-8 py-3 bg-primary-dark text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 shadow-lg transition-all">Guardar</VBtn>
          </div>
      </VCard>
  </VDialog>

  <!-- Modal Ponente -->
  <VDialog v-if="activeModal === 'modal-ponente'" :model-value="true" persistent class="sgea-dialog" width="100%" max-width="calc(100vw - 32px)">
      <VCard class="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-lg p-10 shadow-2xl">
          <div class="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-gray-800 pb-4">
              <h3 class="text-2xl font-black text-primary-dark dark:text-white italic uppercase">Formulario Ponente</h3>
              <VBtn @click="closeModal('modal-ponente')" class="text-slate-400 hover:text-red-500 transition-colors"><VIcon class="material-symbols-outlined">close</VIcon></VBtn>
          </div>
          <div class="space-y-5">
              <div>
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Seleccionar Ponente Existente (Opcional)</label>
                  <UiSelect v-model="ponenteSeleccionado" @change="cargarDatosPonente" class="w-full bg-slate-100 dark:bg-gray-800 border-2 border-slate-200 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-xs text-primary-dark dark:text-white outline-none focus:ring-2 focus:ring-umsa-gold">
                      <option value="">-- Nuevo Ponente (Escribir datos) --</option>
                      <option v-for="p in ponentesExistentes" :key="p.id" :value="p.email">
                          {{ p.persona?.primer_apellido }} {{ p.persona?.nombres }} ({{ p.email }})
                      </option>
                  </UiSelect>
              </div>

              <div class="border-t border-slate-100 dark:border-gray-800 pt-4">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo Electrónico</label>
                  <UiInput v-model="ponenteForm.email" type="email" placeholder="ejemplo@correo.com" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                  <div>
                      <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombres</label>
                      <UiInput v-model="ponenteForm.nombres" type="text" placeholder="Nombres" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10" />
                  </div>
                  <div>
                      <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apellido Paterno</label>
                      <UiInput v-model="ponenteForm.primer_apellido" type="text" placeholder="Apellido" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10" />
                  </div>
              </div>
              <div>
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Temática / Título de la Presentación <span class="font-normal text-slate-300">(Opcional, se usará en el certificado)</span></label>
                  <VTextarea v-model="ponenteForm.tematica" placeholder="Ej: Avances en biología molecular aplicada a cultivos andinos..." rows="2" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none focus:ring-4 focus:ring-umsa-gold/10 resize-none text-sm"></VTextarea>
              </div>
              <p class="text-[9px] text-slate-400 font-bold italic">* Si el docente no existe, se creará una cuenta con una contraseña segura temporal.</p>
          </div>
          <div class="mt-8 flex justify-end gap-4 pt-4 border-t border-slate-100 dark:border-gray-800">
              <VBtn @click="closeModal('modal-ponente')" class="px-6 py-3 text-slate-500 font-black uppercase text-[10px] hover:bg-slate-50 dark:hover:bg-gray-800 rounded-xl">Cancelar</VBtn>
              <VBtn @click="asignarPonente" class="px-8 py-3 bg-primary-dark text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 shadow-lg transition-all">Vinculación Automática</VBtn>
          </div>
      </VCard>
  </VDialog>

  <!-- Modal Detalle Postulante (Premium) -->
  <VDialog v-if="activeModal === 'modal-detalle-postulante'" :model-value="true" persistent class="sgea-dialog" width="100%" max-width="calc(100vw - 32px)">
      <VCard v-if="solicitudSeleccionada" class="bg-white dark:bg-gray-900 rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
          <!-- Header del Perfil -->
          <div class="relative h-40 bg-gradient-to-r from-umsa-blue to-primary-dark p-10 flex items-end">
              <div class="flex items-center gap-6 z-10">
                  <VCard class="w-24 h-24 rounded-3xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-2xl border-4 border-white/20">
                      <VIcon class="material-symbols-outlined text-5xl text-umsa-blue">person</VIcon>
                  </VCard>
                  <div class="text-white">
                      <h3 class="text-3xl font-black uppercase italic leading-tight">{{ solicitudSeleccionada.usuario?.persona?.nombres }} {{ solicitudSeleccionada.usuario?.persona?.primer_apellido }} {{ solicitudSeleccionada.usuario?.persona?.segundo_apellido }}</h3>
                      <div class="flex gap-3 mt-2">
                          <span v-if="solicitudSeleccionada.miembro_tyan" class="bg-umsa-gold text-primary-dark px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
                              <VIcon class="material-symbols-outlined text-xs">verified</VIcon> Miembro TYAN
                          </span>
                          <span class="bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Postulante</span>
                      </div>
                  </div>
              </div>
              <VBtn @click="closeModal('modal-detalle-postulante')" class="absolute top-8 right-8 p-3 bg-white/10 hover:bg-red-500 text-white rounded-full transition-all">
                  <VIcon class="material-symbols-outlined">close</VIcon>
              </VBtn>
          </div>

          <div class="p-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
              <!-- Columna Datos Personales -->
              <div class="lg:col-span-2 space-y-8">
                  <div>
                      <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <VIcon class="material-symbols-outlined text-sm">badge</VIcon> Información Personal
                      </h4>
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-gray-800/50 p-6 rounded-3xl">
                          <div><p class="text-[9px] text-slate-400 font-black uppercase">Documento ID</p><p class="font-bold text-sm text-primary-dark dark:text-white">{{ solicitudSeleccionada.usuario?.persona?.documento_identidad }}</p></div>
                          <div><p class="text-[9px] text-slate-400 font-black uppercase">Género</p><p class="font-bold text-sm text-primary-dark dark:text-white">{{ getGeneroLabel(solicitudSeleccionada.usuario?.persona?.genero) }}</p></div>
                          <div><p class="text-[9px] text-slate-400 font-black uppercase">Nacimiento</p><p class="font-bold text-sm text-primary-dark dark:text-white">{{ solicitudSeleccionada.usuario?.persona?.fecha_nacimiento }}</p></div>
                          <div><p class="text-[9px] text-slate-400 font-black uppercase">Origen</p><p class="font-bold text-sm text-primary-dark dark:text-white uppercase">{{ solicitudSeleccionada.usuario?.persona?.pais_origen }}</p></div>
                          <div><p class="text-[9px] text-slate-400 font-black uppercase">Residencia</p><p class="font-bold text-sm text-primary-dark dark:text-white uppercase">{{ solicitudSeleccionada.usuario?.persona?.pais_residencia }}</p></div>
                          <div><p class="text-[9px] text-slate-400 font-black uppercase">Celular</p><p class="font-bold text-sm text-emerald-600 dark:text-emerald-400">{{ solicitudSeleccionada.usuario?.persona?.celular }}</p></div>
                      </div>
                  </div>

                  <div>
                      <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <VIcon class="material-symbols-outlined text-sm">history_edu</VIcon> Motivación de Inscripción
                      </h4>
                      <div class="bg-blue-50 dark:bg-blue-900/10 border-l-4 border-umsa-blue p-6 rounded-r-3xl italic text-slate-600 dark:text-slate-300 text-sm font-medium">
                          "{{ solicitudSeleccionada.razon || 'No se proporcionó una razón específica.' }}"
                      </div>
                  </div>
              </div>

              <!-- Columna Afiliaciones Académicas -->
              <div class="space-y-6">
                  <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <VIcon class="material-symbols-outlined text-sm">school</VIcon> Perfil Académico
                  </h4>
                  <div class="space-y-4">
                      <VCard v-for="af in solicitudSeleccionada.usuario?.afiliaciones" :key="af.id" class="p-4 border border-slate-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-800 shadow-sm">
                          <p class="text-[10px] font-black text-umsa-blue uppercase mb-1">{{ af.tipo_afiliacion || 'Institución' }}</p>
                          <p class="font-black text-primary-dark dark:text-white text-xs uppercase">{{ af.afiliacion || af.institucion }}</p>
                          <div class="mt-2 pt-2 border-t border-slate-50 dark:border-gray-700 space-y-1">
                             <p class="text-[9px] font-bold text-slate-400 uppercase">Área: <span class="text-slate-600 dark:text-gray-300">{{ af.area_tematica }}</span></p>
                             <p class="text-[9px] font-bold text-slate-400 uppercase">Disciplina: <span class="text-slate-600 dark:text-gray-300">{{ af.disciplina_cientifica }}</span></p>
                             <p v-if="af.gradoAcademico" class="text-[9px] font-bold text-slate-400 uppercase">Grado: <span class="text-emerald-600 dark:text-emerald-400 font-black">{{ af.gradoAcademico?.descripcion }}</span></p>
                          </div>
                      </VCard>
                      <div v-if="!solicitudSeleccionada.usuario?.afiliaciones?.length" class="text-center p-6 bg-slate-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-gray-700">
                          <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin Afiliaciones registradas</p>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Footer de Acciones -->
          <div class="p-8 bg-slate-50 dark:bg-gray-800/50 border-t border-slate-100 dark:border-gray-800 flex justify-between items-center">
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">* Al aprobar, el estudiante recibirá un correo de confirmación.</p>
              <div class="flex gap-4">
                  <VBtn @click="cambiarEstadoInscripcion(solicitudSeleccionada.id, 2)" class="px-8 py-3 bg-white dark:bg-gray-900 border-2 border-red-100 dark:border-red-900 text-red-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all">Rechazar Solicitud</VBtn>
                  <VBtn @click="cambiarEstadoInscripcion(solicitudSeleccionada.id, 1)" class="px-10 py-3 bg-emerald-500 text-primary-dark rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all">Aprobar Inscripción</VBtn>
              </div>
          </div>
      </VCard>
  </VDialog>

  <!-- MODAL DE CONFIGURACIÓN AVANZADA (EDICIÓN) -->
  <VDialog :model-value="true" persistent class="sgea-dialog" width="100%" max-width="1024" v-if="isEditing" >
      <div class="activity-editor bg-white dark:bg-gray-900 rounded-[2rem] md:rounded-[3rem] w-full max-w-5xl h-full md:h-auto max-h-[95vh] overflow-y-auto shadow-2xl flex flex-col border border-white/10">
          
          <div class="p-8 md:p-12 flex-1 space-y-12">
              <div class="flex justify-between items-start">
                  <div>
                      <h2 class="text-2xl md:text-4xl font-black text-primary-dark dark:text-white uppercase italic tracking-tighter">Editar actividad</h2>
                      <p class="text-slate-400 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] mt-2 italic">Edición de contenido, horarios y diseño visual</p>
                  </div>
                  <VBtn @click="descartarEdicion" :disabled="isSaving" aria-label="Cerrar edición" class="p-4 bg-slate-100 dark:bg-gray-800 rounded-full text-slate-400 hover:text-red-500 transition-all">
                      <VIcon class="material-symbols-outlined font-black">close</VIcon>
                  </VBtn>
              </div>

              <ActivityContentAccess v-if="editForm.requisitos" v-model="editForm.requisitos" :activity-type="editForm.tipo" :busy="isSaving" />
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                  <!-- Columna 1: Información & Imagen -->
                  <div class="space-y-8">
                      <div class="space-y-4">
                          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Portada del Curso (Imagen Recomendada 16:9)</label>
                          <div class="relative group cursor-pointer overflow-hidden rounded-[2rem] bg-slate-100 dark:bg-gray-800 border-2 border-dashed border-slate-200 dark:border-gray-700 aspect-video flex items-center justify-center">
                              <img v-if="imagenPreview || actividad?.imagen" :src="imagenPreview || getImageUrl('cursos', actividad?.imagen)" alt="Portada de la actividad" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
                              <div v-else class="text-center p-8">
                                  <VIcon class="material-symbols-outlined text-4xl text-slate-300 mb-2">add_a_photo</VIcon>
                                  <p class="text-[9px] font-black text-slate-400 uppercase">Subir Nueva Imagen</p>
                              </div>
                              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Portada de la actividad" @change="handleImageChange" class="absolute inset-0 opacity-0 cursor-pointer">
                              <div class="pointer-events-none absolute inset-0 bg-primary-dark/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span class="text-white font-black text-[10px] uppercase tracking-widest">Cambiar Imagen</span>
                              </div>
                          </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Título de la Actividad</label>
                              <input aria-label="Título de la Actividad" v-model="editForm.nombre" type="text" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-2xl py-4 px-6 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all" />
                          </div>
                          <div>
                              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tipo de Actividad</label>
                              <select aria-label="Tipo de Actividad" v-model="editForm.tipo" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-2xl py-4 px-6 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all">
                                  <option v-if="editForm.tipo && !['Curso', 'Taller', 'Conferencia', 'Workshop', 'Seminario'].includes(editForm.tipo)" :value="editForm.tipo">{{ editForm.tipo }}</option>
                                  <option value="Curso">Curso</option>
                                  <option value="Taller">Taller</option>
                                  <option value="Conferencia">Conferencia</option>
                                  <option value="Workshop">Workshop</option>
                                  <option value="Seminario">Seminario</option>
                              </select>
                          </div>
                          <div>
                              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Modalidad de Enseñanza</label>
                              <select aria-label="Modalidad de Enseñanza" v-model="editForm.modalidad" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-2xl py-4 px-6 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all">
                                  <option value="Presencial">Presencial</option>
                                  <option value="Virtual">Virtual</option>
                                  <option value="Híbrido">Híbrido</option>
                                  <option value="Semipresencial">Semipresencial</option>
                              </select>
                          </div>
                      </div>

                      <div>
                          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Descripción Detallada</label>
                          <textarea aria-label="Descripción Detallada" v-model="editForm.descripcion" rows="4" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-2xl py-4 px-6 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all resize-none"></textarea>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div>
                              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Fecha Inicio</label>
                              <input aria-label="Fecha Inicio" v-model="editForm.fecha_inicio" type="date" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-2xl py-4 px-6 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all" />
                          </div>
                          <div>
                              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Fecha Fin</label>
                              <input aria-label="Fecha Fin" v-model="editForm.fecha_fin" type="date" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-2xl py-4 px-6 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all" />
                          </div>
                          <div>
                              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Carga Horaria (Hrs)</label>
                              <input aria-label="Carga Horaria (Hrs)" v-model.number="editForm.horas" min="1" type="number" class="w-full bg-slate-50 dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-2xl py-4 px-6 font-bold text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all" />
                          </div>
                      </div>

                      <p v-if="requisitosError" role="alert" class="text-sm text-red-600 dark:text-red-400">{{ requisitosError }}</p>
                      <ActivityRequirementsEditor v-else v-model="editForm.requisitos" />
                  </div>

                  <!-- Columna 2: Horarios & Parámetros -->
                  <div class="space-y-8">
                      <div class="bg-slate-50 dark:bg-gray-800/30 p-8 rounded-[2rem] border border-slate-100 dark:border-gray-800">
                          <h4 class="text-xs font-black text-primary-dark dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                             <VIcon class="material-symbols-outlined text-sm text-umsa-gold">verified</VIcon> Parámetros de Aprobación
                          </h4>
                          <div class="grid grid-cols-2 gap-4 mb-10">
                              <div>
                                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nota Mínima</label>
                                  <input aria-label="Nota Mínima" v-model.number="editForm.min_nota" type="number" min="0" max="100" class="w-full bg-white dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-center text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all" />
                              </div>
                              <div>
                                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Asistencia Mínima (%)</label>
                                  <input aria-label="Asistencia Mínima (%)" v-model.number="editForm.min_asistencia" type="number" min="0" max="100" class="w-full bg-white dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-center text-primary-dark dark:text-white focus:border-umsa-gold outline-none transition-all" />
                              </div>
                          </div>

                          <h4 class="text-xs font-black text-primary-dark dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                             <VIcon class="material-symbols-outlined text-sm text-umsa-gold">schedule</VIcon> Cronograma (Horarios)
                          </h4>
                          
                          <div class="grid gap-3 mb-6">
                              <select aria-label="Día de la sesión" v-model="nuevaSesion.dia" class="flex-1 min-w-[120px] bg-white dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-2 px-3 text-[10px] font-bold outline-none focus:border-umsa-gold">
                                  <option>Lunes</option><option>Martes</option><option>Miércoles</option><option>Jueves</option><option>Viernes</option><option>Sábado</option><option>Domingo</option>
                              </select>
                              <div class="flex items-center gap-2">
                                  <input aria-label="Hora de inicio" v-model="nuevaSesion.hora_inicio" type="time" class="w-32 bg-white dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-2 px-3 text-[10px] font-bold outline-none focus:border-umsa-gold" />
                                  <span class="text-slate-400 font-bold text-xs">a</span>
                                  <input aria-label="Hora de fin" v-model="nuevaSesion.hora_fin" type="time" class="w-32 bg-white dark:bg-gray-800 border-2 border-slate-100 dark:border-gray-700 rounded-xl py-2 px-3 text-[10px] font-bold outline-none focus:border-umsa-gold" />
                              </div>
                              <VBtn @click="agregarSesion" class="justify-self-start bg-primary-dark text-white px-4 py-2 rounded-xl hover:bg-emerald-500 transition-all flex items-center gap-1">
                                  <VIcon class="material-symbols-outlined text-sm">add</VIcon>
                                  <span class="text-[9px] font-black uppercase">Agregar</span>
                              </VBtn>
                          </div>

                          <div class="space-y-2">
                              <VCard v-for="(s, idx) in editForm.sesiones" :key="idx" class="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-xl border border-slate-100 dark:border-gray-800 animate-in slide-in-from-right-2">
                                  <div class="flex items-center gap-3">
                                      <span class="w-2 h-2 bg-umsa-gold rounded-full"></span>
                                      <p class="text-[10px] font-black text-primary-dark dark:text-white uppercase">{{ s.dia }} <span class="text-slate-400 font-bold ml-2">{{ s.hora_inicio }} - {{ s.hora_fin }}</span></p>
                                  </div>
                                  <VBtn @click="eliminarSesion(idx)" class="text-red-400 hover:text-red-600 transition-colors"><VIcon class="material-symbols-outlined text-sm">delete_sweep</VIcon></VBtn>
                              </VCard>
                          </div>
                      </div>

                      <!-- Asignación de Personal de Logística -->
                      <div class="bg-slate-50 dark:bg-gray-800/30 p-8 rounded-[2rem] border border-slate-100 dark:border-gray-800 mt-6">
                          <div class="flex items-center justify-between mb-6">
                              <div>
                                  <h4 class="text-xs font-black text-primary-dark dark:text-white uppercase tracking-widest">Personal de Logística Asignado</h4>
                                  <p class="text-[9px] text-slate-400 dark:text-gray-500 font-bold uppercase mt-1">Selecciona el personal de logística para esta actividad</p>
                              </div>
                              <VIcon class="material-symbols-outlined text-lg text-emerald-500">support_agent</VIcon>
                          </div>

                          <!-- Buscador local -->
                          <div class="relative w-full mb-4">
                              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                                  <VIcon class="material-symbols-outlined text-sm">search</VIcon>
                              </span>
                              <input aria-label="Buscar personal" v-model="filtroLogistica" type="text" placeholder="Buscar personal..." class="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold focus:border-emerald-500 outline-none transition-all" />
                          </div>

                          <div v-if="logisticaFiltrada.length === 0" class="text-center py-4 border border-dashed border-slate-200 dark:border-gray-800 rounded-xl">
                              <p class="text-[10px] text-slate-400 font-bold uppercase">No se encontró personal de logística</p>
                          </div>

                          <div v-else class="space-y-2 max-h-[180px] overflow-y-auto pr-1" style="scrollbar-width: thin;">
                              <div v-for="user in logisticaFiltrada" :key="user.id"
                                   @click="toggleLogisticaUsuario(user.id)"
                                   :class="editForm.logistica_ids?.includes(user.id) 
                                        ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800/80 shadow-sm ring-1 ring-emerald-500/10' 
                                        : 'border-slate-100 dark:border-gray-800 hover:border-slate-200 dark:hover:border-gray-700 bg-white dark:bg-gray-900'"
                                   class="p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group">
                                  <div class="flex items-center gap-2">
                                      <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 flex items-center justify-center font-black text-xs uppercase"
                                           :class="{'bg-emerald-500 text-white dark:bg-emerald-600': editForm.logistica_ids?.includes(user.id)}">
                                          {{ user.displayName?.charAt(0) || 'L' }}
                                      </div>
                                      <div>
                                          <p class="text-xs font-black text-slate-700 dark:text-gray-200 uppercase leading-tight">{{ user.displayName }}</p>
                                          <p class="text-[9px] text-slate-400 font-bold mt-0.5 font-mono select-all">{{ user.email }}</p>
                                      </div>
                                  </div>
                                  <VIcon class="material-symbols-outlined text-base"
                                        :class="editForm.logistica_ids?.includes(user.id) ? 'text-emerald-500' : 'text-slate-300 dark:text-gray-700 group-hover:text-slate-400'">
                                      {{ editForm.logistica_ids?.includes(user.id) ? 'check_circle' : 'radio_button_unchecked' }}
                                  </VIcon>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <div class="p-6 md:p-8 bg-slate-50 dark:bg-gray-800/50 border-t border-slate-100 dark:border-gray-800 flex flex-col sm:flex-row justify-end gap-3 md:gap-4">
              <VBtn @click="descartarEdicion" :disabled="isSaving" class="w-full sm:w-auto px-8 py-4 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 dark:hover:bg-gray-800 rounded-2xl transition-all">Descartar</VBtn>
              <VBtn @click="guardarCambios" class="w-full sm:w-auto px-10 py-4 bg-emerald-500 text-primary-dark rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all" :disabled="isSaving || !!requisitosError">{{ isSaving ? 'Guardando...' : 'Guardar cambios' }}</VBtn>
          </div>
      </div>
  </VDialog>

  <!-- Modal dedicado: Asignar Personal de Logística -->
  <VDialog v-if="activeModal === 'modal-asignar-logistica'" :model-value="true" persistent class="sgea-dialog" width="100%" max-width="calc(100vw - 32px)">
      <div class="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
          <!-- Header -->
          <div class="p-8 pb-4 flex justify-between items-start border-b border-slate-100 dark:border-gray-800">
              <div>
                  <h3 class="text-2xl font-black text-primary-dark dark:text-white italic uppercase">Asignar Logística</h3>
                  <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Selecciona el personal para esta actividad</p>
              </div>
              <VBtn @click="closeModal('modal-asignar-logistica')" class="text-slate-400 hover:text-red-500 transition-colors mt-1">
                  <VIcon class="material-symbols-outlined">close</VIcon>
              </VBtn>
          </div>

          <!-- Buscador -->
          <div class="px-8 pt-5 pb-3">
              <div class="relative">
                  <span class="absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <VIcon class="material-symbols-outlined text-sm">search</VIcon>
                  </span>
                  <UiInput v-model="filtroLogisticaModal" type="text" placeholder="Buscar por nombre o correo..."
                         class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold focus:border-emerald-500 outline-none transition-all" />
              </div>
              <!-- Contador seleccionados -->
              <p class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-2">
                  {{ logisticaIdsTemp.length }} seleccionado(s)
              </p>
          </div>

          <!-- Lista de usuarios -->
          <div class="px-8 pb-4 flex-1 overflow-y-auto space-y-2" style="scrollbar-width: thin;">
              <div v-if="logisticaFiltradaModal.length === 0" class="text-center py-10 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-2xl">
                  <VIcon class="material-symbols-outlined text-3xl text-slate-300 mb-2 block">group_off</VIcon>
                  <p class="text-[10px] font-black text-slate-400 uppercase">No se encontró personal</p>
              </div>
              <div v-for="user in logisticaFiltradaModal" :key="user.id"
                   @click="toggleLogisticaTemp(user.id)"
                   :class="logisticaIdsTemp.includes(user.id)
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 ring-1 ring-emerald-500/20'
                        : 'border-slate-100 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'"
                   class="p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group select-none">
                  <div class="flex items-center gap-3">
                      <!-- Avatar -->
                      <div class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm uppercase flex-shrink-0 transition-all"
                           :class="logisticaIdsTemp.includes(user.id) ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400'">
                          {{ user.displayName?.charAt(0) || 'L' }}
                      </div>
                      <!-- Nombre y email -->
                      <div>
                          <p class="text-xs font-black text-slate-700 dark:text-gray-200 uppercase leading-tight">{{ user.displayName }}</p>
                          <p class="text-[9px] text-slate-400 font-medium mt-0.5">{{ user.email }}</p>
                      </div>
                  </div>
                  <!-- Check indicator -->
                  <VIcon class="material-symbols-outlined text-xl transition-all"
                        :class="logisticaIdsTemp.includes(user.id) ? 'text-emerald-500' : 'text-slate-200 dark:text-gray-700 group-hover:text-slate-400'">
                      {{ logisticaIdsTemp.includes(user.id) ? 'check_circle' : 'radio_button_unchecked' }}
                  </VIcon>
              </div>
          </div>

          <!-- Footer acciones -->
          <div class="p-6 bg-slate-50 dark:bg-gray-800/50 border-t border-slate-100 dark:border-gray-800 flex gap-3 rounded-b-[2rem]">
              <VBtn @click="closeModal('modal-asignar-logistica')" class="flex-1 py-3 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 dark:hover:bg-gray-700 rounded-xl transition-all">
                  Cancelar
              </VBtn>
              <VBtn @click="guardarLogistica" :disabled="isSavingLogistica"
                      class="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  <VIcon v-if="isSavingLogistica" class="material-symbols-outlined text-sm animate-spin">progress_activity</VIcon>
                  {{ isSavingLogistica ? 'Guardando...' : 'Guardar Asignación' }}
              </VBtn>
          </div>
      </div>
  </VDialog>

</template>

<style scoped>
.activity-editor {
    color: #0f172a;
    --editor-input-bg: #f8fafc;
    --editor-input-border: #cbd5e1;
    --editor-input-color: #0f172a;
}
:global(.dark .activity-editor) {
    color: #f1f5f9;
    --editor-input-bg: #1e293b;
    --editor-input-border: #64748b;
    --editor-input-color: #f1f5f9;
    color-scheme: dark;
}
.activity-editor :deep(input:not([type='checkbox']):not([type='file'])),
.activity-editor :deep(select),
.activity-editor :deep(textarea) {
    display: block;
    width: 100%;
    min-width: 0;
    background: var(--editor-input-bg);
    color: var(--editor-input-color);
    border: 1px solid var(--editor-input-border);
    border-radius: 12px;
    padding: 12px;
    font-size: 14px;
    line-height: 1.5;
}
.activity-editor :deep(input:focus-visible),
.activity-editor :deep(select:focus-visible),
.activity-editor :deep(textarea:focus-visible) {
    outline: 2px solid #38bdf8;
    outline-offset: 2px;
}
.activity-editor :deep(input[type='checkbox']) {
    width: 18px;
    height: 18px;
    accent-color: #0070bb;
}
.activity-editor :deep(input::placeholder) { color: #64748b; }
:global(.dark .activity-editor input::placeholder) { color: #cbd5e1; }
</style>
