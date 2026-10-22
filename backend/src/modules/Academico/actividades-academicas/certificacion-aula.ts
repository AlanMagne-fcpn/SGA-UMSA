import { BadRequestException } from '@nestjs/common';
import { resumenAula } from './aula-resumen';

export async function requisitosCertificadoAula(db: { query: Function }, actividadId: number, usuarioId: number, modalidad: any) {
  const resumen = await resumenAula(db, actividadId, usuarioId);
  if (!resumen.total) return null;
  if (resumen.pendientes || resumen.evaluadas < resumen.evaluaciones) throw new BadRequestException('Hay evaluaciones sin terminar o prácticas pendientes de calificación.');
  return {
    // Sin evaluaciones, el aula solo acredita participación.
    nota: resumen.evaluaciones ? resumen.promedio ?? 0 : null,
    asistenciaVirtual: /^virtual$/i.test(modalidad?.tipo || '') ? resumen.progreso >= Number(modalidad?.min_asistencia ?? 0) : null,
  };
}
