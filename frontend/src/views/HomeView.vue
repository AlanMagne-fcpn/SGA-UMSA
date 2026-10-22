<script setup lang="ts">
import { computed, nextTick, ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import api, { getImageUrl, imagenActividad, logoEvento, resolveMediaUrl } from '@/services/api';
import { useEventoStore } from '@/stores/eventoStore';
import PublicCatalog from '@/components/PublicCatalog.vue';
import EventLogo from '@/components/eventos/EventLogo.vue';

const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><rect width="24" height="24" fill="%23e2e8f0"/><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

const eventoStore = useEventoStore();
const route = useRoute();
const esDetalleEvento = computed(() => route.params.eventoId !== undefined);

const eventosActivos = ref<any[]>([]);
const ponentesDB = ref<any[]>([]);
const eventoSeleccionado = computed(() => esDetalleEvento.value
  ? eventosActivos.value.find(evento => String(evento.id) === String(route.params.eventoId)) || null
  : null);
const cargandoEventos = ref(true);
const heroImageSmall = ref(false);
const icons = ['school', 'memory', 'public', 'biotech', 'eco', 'science'];
const colors = ['bg-emerald-500', 'bg-umsa-gold', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-teal-500'];

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getDate()} de ${monthNames[date.getMonth()]}`;
};

const getStatusColor = (status: string) => {
  if (status === 'Inscripciones Abiertas' || status === 'Activo') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800';
  if (status === 'Próximamente' || status === 'Planificación') return 'text-umsa-blue bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800';
  return 'text-slate-500 bg-slate-100 dark:bg-gray-800 dark:text-gray-400 border border-slate-200 dark:border-gray-700';
};

const cargarEventos = async () => {
    try {
        const response = await api.get('/eventos');
        const eventosDB = Array.isArray(response.data) ? response.data : (response.data.data || []);
        
        // Filtramos solo Activos (1) y Planificación (2) para el home
        const filtrados = eventosDB.filter((e: any) => {
            const estado = Number(e.estado);
            return estado === 1 || estado === 2 || (estado === 0 && e.visibilidad_al_finalizar !== 'oculto');
        });
        
        // Procesamos los eventos y cargamos sus ponentes reales
        const eventosProcesados = await Promise.all(filtrados.map(async (ev: any, index: number) => {
            const rawDesc = ev.descripcion || '';
            let mostrarCorreos = false;
            let cleanedDesc = rawDesc;
            
            // Separar metadatos de ponentes si existen
            const partsP = cleanedDesc.split('\n[PONENTES_METADATA]:');
            cleanedDesc = partsP[0] || '';
            
            // Separar metadatos de mostrar correos si existen
            if (cleanedDesc.includes('\n[MOSTRAR_CORREOS]:')) {
                const partsMC = cleanedDesc.split('\n[MOSTRAR_CORREOS]:');
                cleanedDesc = partsMC[0] || '';
                mostrarCorreos = partsMC[1]?.trim() === 'true';
            }

            let ponentesArr: any[] = [];
            
            try {
                // LLAMADA AUTOMÁTICA: Traer ponentes de las actividades del evento
                const resP = await api.get(`/eventos/${ev.id}/imparticiones`);
                const dataP = Array.isArray(resP.data) ? resP.data : (resP.data.data || []);
                
                ponentesArr = dataP.map((p: any) => ({
                    id: p.id,
                    name: [p.grado_abreviacion, p.nombres, p.primer_apellido].filter(Boolean).join(' '),
                    topic: p.profesion || 'Expositor',
                    country: mostrarCorreos && p.email ? p.email : 'Expositor',
                    img: resolveMediaUrl(p.foto, defaultAvatar)
                }));
            } catch (e) {
                console.error(`Error cargando ponentes para evento ${ev.id}`, e);
            }

            return {
                id: ev.id,
                title: ev.nombre,
                subtitle: ev.ubicacion || 'Universidad Mayor de San Andrés', 
                status: Number(ev.estado) === 1 ? 'Activo' : Number(ev.estado) === 2 ? 'Planificación' : 'Finalizado',
                gestion: ev.gestion || 'Actual',
                date: `${ev.fecha_inicio || 'TBD'} - ${ev.fecha_fin || 'TBD'}`,
                dateShort: formatDate(ev.fecha_inicio) || 'Fechas por definir',
                description: cleanedDesc || 'Sin descripción',
                version: ev.version || '',
                color: colors[index % colors.length],
                icon: icons[index % icons.length],
                imagen_fondo: getImageUrl('fondos', ev.imagen_fondo, '/logo/fondoejeml.jpg'),
                logo: logoEvento(ev),
                google_maps_link: ev.google_maps_link || null,
                direccion: ev.direccion || null,
                sobre_evento_1: ev.sobre_evento_1 || null,
                frase_destacada: ev.frase_destacada || null,
                sigla: ev.sigla || '',
                color_principal: ev.color_principal || '#0070b4',
                institucion_badge: ev.institucion_badge || 'Evento Oficial OEA/TYAN',
                link_facebook: ev.link_facebook || null,
                link_web: ev.link_web || null,
                cronograma: (() => {
                    if (!ev.cronograma) return null;
                    try { 
                        return typeof ev.cronograma === 'string' ? JSON.parse(ev.cronograma) : ev.cronograma; 
                    } catch(e) { 
                        console.error("Error parsing cronograma JSON", e);
                        return null; 
                    } 
                })(),
                ponentes: ponentesArr,
                cursos: (ev.actividades || []).filter((act: any) => Number(act.estado) !== -1).map((act: any) => ({
                    id: act.id,
                    nombre: act.nombre,
                    descripcion: act.descripcion || '',
                    tipo: act.tipo || 'Curso',
                    modalidad: act.modalidad || act.modalidades?.[0]?.tipo || 'Presencial',
                    valoracion: act.valoracion || { cantidad: 0, promedio: null },
                    horas: act.horas,
                    fecha_inicio: act.fecha_inicio,
                    estado: Number(act.estado),
                    imagen: imagenActividad(act),
                })),
                coordinadores: Array.isArray(ev.coordinadores) ? ev.coordinadores : [],
                secciones: ev.secciones_visibles || {},
            };
        }));

        eventosActivos.value = eventosProcesados;

    } catch(err) {
        console.error("Error al cargar eventos en Home", err);
    } finally {
        cargandoEventos.value = false;
    }
};

onMounted(() => {
    cargarEventos();
});

watch(eventoSeleccionado, async (evento) => {
  heroImageSmall.value = false;
  if (evento) eventoStore.setVersion(evento.id);
  await nextTick();
  if (route.hash) document.getElementById(route.hash.slice(1))?.scrollIntoView();
  else if (evento) window.scrollTo({ top: 0 });
});

const onHeroImageLoad = (event: Event) => {
  const image = event.target as HTMLImageElement;
  heroImageSmall.value = image.naturalWidth < 1280 || image.naturalHeight < 720;
};

const abrirMapa = (url: string) => {
  if (url) window.open(url, '_blank');
};


</script>

<template>
  <main class="pt-20 font-sans text-gray-800 transition-colors duration-300 dark:text-gray-200 md:pt-24">
    <div v-if="esDetalleEvento && cargandoEventos" class="px-6 py-20 text-center" role="status">Cargando evento…</div>
    <div v-else-if="esDetalleEvento && !eventoSeleccionado" class="px-6 py-20 text-center">
      <h1 class="text-3xl font-bold">Evento no disponible</h1>
      <p class="mt-3">El evento no existe o ya no está publicado.</p>
      <RouterLink to="/eventos" class="mt-6 inline-block font-bold text-sky-600 dark:text-sky-300">Ver todos los eventos</RouterLink>
    </div>
    <!-- SECCIÓN PRINCIPAL (HERO) -->
    <section v-if="eventoSeleccionado" id="inicio" class="relative flex min-h-[560px] w-full flex-col justify-center overflow-hidden bg-[#071523] py-16 text-left md:min-h-[min(76svh,760px)] md:py-20">
        <div class="absolute inset-0 bg-primary-dark/25 dark:bg-black/50 z-10 transition-colors duration-700"></div>
        <img :key="eventoSeleccionado?.id" :src="eventoSeleccionado?.imagen_fondo || '/logo/fondoejeml.jpg'" data-fallback-src="/logo/fondoejeml.jpg" :class="heroImageSmall ? 'absolute right-0 top-1/2 h-auto max-h-[70%] w-full -translate-y-1/2 object-contain opacity-50 md:right-[3%] md:w-[48%] md:rounded-2xl' : 'absolute inset-0 h-full w-full object-cover object-center'" class="transition-all duration-700" alt="Fondo del evento" @load="onHeroImageLoad">
        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/55 to-transparent dark:from-black dark:via-black/70 z-20"></div>

        <div class="relative z-30 mx-auto flex w-full max-w-[2500px] flex-col items-start px-6 md:px-16 lg:px-24">
            <!-- Identidad del evento seleccionado -->
            <div class="mb-8 flex w-full flex-col items-start justify-start gap-4 animate-in fade-in duration-500">
                <span :style="{ backgroundColor: eventoSeleccionado?.color_principal || '#10b981' }" class="inline-flex min-h-[56px] w-full flex-wrap items-center gap-y-1 px-5 py-2 text-white sm:w-auto sm:px-6 border border-white/20 text-[10px] md:text-sm font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-black/20 animate-in slide-in-from-right-4 duration-700">
                  <EventLogo :src="eventoSeleccionado.logo" :nombre="eventoSeleccionado.title" class="mr-2 h-8 w-8 rounded-full p-1" /> {{ eventoSeleccionado?.institucion_badge || 'Evento oficial' }}
                  <span v-if="eventoSeleccionado?.sigla && !String(eventoSeleccionado?.institucion_badge || '').toLowerCase().includes(String(eventoSeleccionado.sigla).toLowerCase())" class="ml-3 border-l border-white/40 pl-3">{{ eventoSeleccionado.sigla }}</span>
                </span>
            </div>
            
            <!-- ROW 2: TÍTULO PRINCIPAL -->
            <h1 :key="`title-${eventoSeleccionado?.id}`" class="max-w-full break-words text-3xl sm:text-4xl md:text-6xl lg:text-[4.5rem] xl:text-[5.25rem] font-black text-white leading-[1.03] uppercase tracking-tighter mb-4 drop-shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-700">
              {{ eventoSeleccionado?.title }}
            </h1>
            
            <!-- ROW 3: SUBTÍTULO -->
            <h3 :key="`subtitle-${eventoSeleccionado?.id}`" class="text-xl md:text-3xl lg:text-4xl font-black text-slate-300 uppercase tracking-widest mb-6 font-serif max-w-[95%]">
               {{ eventoSeleccionado?.subtitle || 'Universidad Mayor de San Andrés' }}
            </h3>
            
            <!-- ROW 4: BADGES ADICIONALES (Versión, Fechas, Ubicación) -->
            <div :key="`tags-${eventoSeleccionado?.id}`" class="flex flex-row flex-wrap items-center justify-start gap-3 mb-6 relative z-40 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
               <span v-if="eventoSeleccionado?.version" :style="{ backgroundColor: eventoSeleccionado?.color_principal || '#0070b4' }" class="inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-black/20">
                 <VIcon class="material-symbols-outlined text-[16px]">workspace_premium</VIcon> {{ eventoSeleccionado?.version }}
               </span>
               <span class="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-inner uppercase tracking-widest">
                 <VIcon class="material-symbols-outlined text-[18px] text-emerald-400">calendar_month</VIcon> {{ eventoSeleccionado?.dateShort }}
               </span>
               <span class="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-inner uppercase tracking-widest">
                 <VIcon class="material-symbols-outlined text-[18px] text-emerald-400">location_on</VIcon> {{ eventoSeleccionado?.direccion || 'La Paz, Bolivia' }}
               </span>
            </div>
            
            <!-- ROW 5: DESCRIPCIÓN -->
            <p :key="`desc-${eventoSeleccionado?.id}`" class="text-base md:text-xl text-slate-200 font-medium max-w-4xl leading-relaxed mb-10 drop-shadow-md animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
               {{ eventoSeleccionado?.description || 'Un evento de talla mundial donde la ciencia latinoamericana converge en La Paz para discutir temas de actualidad, desarrollo y sostenibilidad, enfocados en el progreso de la región y sus desafíos futuros.' }}
            </p>
            
            <!-- ROW 6: BOTONES DE ACCIÓN -->
            <div class="flex flex-col sm:flex-row flex-wrap items-center justify-start gap-4 w-full relative z-40 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-300">
                <VBtn @click="$router.push('/login')" :style="{ backgroundColor: eventoSeleccionado?.color_principal || '#10b981' }" class="w-full sm:w-auto text-white px-8 py-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-xl hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-1 flex items-center justify-center gap-2 border border-white/20">
                    <VIcon class="material-symbols-outlined text-[20px]">login</VIcon>
                    Ingresar al Portal
                </VBtn>
                <a href="#informacion" class="w-full sm:w-auto bg-white/10 backdrop-blur-md text-white hover:bg-white/20 px-8 py-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 border border-white/30 flex items-center justify-center gap-2">
                    <VIcon class="material-symbols-outlined text-[20px]">expand_circle_down</VIcon>
                    Detalles del Evento
                </a>
                <a href="#cursos" class="w-full sm:w-auto bg-sky-600 text-white px-8 py-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest flex items-center justify-center gap-2">Ver cursos del evento</a>
                <RouterLink to="/eventos" class="w-full sm:w-auto bg-white/10 backdrop-blur-md text-white hover:bg-white/20 px-8 py-4 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest transition-all border border-white/30 flex items-center justify-center gap-2">
                    <VIcon class="material-symbols-outlined text-[20px]">grid_view</VIcon>
                    Ver todos los eventos
                </RouterLink>
            </div>
        </div>
    </section>

    <PublicCatalog v-if="!esDetalleEvento || eventoSeleccionado" :key="String(route.params.eventoId || 'catalogo')" :eventos="esDetalleEvento ? [eventoSeleccionado] : eventosActivos" :cargando="cargandoEventos" :seleccionado="eventoSeleccionado" :solo-cursos="esDetalleEvento" />

    <!-- SECCIÓN DE INFORMACIÓN -->
    <section v-if="eventoSeleccionado" id="informacion" class="py-24 bg-white dark:bg-black transition-colors duration-300 -mt-2">
      <div class="w-full px-6 md:px-16 lg:px-24 max-w-[2500px] mx-auto">
        <div class="flex flex-col md:flex-row items-center md:items-start gap-12">
          
          <div class="md:w-1/3 flex-shrink-0">
              <!-- ENLACES EXTERNOS -->
              <div v-if="eventoSeleccionado?.link_web || eventoSeleccionado?.link_facebook" class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Más información oficial</p>

                <!-- Rich Card for Website -->
                <a
                  v-if="eventoSeleccionado?.link_web"
                  :href="eventoSeleccionado.link_web"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-full block bg-gradient-to-br from-white to-slate-50 dark:from-gray-900 dark:to-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 mb-4 group relative overflow-hidden"
                >
                  <!-- Decorative Gradient Beam -->
                  <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                  
                  <div class="flex items-start gap-4">
                    <!-- Icon Container -->
                    <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                      <VIcon class="material-symbols-outlined text-2xl">language</VIcon>
                    </div>
                    
                    <div class="flex-1 min-w-0">
                      <span class="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Portal Oficial</span>
                      <p class="text-sm font-black text-primary-dark dark:text-white mt-0.5 group-hover:text-emerald-600 transition-colors">Sitio Web del Evento</p>
                      <p class="text-xs font-medium text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">Visita el portal oficial para enterarte de todos los detalles y descargar recursos.</p>
                      
                      <!-- Badges/Tags -->
                      <div class="flex flex-wrap gap-2 mt-3">
                        <span class="text-[9px] font-bold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <VIcon class="material-symbols-outlined text-[10px]">bolt</VIcon> Acceso Rápido
                        </span>
                        <span class="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <VIcon class="material-symbols-outlined text-[10px]">verified</VIcon> Oficial
                        </span>
                      </div>
                    </div>
                  </div>
                </a>

                <!-- Rich Card for Facebook -->
                <a
                  v-if="eventoSeleccionado?.link_facebook"
                  :href="eventoSeleccionado.link_facebook"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-full block bg-gradient-to-br from-white to-slate-50 dark:from-gray-900 dark:to-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
                >
                  <!-- Decorative Gradient Beam -->
                  <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1877F2] to-blue-400"></div>
                  
                  <div class="flex items-start gap-4">
                    <!-- Icon Container -->
                    <div class="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-[#1877F2] group-hover:scale-110 transition-transform">
                      <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    
                    <div class="flex-1 min-w-0">
                      <span class="text-[9px] font-black text-[#1877F2] uppercase tracking-widest">Redes Sociales</span>
                      <p class="text-sm font-black text-primary-dark dark:text-white mt-0.5 group-hover:text-[#1877F2] transition-colors">Seguir en Facebook</p>
                      <p class="text-xs font-medium text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">Mantente al tanto de las transmisiones en vivo y actualizaciones del evento.</p>
                      
                      <!-- Badges/Tags -->
                      <div class="flex flex-wrap gap-2 mt-3">
                        <span class="text-[9px] font-bold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <VIcon class="material-symbols-outlined text-[10px]">videocam</VIcon> En Vivo
                        </span>
                        <span class="text-[9px] font-bold bg-blue-50 dark:bg-blue-900/30 text-[#1877F2] dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <VIcon class="material-symbols-outlined text-[10px]">share</VIcon> Comunidad
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              </div>
          </div>

          <div class="md:w-2/3 text-left">
            <h2 class="text-3xl md:text-5xl font-black text-umsa-blue dark:text-white mb-8 pb-4 border-b-4 border-umsa-blue inline-block uppercase italic tracking-tighter">Sobre el Evento</h2>
            <h3 class="text-xl font-bold text-slate-500 -mt-6 mb-8 uppercase tracking-widest">{{ eventoSeleccionado?.title }}</h3>
            
            <div class="text-slate-600 dark:text-gray-400 text-lg md:text-xl leading-relaxed space-y-6 font-medium">
              <p v-if="eventoSeleccionado?.sobre_evento_1" v-html="eventoSeleccionado.sobre_evento_1"></p>
              <p v-if="eventoSeleccionado?.sobre_evento_2" v-html="eventoSeleccionado.sobre_evento_2"></p>
              <div v-if="eventoSeleccionado?.frase_destacada" class="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/50 border-l-4 border-umsa-blue p-6 md:p-8 rounded-r-2xl mt-12 shadow-sm dark:shadow-none">
                <p class="italic text-blue-800 dark:text-blue-300 font-bold text-xl md:text-2xl leading-none">
                  "{{ eventoSeleccionado.frase_destacada }}"
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN DEL CRONOGRAMA -->
    <section v-if="eventoSeleccionado && eventoSeleccionado.secciones?.cronograma !== false" id="cronograma" class="py-24 bg-slate-50 dark:bg-gray-950 transition-colors duration-300 w-full">
      <div class="w-full px-6 md:px-16 lg:px-24 max-w-[2500px] mx-auto">
        <div class="flex items-center gap-4 mb-2">
            <div class="h-1 w-12 bg-emerald-500 rounded-full"></div>
            <span class="text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-widest text-xs md:text-sm">Actividades Programadas</span>
        </div>
        <div class="flex items-end justify-between mb-16">
          <h2 class="text-4xl md:text-6xl font-black text-primary-dark dark:text-white uppercase tracking-tighter italic">Cronograma {{ eventoSeleccionado?.gestion }}</h2>
          <p class="text-base md:text-lg text-umsa-blue font-bold uppercase tracking-widest hidden md:block bg-blue-50 dark:bg-umsa-blue/10 px-4 py-2 rounded-xl border border-blue-100 dark:border-umsa-blue/30">{{ eventoSeleccionado?.dateShort }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-[1400px] mx-auto">
          <VCard v-for="day in (eventoSeleccionado?.cronograma || [])" :key="day.day" class="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl shadow-lg hover:-translate-y-4 hover:shadow-2xl hover:shadow-umsa-blue/10 dark:hover:shadow-black/50 hover:border-umsa-blue/30 transition-all duration-300 overflow-hidden flex flex-col group h-full">
            <div class="bg-slate-100 dark:bg-gray-900 text-primary-dark dark:text-white p-8 relative overflow-hidden group-hover:bg-gradient-to-br group-hover:from-slate-100 group-hover:to-slate-200 dark:group-hover:from-gray-800 dark:group-hover:to-gray-900 transition-colors">
               <div class="text-8xl font-black opacity-5 dark:opacity-5 absolute -top-4 -right-4 text-umsa-blue group-hover:opacity-10 transition-all">{{ day.day }}</div>
               <span class="block text-6xl font-black text-umsa-blue dark:text-blue-200 group-hover:text-blue-800 dark:group-hover:text-white relative z-10 font-serif leading-none mb-2">{{ day.day }}</span>
               <span class="block text-xs uppercase tracking-widest font-bold text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 relative z-10">{{ day.name }}</span>
               <span v-if="day.date" class="block text-[10px] font-black text-umsa-gold mt-1 uppercase tracking-widest relative z-10">{{ formatDate(day.date) }}</span>
            </div>
            
            <div class="flex-1 p-8 space-y-6 pt-4 border-t border-slate-100 dark:border-gray-800 bg-white/50 dark:bg-black/20 group-hover:bg-transparent transition-colors">
              <div v-for="(evt, idx) in day.events" :key="idx" class="relative pl-6 before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-2 before:h-2 before:bg-emerald-500 before:rounded-full after:content-[''] after:absolute after:left-[3px] after:top-3.5 after:bottom-[-20px] after:w-[2px] after:bg-slate-200 dark:after:bg-gray-800 last:after:hidden">
                 <div class="flex flex-col gap-1 -mt-1">
                    <span class="text-umsa-blue text-[10px] uppercase font-black tracking-widest">{{ evt.time }}</span>
                    <span class="text-sm font-bold text-slate-600 dark:text-gray-300 group-hover:text-primary-dark dark:group-hover:text-white leading-tight uppercase">{{ evt.title }}</span>
                 </div>
              </div>
            </div>
          </VCard>
          
          <!-- Estado vacío para cronograma -->
          <div v-if="!(eventoSeleccionado?.cronograma?.length)" class="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-60">
             <div class="w-20 h-20 bg-slate-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                <VIcon class="material-symbols-outlined text-4xl text-slate-400">calendar_today</VIcon>
             </div>
             <h3 class="text-xl font-black text-slate-500 uppercase tracking-widest">Cronograma en Preparación</h3>
             <p class="text-sm text-slate-400 mt-2 max-w-md">Próximamente se publicarán las actividades detalladas para este evento. Manténgase informado a través de nuestras redes académicas.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN DE EXPOSITORES -->
    <section v-if="eventoSeleccionado && eventoSeleccionado.secciones?.directorio !== false" id="organizacion" class="py-24 bg-white dark:bg-black transition-colors duration-300 border-t border-slate-100 dark:border-gray-800 w-full">
      <div class="w-full px-6 md:px-16 lg:px-24 max-w-[2500px] mx-auto">
        <div class="flex items-center justify-center gap-4 mb-2">
            <span class="text-umsa-blue font-black uppercase tracking-widest text-xs md:text-sm">Red Especializada TWAS</span>
        </div>
        <h2 class="text-4xl md:text-6xl font-black text-center text-primary-dark dark:text-white mb-20 uppercase tracking-tighter italic"><span class="text-umsa-blue dark:text-blue-400">Directorio</span> Expositor</h2>

        <div v-if="eventoSeleccionado?.coordinadores?.length" class="flex flex-wrap justify-center gap-4 mb-12">
            <div v-for="coord in eventoSeleccionado.coordinadores" :key="coord.id" class="px-5 py-4 bg-slate-50 dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl min-w-[220px]">
                <p class="text-[9px] font-black uppercase tracking-widest text-umsa-blue">Coordinador</p>
                <p class="text-sm font-black uppercase text-primary-dark dark:text-white">{{ coord.nombres }} {{ coord.primer_apellido }}</p>
            </div>
        </div>

        <div v-if="eventoSeleccionado?.ponentes?.length" class="w-full relative">
            <!-- Contenedor Deslizable Horizontal -->
            <div class="flex flex-row gap-6 overflow-x-auto pb-8 pt-4 px-4 scroll-smooth snap-x snap-mandatory thin-scrollbar whitespace-nowrap">
                <div v-for="(spk, i) in eventoSeleccionado.ponentes" :key="i" class="inline-block flex-shrink-0 w-[280px] bg-slate-50 dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-[2rem] overflow-hidden shadow-md hover:shadow-2xl hover:-translate-y-2 hover:border-umsa-blue/30 transition-all duration-300 flex flex-col group relative snap-start">
                  
                  <!-- Contenedor de Imagen de Expositor -->
                  <div class="relative h-[320px] w-full overflow-hidden bg-slate-100 dark:bg-gray-800">
                     <!-- Floating Badge País / Correo -->
                     <div class="absolute top-4 right-4 z-20">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-black/60 dark:bg-black/80 backdrop-blur-md text-white border border-white/10 text-[9px] font-black uppercase tracking-widest rounded-lg">
                           <VIcon class="material-symbols-outlined text-[12px]" :class="spk.country && spk.country.includes('@') ? 'text-emerald-400' : 'text-blue-400'">
                              {{ spk.country && spk.country.includes('@') ? 'mail' : 'person' }}
                           </VIcon>
                           {{ spk.country || 'Expositor' }}
                        </span>
                     </div>
                     
                     <!-- Foto de Expositor -->
                     <img v-if="spk.img" :src="spk.img" class="w-full h-full object-cover filter grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 z-0" :onerror="`this.src='${defaultAvatar}'; this.onerror=null`" />
                     
                     <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10"></div>
                  </div>
                  
                  <!-- Información Detallada -->
                  <div class="p-6 flex flex-col flex-1 relative bg-white dark:bg-gray-900 border-t border-slate-50 dark:border-gray-800/50 whitespace-normal">
                     <span class="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-2">{{ spk.topic || 'Conferencia / Expositor' }}</span>
                     <h4 class="text-sm font-black text-primary-dark dark:text-white leading-snug uppercase tracking-tight line-clamp-2 min-h-[44px] group-hover:text-umsa-blue dark:group-hover:text-blue-400 transition-colors">{{ spk.name }}</h4>
                     
                     <!-- Línea decorativa estilo Premium -->
                     <div class="w-8 h-1 bg-slate-200 dark:bg-gray-800 group-hover:bg-umsa-blue transition-colors duration-500 mt-4 rounded-full"></div>
                  </div>
                </div>
            </div>
            
            <!-- Indicador visual e instrucciones para el usuario -->
            <div class="flex items-center justify-center gap-2 mt-4 text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">
                <span>Desliza horizontalmente para explorar los {{ eventoSeleccionado.ponentes.length }} expositores</span>
                <VIcon class="material-symbols-outlined animate-bounce-horizontal text-xs">trending_flat</VIcon>
            </div>
        </div>
        <div v-else-if="!eventoSeleccionado?.coordinadores?.length" class="text-center py-20 opacity-70">
           <VIcon class="material-symbols-outlined text-6xl text-slate-300 dark:text-gray-600 mb-4">groups</VIcon>
           <p class="text-lg font-black text-slate-400 uppercase tracking-widest">Ponentes por confirmar</p>
        </div>
      </div>
    </section>

    <!-- SECCIÓN DE UBICACIÓN -->
    <section v-if="eventoSeleccionado && eventoSeleccionado.secciones?.ubicacion !== false" id="ubicacion" class="py-24 bg-slate-50 dark:bg-gray-950 transition-colors duration-300 border-t border-slate-100 dark:border-gray-900 w-full">
       <div class="w-full px-6 md:px-16 lg:px-24 max-w-[2500px] mx-auto">
          <div class="flex flex-col md:flex-row items-center justify-between mb-16 gap-8 px-4">
             <div>
                <h2 class="text-4xl md:text-6xl font-black text-primary-dark dark:text-white uppercase italic tracking-tighter">Campus del Evento</h2>
                <p class="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
                   <VIcon class="material-symbols-outlined text-emerald-500">place</VIcon> {{ eventoSeleccionado?.direccion || 'Av. Villazón Nro 1995, Plaza del Bicentenario - La Paz' }}
                </p>
             </div>
             <div>
                <a :href="eventoSeleccionado?.google_maps_link && !eventoSeleccionado.google_maps_link.startsWith('<') ? eventoSeleccionado.google_maps_link : 'https://maps.app.goo.gl/4fuD4Dd8XWc493VV6'" target="_blank" class="px-6 py-3.5 bg-umsa-blue dark:bg-gray-900 hover:bg-primary-dark dark:hover:bg-gray-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 border border-transparent dark:border-gray-700 flex items-center gap-2">
                    Visualizar Ubicación <VIcon class="material-symbols-outlined text-[16px]">open_in_new</VIcon>
                </a>
             </div>
          </div>
          
          <VCard class="w-full bg-white dark:bg-gray-900 p-3 md:p-4 rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-slate-200 dark:border-gray-800 overflow-hidden relative group">
             <!-- Google Maps Embed o Url directa procesada -->
             <div v-if="eventoSeleccionado?.google_maps_link?.startsWith('<')" v-html="eventoSeleccionado?.google_maps_link" class="google-maps-container w-full min-h-[300px] md:h-[500px] rounded-[1.5rem] md:rounded-[2.5rem] filter md:grayscale-[80%] dark:invert text-sm contrast-125 group-hover:grayscale-0 group-hover:invert-0 group-hover:contrast-100 transition-all duration-1000"></div>
             
             <!-- Iframe fallback fallback -->
             <iframe v-else-if="eventoSeleccionado?.google_maps_link?.includes('google.com/maps/embed')"
               :src="eventoSeleccionado.google_maps_link" 
               width="100%" 
               height="500" 
               style="border:0;" 
               allowfullscreen
               loading="lazy" 
               referrerpolicy="no-referrer-when-downgrade"
               class="rounded-[1.5rem] md:rounded-[2.5rem] filter md:grayscale-[80%] dark:invert opacity-90 text-sm contrast-125 group-hover:grayscale-0 group-hover:invert-0 group-hover:contrast-100 transition-all duration-1000 w-full"
             ></iframe>

             <!-- Imagen ilustrativa en caso de URL directa (No iframe embebible) -->
             <div v-else-if="eventoSeleccionado?.google_maps_link" class="w-full h-[400px] md:h-[500px] bg-slate-100 dark:bg-gray-800 flex items-center justify-center rounded-[1.5rem] md:rounded-[2.5rem] relative overflow-hidden group/link cursor-pointer" @click="abrirMapa(eventoSeleccionado.google_maps_link)">
                 <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80" class="absolute inset-0 w-full h-full object-cover filter grayscale contrast-125 opacity-40 group-hover/link:opacity-80 group-hover/link:grayscale-0 transition-all duration-1000" />
                 <VCard class="relative z-10 flex flex-col items-center bg-white/90 dark:bg-black/80 backdrop-blur-md px-10 py-8 rounded-[2rem] shadow-2xl group-hover/link:scale-105 transition-transform duration-500">
                     <VIcon class="material-symbols-outlined text-6xl text-umsa-blue mb-4">map</VIcon>
                     <h3 class="text-2xl font-black text-primary-dark dark:text-white uppercase">Abrir en Google Maps</h3>
                     <p class="text-xs font-bold text-slate-500 dark:text-gray-400 mt-2 uppercase tracking-widest text-center max-w-[200px] truncate">{{ eventoSeleccionado.google_maps_link }}</p>
                     
                     <a :href="eventoSeleccionado.google_maps_link" target="_blank" class="mt-6 px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 block max-w-max" @click.stop>IR AL MAPA O SEDE <VIcon class="material-symbols-outlined text-[14px] align-middle ml-1">open_in_new</VIcon></a>
                 </VCard>
             </div>

             <!-- Fallback si NO hay link (Mapa UMSA por defecto) -->
             <div v-else class="google-maps-container w-full h-[500px] rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15301.761763784013!2d-68.1332029785816!3d-16.505086782352123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x915edf0a00000001%3A0x6420546944e8574d!2sUniversidad%20Mayor%20de%20San%20Andr%C3%A9s!5e0!3m2!1ses!2sbo!4v1713670000000!5m2!1ses!2sbo" width="100%" height="500" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" class="filter md:grayscale-[80%] dark:invert text-sm contrast-125 hover:grayscale-0 hover:invert-0 transition-all duration-700"></iframe>
             </div>

             <div class="absolute inset-0 pointer-events-none rounded-[2rem] md:rounded-[3rem] shadow-[inset_0_0_50px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"></div>
          </VCard>
       </div>
    </section>

  </main>
</template>

<style scoped>
html {
  scroll-behavior: smooth;
}

:deep(.google-maps-container iframe) {
  width: 100% !important;
  height: 100% !important;
  border-radius: 1.5rem;
}
@media (min-width: 768px) {
  :deep(.google-maps-container iframe) {
    border-radius: 2.5rem;
  }
}

.thin-scrollbar::-webkit-scrollbar {
  height: 6px;
}
.thin-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.thin-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.2);
  border-radius: 9999px;
}
.thin-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.4);
}

.animate-bounce-horizontal {
  animation: bounceHorizontal 1.5s infinite;
}

@keyframes bounceHorizontal {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(6px);
  }
}
</style>
