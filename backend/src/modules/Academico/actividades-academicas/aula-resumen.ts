import { puntosAsistencia } from './aula-permisos';

const MODOS = new Set(['asistencia', 'curso', 'configurable']);

export async function resumenAula(db: { query: Function }, actividadId: number, usuarioId: number) {
  const [row] = await db.query(`
    SELECT COUNT(l.id)::integer AS total,
      COUNT(p.id) FILTER (WHERE l.id IS NOT NULL AND (l.tipo <> 'practica' OR p.nota IS NOT NULL))::integer AS completadas,
      COUNT(p.id) FILTER (WHERE l.tipo IN ('practica','laboratorio') AND p.nota IS NULL)::integer AS pendientes,
      COUNT(l.id) FILTER (WHERE (LOWER(TRIM(a.tipo)) = 'curso' OR COALESCE(a.requisitos #>> '{evaluacion,modo}', '') IN ('curso','configurable')) AND (l.tipo IN ('practica','laboratorio','examen') OR jsonb_array_length(COALESCE(l.preguntas, '[]'::jsonb)) > 0) AND l.peso > 0)::integer AS evaluaciones,
      COUNT(p.id) FILTER (WHERE (LOWER(TRIM(a.tipo)) = 'curso' OR COALESCE(a.requisitos #>> '{evaluacion,modo}', '') IN ('curso','configurable')) AND (l.tipo IN ('practica','laboratorio','examen') OR jsonb_array_length(COALESCE(l.preguntas, '[]'::jsonb)) > 0) AND l.peso > 0 AND p.nota IS NOT NULL)::integer AS evaluadas,
      ROUND(SUM(CASE WHEN LOWER(TRIM(a.tipo)) = 'curso' AND COALESCE(a.requisitos #>> '{evaluacion,modo}', '') = '' AND (l.tipo = 'practica' OR jsonb_array_length(COALESCE(l.preguntas, '[]'::jsonb)) > 0) THEN COALESCE(p.nota,0)*l.peso ELSE 0 END)
        / NULLIF(SUM(CASE WHEN LOWER(TRIM(a.tipo)) = 'curso' AND COALESCE(a.requisitos #>> '{evaluacion,modo}', '') = '' AND (l.tipo = 'practica' OR jsonb_array_length(COALESCE(l.preguntas, '[]'::jsonb)) > 0) THEN l.peso ELSE 0 END),0),2) AS promedio,
      COALESCE(MAX(a.requisitos #>> '{evaluacion,modo}'), '') AS modo,
      COALESCE(MAX(NULLIF(a.requisitos #>> '{evaluacion,asistencia}', '')::numeric), 0) AS puntaje_asistencia,
      COALESCE(MAX(ses.sesiones), 0)::integer AS sesiones,
      COALESCE(MAX(asi.presentes), 0)::integer AS presentes,
      ROUND(COALESCE(SUM(CASE WHEN COALESCE(a.requisitos #>> '{evaluacion,modo}', '') IN ('curso','configurable') AND (l.tipo IN ('practica','laboratorio','examen') OR jsonb_array_length(COALESCE(l.preguntas, '[]'::jsonb)) > 0) THEN COALESCE(p.nota,0)*l.peso/100.0 ELSE 0 END), 0), 2) AS puntos_lecciones
    FROM curso_lecciones l
    JOIN actividades_academicas a ON a.id=l.id_actividad_academica
    LEFT JOIN curso_progreso p ON p.id_leccion=l.id AND p.id_usuario=$2
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS sesiones FROM sesiones_academicas s
      JOIN curso_modalidades m ON m.id=s.id_curso_modalidad
      WHERE m.id_actividad_academica=a.id
    ) ses ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS presentes FROM asistencias asis
      JOIN inscripcion_modalidades im ON im.id=asis.id_inscripcion_modalidad
      JOIN inscripciones i ON i.id=im.id_inscripcion
      WHERE i.id_actividad_academica=a.id AND i.id_usuario=$2 AND asis.estado=1
    ) asi ON true
    WHERE l.id_actividad_academica=$1 AND l.publicado=true
      AND (LOWER(TRIM(a.tipo))='curso' OR COALESCE(a.requisitos #>> '{evaluacion,modo}', '') IN ('curso','configurable') OR l.tipo IN ('video','material'))`, [actividadId, usuarioId]);
  if (!row) return resumenVacio(await asistenciaSinLecciones(db, actividadId, usuarioId));
  return armar(row);
}

async function asistenciaSinLecciones(db: { query: Function }, actividadId: number, usuarioId: number) {
  const [row] = await db.query(`
    SELECT COALESCE(a.requisitos #>> '{evaluacion,modo}', '') AS modo,
      COALESCE(NULLIF(a.requisitos #>> '{evaluacion,asistencia}', '')::numeric, 0) AS puntaje_asistencia,
      (SELECT COUNT(*)::integer FROM sesiones_academicas s JOIN curso_modalidades m ON m.id=s.id_curso_modalidad WHERE m.id_actividad_academica=a.id) AS sesiones,
      (SELECT COUNT(*)::integer FROM asistencias asis JOIN inscripcion_modalidades im ON im.id=asis.id_inscripcion_modalidad JOIN inscripciones i ON i.id=im.id_inscripcion WHERE i.id_actividad_academica=a.id AND i.id_usuario=$2 AND asis.estado=1) AS presentes
    FROM actividades_academicas a WHERE a.id=$1`, [actividadId, usuarioId]);
  return row || { modo: '', puntaje_asistencia: 0, sesiones: 0, presentes: 0, total: 0, completadas: 0, pendientes: 0, evaluaciones: 0, evaluadas: 0, promedio: null, puntos_lecciones: 0 };
}

function resumenVacio(row: any) {
  return armar({ total: 0, completadas: 0, pendientes: 0, evaluaciones: 0, evaluadas: 0, promedio: null, puntos_lecciones: 0, ...row });
}

function armar(row: any) {
  const total = Number(row?.total || 0);
  const completadas = Number(row?.completadas || 0);
  const modo = String(row?.modo || '');
  const esquema = MODOS.has(modo);
  let promedio = row?.promedio == null ? null : Number(row.promedio);
  let evaluaciones = Number(row?.evaluaciones || 0);
  let evaluadas = Number(row?.evaluadas || 0);
  let asistencia = 0;
  if (esquema) {
    const puntaje = modo === 'asistencia' ? 100 : Number(row?.puntaje_asistencia || 0);
    asistencia = puntosAsistencia(Number(row?.sesiones || 0), Number(row?.presentes || 0), puntaje);
    const lecciones = modo === 'asistencia' ? 0 : Number(row?.puntos_lecciones || 0);
    promedio = Math.round((lecciones + asistencia) * 100) / 100;
    if (modo === 'asistencia') { evaluaciones = 0; evaluadas = 0; }
  }
  return {
    total, completadas, pendientes: Number(row?.pendientes || 0), evaluaciones, evaluadas,
    promedio, asistencia, esquema,
    progreso: total ? Math.round(completadas * 10000 / total) / 100 : 0,
    terminado: total > 0 && total === completadas,
  };
}
