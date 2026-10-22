export type ContentType = 'video' | 'material' | 'practica' | 'examen';
export const esCurso = (tipo: string) => String(tipo || '').trim().toLowerCase() === 'curso';
export function permisosContenido(tipo: string, requisitos: any): Record<ContentType, boolean> {
  const config = requisitos?.aula;
  return {
    video: config ? config.video === true : true,
    material: config ? config.material === true : true,
    practica: esCurso(tipo) && (config ? config.practica === true : true),
    examen: esCurso(tipo) && (config ? config.examen === true : true),
  };
}
