export type ContentType = 'video' | 'material' | 'practica' | 'examen' | 'laboratorio';
export type ModoEvaluacion = 'asistencia' | 'curso' | 'configurable';
export type TipoItem = 'seccion' | 'practica' | 'laboratorio' | 'examen';
export type BloquesEvaluacion = {
  contenido: boolean;
  secciones: boolean;
  practica: boolean;
  laboratorio: boolean;
  examen: boolean;
};
export type ItemEvaluacion = { tipo: TipoItem; nombre: string; puntaje: number; plazo: string | null };
export type EsquemaEvaluacion = {
  modo: ModoEvaluacion;
  asistencia: number;
  bloques: BloquesEvaluacion;
  items: ItemEvaluacion[];
};

export const esCurso = (tipo: string) => String(tipo || '').trim().toLowerCase() === 'curso';
export const esPresencial = (modalidad?: string) => String(modalidad || '').trim().toLowerCase() === 'presencial';

export function modoExplicito(requisitos: any): ModoEvaluacion | null {
  const modo = requisitos?.evaluacion?.modo;
  return modo === 'asistencia' || modo === 'curso' || modo === 'configurable' ? modo : null;
}

export function modoPorTipo(tipo: string): ModoEvaluacion {
  const normal = String(tipo || '').trim().toLowerCase();
  if (normal === 'curso') return 'curso';
  if (normal === 'otro') return 'configurable';
  return 'asistencia';
}

export function modoEvaluacion(tipo: string, requisitos: any): ModoEvaluacion {
  const explicito = modoExplicito(requisitos);
  if (explicito) return explicito;
  return modoPorTipo(tipo);
}

export function aulaInicial(modo: ModoEvaluacion) {
  if (modo === 'curso') return { video: true, material: true, practica: true, examen: true };
  return { video: true, material: true, practica: false, examen: false };
}

export function permiteEvaluacion(tipo: string, requisitos: any): boolean {
  const modo = modoExplicito(requisitos);
  if (modo === 'asistencia') return false;
  if (modo === 'curso' || modo === 'configurable') return true;
  return esCurso(tipo);
}

export function esquemaInicial(modo: ModoEvaluacion): EsquemaEvaluacion {
  if (modo === 'asistencia') {
    return { modo, asistencia: 100, bloques: { contenido: true, secciones: false, practica: false, laboratorio: false, examen: false }, items: [] };
  }
  if (modo === 'configurable') {
    return { modo, asistencia: 100, bloques: { contenido: true, secciones: false, practica: false, laboratorio: false, examen: false }, items: [] };
  }
  return { modo, asistencia: 100, bloques: { contenido: true, secciones: true, practica: true, laboratorio: true, examen: true }, items: [] };
}

export function sumaEsquema(esquema: { asistencia: number; items: { puntaje: number }[] }) {
  return Math.round((Number(esquema.asistencia) + esquema.items.reduce((suma, item) => suma + Number(item.puntaje || 0), 0)) * 100) / 100;
}

export function permisosContenido(tipo: string, requisitos: any, modalidad?: string): Record<ContentType, boolean> {
  const config = requisitos?.aula;
  const modo = modoEvaluacion(tipo, requisitos);
  const presencial = modo === 'curso' && esPresencial(modalidad);
  const evaluable = permiteEvaluacion(tipo, requisitos) && !presencial;
  const bloques = requisitos?.evaluacion?.bloques;
  const practicaOn = bloques ? bloques.practica === true : true;
  const examenOn = bloques ? bloques.examen === true || bloques.secciones === true : true;
  return {
    video: !presencial && (config ? config.video === true : true),
    material: config ? config.material === true : true,
    practica: evaluable && practicaOn && (config ? config.practica === true : true),
    examen: evaluable && examenOn && (config ? config.examen === true : true),
    laboratorio: evaluable && bloques?.laboratorio === true,
  };
}
