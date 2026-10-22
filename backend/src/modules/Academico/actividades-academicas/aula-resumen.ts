export async function resumenAula(db: { query: Function }, actividadId: number, usuarioId: number) {
  const [row] = await db.query(`
    SELECT COUNT(*)::integer AS total,
      COUNT(p.id) FILTER (WHERE l.tipo <> 'practica' OR p.nota IS NOT NULL)::integer AS completadas,
      COUNT(p.id) FILTER (WHERE l.tipo = 'practica' AND p.nota IS NULL)::integer AS pendientes,
      COUNT(*) FILTER (WHERE (LOWER(TRIM(a.tipo)) = 'curso' AND (l.tipo = 'practica' OR jsonb_array_length(l.preguntas) > 0)) AND l.peso > 0)::integer AS evaluaciones,
      COUNT(p.id) FILTER (WHERE (LOWER(TRIM(a.tipo)) = 'curso' AND (l.tipo = 'practica' OR jsonb_array_length(l.preguntas) > 0)) AND l.peso > 0 AND p.nota IS NOT NULL)::integer AS evaluadas,
      ROUND(SUM(CASE WHEN LOWER(TRIM(a.tipo)) = 'curso' AND (l.tipo = 'practica' OR jsonb_array_length(l.preguntas) > 0) THEN COALESCE(p.nota,0)*l.peso ELSE 0 END)
        / NULLIF(SUM(CASE WHEN LOWER(TRIM(a.tipo)) = 'curso' AND (l.tipo = 'practica' OR jsonb_array_length(l.preguntas) > 0) THEN l.peso ELSE 0 END),0),2) AS promedio
    FROM curso_lecciones l JOIN actividades_academicas a ON a.id=l.id_actividad_academica LEFT JOIN curso_progreso p ON p.id_leccion=l.id AND p.id_usuario=$2
    WHERE l.id_actividad_academica=$1 AND l.publicado=true AND (LOWER(TRIM(a.tipo))='curso' OR l.tipo IN ('video','material'))`, [actividadId, usuarioId]);
  const total = Number(row?.total || 0);
  const completadas = Number(row?.completadas || 0);
  return {
    total, completadas, pendientes: Number(row?.pendientes || 0), evaluaciones: Number(row?.evaluaciones || 0), evaluadas: Number(row?.evaluadas || 0),
    promedio: row?.promedio == null ? null : Number(row.promedio),
    progreso: total ? Math.round(completadas * 10000 / total) / 100 : 0,
    terminado: total > 0 && total === completadas,
  };
}
