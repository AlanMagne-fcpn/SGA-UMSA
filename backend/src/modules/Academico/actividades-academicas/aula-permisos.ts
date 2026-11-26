export type TipoContenido = 'video' | 'material' | 'practica' | 'examen' | 'laboratorio';
export type ModoEvaluacion = 'asistencia' | 'curso' | 'configurable';
export type TipoItem = 'seccion' | 'practica' | 'laboratorio' | 'examen';
export type BloquesEvaluacion = {
  contenido: boolean;
  secciones: boolean;
  practica: boolean;
  laboratorio: boolean;
  examen: boolean;
};
export type ItemEvaluacion = { clave: string; tipo: TipoItem; nombre: string; puntaje: number; plazo: string | null };
export type EsquemaEvaluacion = {
  modo: ModoEvaluacion;
  asistencia: number;
  bloques: BloquesEvaluacion;
  items: ItemEvaluacion[];
};

export const TIPOS_ASISTENCIA = ['seminario', 'taller', 'diplomado', 'especialidad', 'simposio', 'conferencia'];
export const SQL_PUEDE_EVALUAR = `(LOWER(TRIM(a.tipo)) = 'curso' OR COALESCE(a.requisitos #>> '{evaluacion,modo}', '') IN ('curso','configurable'))`;

export const esCurso = (tipo: string) => String(tipo || '').trim().toLowerCase() === 'curso';
export const esPresencial = (modalidad?: string) => String(modalidad || '').trim().toLowerCase() === 'presencial';

export function modoExplicito(requisitos: any): ModoEvaluacion | null {
  const modo = requisitos?.evaluacion?.modo;
  return modo === 'asistencia' || modo === 'curso' || modo === 'configurable' ? modo : null;
}

export function modoEvaluacion(tipo: string, requisitos: any): ModoEvaluacion {
  const explicito = modoExplicito(requisitos);
  if (explicito) return explicito;
  const normal = String(tipo || '').trim().toLowerCase();
  if (normal === 'curso') return 'curso';
  if (normal === 'otro') return 'configurable';
  return 'asistencia';
}

export function permiteEvaluacion(tipo: string, requisitos: any): boolean {
  const modo = modoExplicito(requisitos);
  if (modo === 'asistencia') return false;
  if (modo === 'curso' || modo === 'configurable') return true;
  return esCurso(tipo);
}

export function exigeTiempoExamen(requisitos: any): boolean {
  const modo = modoExplicito(requisitos);
  return modo === 'curso' || modo === 'configurable';
}

export function puntosAsistencia(sesiones: number, presentes: number, puntaje: number): number {
  const cupo = Number(puntaje);
  if (!Number.isFinite(cupo) || cupo <= 0) return 0;
  const total = Math.max(0, Number(sesiones) || 0);
  const marcas = Math.max(0, Number(presentes) || 0);
  if (total <= 1) return marcas > 0 ? cupo : 0;
  return Math.round(Math.min(cupo, cupo * marcas / total) * 100) / 100;
}

const bloquesVacios = (contenido: boolean): BloquesEvaluacion => ({
  contenido, secciones: false, practica: false, laboratorio: false, examen: false,
});

export function esquemaEvaluacion(tipo: string, requisitos: any): EsquemaEvaluacion {
  const modo = modoEvaluacion(tipo, requisitos);
  const guardado = requisitos?.evaluacion || {};
  if (modo === 'asistencia') {
    return { modo, asistencia: 100, bloques: bloquesVacios(true), items: [] };
  }
  const bloquesGuardados = guardado.bloques || {};
  const bloques: BloquesEvaluacion = modo === 'configurable'
    ? {
      contenido: bloquesGuardados.contenido !== false,
      secciones: bloquesGuardados.secciones === true,
      practica: bloquesGuardados.practica === true,
      laboratorio: bloquesGuardados.laboratorio === true,
      examen: bloquesGuardados.examen === true,
    }
    : {
      contenido: bloquesGuardados.contenido !== false,
      secciones: bloquesGuardados.secciones !== false,
      practica: bloquesGuardados.practica !== false,
      laboratorio: bloquesGuardados.laboratorio !== false,
      examen: bloquesGuardados.examen !== false,
    };
  const asistencia = Number(guardado.asistencia ?? 100);
  const items = (Array.isArray(guardado.items) ? guardado.items : []).map((item: any, index: number) => ({
    clave: String(item?.clave || `item-${index + 1}`).trim().slice(0, 40) || `item-${index + 1}`,
    tipo: item?.tipo,
    nombre: String(item?.nombre || '').trim(),
    puntaje: Number(item?.puntaje),
    plazo: item?.plazo ? String(item.plazo).slice(0, 10) : null,
  }));
  return { modo, asistencia, bloques, items };
}

export function validarEsquema(esquema: EsquemaEvaluacion): string | null {
  if (esquema.modo === 'asistencia') {
    if (esquema.items.length || esquema.bloques.secciones || esquema.bloques.practica || esquema.bloques.laboratorio || esquema.bloques.examen) {
      return 'Este tipo de actividad solo califica asistencia.';
    }
    return null;
  }
  if (!Number.isFinite(esquema.asistencia) || esquema.asistencia < 0 || esquema.asistencia > 100) {
    return 'La asistencia debe tener un puntaje entre 0 y 100.';
  }
  let suma = esquema.asistencia;
  for (const item of esquema.items) {
    if (!['seccion', 'practica', 'laboratorio', 'examen'].includes(item.tipo)) return 'Tipo de ítem de calificación no válido.';
    if (!item.nombre) return 'Cada ítem de calificación necesita un nombre.';
    if (!Number.isFinite(item.puntaje) || item.puntaje <= 0 || item.puntaje > 100) return 'Cada ítem de calificación necesita un puntaje entre 1 y 100.';
    const bloque = item.tipo === 'seccion' ? 'secciones' : item.tipo;
    if (!esquema.bloques[bloque]) return 'Hay un ítem de un bloque que no está habilitado.';
    suma += item.puntaje;
  }
  if (Math.abs(suma - 100) > 0.01) return 'Los puntajes, incluida la asistencia, deben sumar 100.';
  return null;
}

export function permisosContenido(tipo: string, requisitos: any, modalidad?: string): Record<TipoContenido, boolean> {
  const config = requisitos?.aula;
  const modo = modoEvaluacion(tipo, requisitos);
  const presencial = modo === 'curso' && esPresencial(modalidad);
  const evaluable = permiteEvaluacion(tipo, requisitos) && !presencial;
  const bloques = requisitos?.evaluacion?.bloques;
  const practicaOn = bloques ? bloques.practica === true : true;
  const examenOn = bloques ? bloques.examen === true || bloques.secciones === true : true;
  return {
    video: false,
    material: config ? config.material === true : true,
    practica: evaluable && practicaOn && (config ? config.practica === true : true),
    examen: evaluable && examenOn && (config ? config.examen === true : true),
    laboratorio: false,
  };
}
