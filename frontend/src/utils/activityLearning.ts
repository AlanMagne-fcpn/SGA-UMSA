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
export type ItemEvaluacion = { clave: string; tipo: TipoItem; nombre: string; puntaje: number; plazo: string | null };
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

const TIPOS_FIJOS = ['diplomado', 'especialidad', 'taller', 'seminario', 'simposio', 'conferencia', 'curso'];

export function modoPorTipo(tipo: string): ModoEvaluacion {
  const normal = String(tipo || '').trim().toLowerCase();
  if (normal === 'curso') return 'curso';
  if (normal === 'otro') return 'configurable';
  return 'asistencia';
}

export function reglasConfigurables(tipo: string, requisitos?: any) {
  const normal = String(tipo || '').trim().toLowerCase();
  if (normal === 'otro') return true;
  if (TIPOS_FIJOS.includes(normal)) return false;
  return modoEvaluacion(tipo, requisitos) === 'configurable';
}

export function modoEvaluacion(tipo: string, requisitos: any): ModoEvaluacion {
  const explicito = modoExplicito(requisitos);
  if (explicito) return explicito;
  return modoPorTipo(tipo);
}

export function aulaInicial(modo: ModoEvaluacion) {
  if (modo === 'curso') return { video: false, material: true, practica: true, examen: true };
  if (modo === 'configurable') return { video: false, material: true, practica: false, examen: false };
  return { video: false, material: true, practica: false, examen: false };
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
  return {
    modo,
    asistencia: 20,
    bloques: { contenido: true, secciones: true, practica: true, laboratorio: false, examen: true },
    items: [
      { clave: 'parcial-1', tipo: 'examen', nombre: '1er parcial', puntaje: 25, plazo: null },
      { clave: 'parcial-2', tipo: 'examen', nombre: '2do parcial', puntaje: 25, plazo: null },
      { clave: 'practica-1', tipo: 'practica', nombre: 'Práctica 1', puntaje: 30, plazo: null },
    ],
  };
}

export function nuevaClaveItem() {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function redondearPct(valor: unknown) {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function sumaEsquema(esquema: { asistencia: number; items: { puntaje: number }[] }) {
  return redondearPct(Number(esquema.asistencia) + esquema.items.reduce((suma, item) => suma + Number(item.puntaje || 0), 0));
}

/** Guía clara cuando la ponderación no está en 100%: cuánto falta y qué campos llenar. */
export function mensajePonderacion(esquema: {
  asistencia: number;
  items: { puntaje: number; tipo?: string; nombre?: string }[];
}) {
  const total = sumaEsquema(esquema);
  const asistencia = redondearPct(esquema.asistencia);
  const sumaParciales = redondearPct(
    esquema.items
      .filter((item) => item.tipo === 'examen' || item.tipo === 'seccion')
      .reduce((suma, item) => suma + Number(item.puntaje || 0), 0),
  );
  const sumaPracticas = redondearPct(
    esquema.items
      .filter((item) => item.tipo === 'practica' || item.tipo === 'laboratorio')
      .reduce((suma, item) => suma + Number(item.puntaje || 0), 0),
  );
  const falta = redondearPct(100 - total);

  if (total === 100) {
    return {
      ok: true as const,
      falta: 0,
      texto: `Listo para guardar: Asistencia ${asistencia}% + Parciales ${sumaParciales}% + Prácticas ${sumaPracticas}% = 100%.`,
      corto: 'La ponderación suma 100%.',
    };
  }

  if (total > 100) {
    const sobra = redondearPct(total - 100);
    return {
      ok: false as const,
      falta: sobra,
      texto: `El total es ${total}% (sobran ${sobra}%). Baje un porcentaje en Asistencia, Parciales o Prácticas.`,
      corto: `Sobran ${sobra}%: reduzca otro campo.`,
    };
  }

  const vacios: string[] = [];
  if (asistencia <= 0) vacios.push('Asistencia');
  if (sumaParciales <= 0) vacios.push('Parciales (+ Parcial)');
  if (sumaPracticas <= 0) vacios.push('Prácticas (+ Práctica)');

  const sugerencia = vacios.length
    ? `Debe llenar o subir el % en: ${vacios.join(', ')}.`
    : 'Debe subir el % en otro campo (Asistencia, un parcial o una práctica) hasta completar el 100%.';

  return {
    ok: false as const,
    falta,
    texto: `Faltan ${falta}% para llegar a 100% (ahora ${total}%). ${sugerencia}`,
    corto: `Faltan ${falta}%: llene otro campo para completar el 100%.`,
  };
}

type ItemPeso = { clave: string; puntaje: number; tipo?: string };

/**
 * Fija un peso (asistencia o ítem). Si el total pasa de 100%, reduce otras secciones
 * (prioridad: prácticas → parciales → asistencia) para que nunca se pueda armar una nota > 100.
 */
export function aplicarPesoEsquema<T extends ItemPeso>(
  esquema: { asistencia: number; items: T[] },
  origen: 'asistencia' | string,
  valor: number,
): { asistencia: number; items: T[] } {
  const items = esquema.items.map((item) => ({ ...item, puntaje: redondearPct(item.puntaje) }));
  let asistencia = redondearPct(esquema.asistencia);
  const nuevo = Math.max(0, Math.min(100, redondearPct(valor)));

  if (origen === 'asistencia') asistencia = nuevo;
  else {
    const item = items.find((i) => i.clave === origen);
    if (!item) return { asistencia, items };
    item.puntaje = nuevo;
  }

  const total = () => redondearPct(asistencia + items.reduce((suma, item) => suma + Number(item.puntaje || 0), 0));
  let exceso = redondearPct(total() - 100);
  if (exceso <= 0) return { asistencia, items };

  const prioridad = (tipo?: string) => {
    if (tipo === 'practica' || tipo === 'laboratorio') return 0;
    if (tipo === 'examen' || tipo === 'seccion') return 1;
    return 2;
  };

  for (let pass = 0; pass < 10 && exceso > 0; pass++) {
    type Target = { get: () => number; set: (v: number) => void; prio: number };
    const targets: Target[] = [];
    if (origen !== 'asistencia' && asistencia > 0) {
      targets.push({ get: () => asistencia, set: (v) => { asistencia = v; }, prio: 2 });
    }
    for (const item of items) {
      if (item.clave === origen || Number(item.puntaje) <= 0) continue;
      targets.push({
        get: () => Number(item.puntaje),
        set: (v) => { item.puntaje = v as T['puntaje']; },
        prio: prioridad(item.tipo),
      });
    }

    if (!targets.length) {
      if (origen === 'asistencia') asistencia = redondearPct(Math.max(0, asistencia - exceso));
      else {
        const item = items.find((i) => i.clave === origen);
        if (item) item.puntaje = redondearPct(Math.max(0, Number(item.puntaje) - exceso)) as T['puntaje'];
      }
      break;
    }

    const minPrio = Math.min(...targets.map((t) => t.prio));
    const group = targets.filter((t) => t.prio === minPrio);
    const pool = group.reduce((suma, t) => suma + t.get(), 0);
    if (pool <= 0) continue;

    let leftover = exceso;
    for (const t of group) {
      const share = (t.get() / pool) * exceso;
      const cut = Math.min(t.get(), redondearPct(share));
      t.set(redondearPct(t.get() - cut));
      leftover = redondearPct(leftover - cut);
    }
    if (leftover > 0) {
      const biggest = [...group].sort((a, b) => b.get() - a.get())[0];
      const cut = Math.min(biggest.get(), leftover);
      biggest.set(redondearPct(biggest.get() - cut));
    }
    exceso = redondearPct(total() - 100);
  }

  exceso = redondearPct(total() - 100);
  if (exceso > 0) {
    if (origen === 'asistencia') asistencia = redondearPct(Math.max(0, asistencia - exceso));
    else {
      const item = items.find((i) => i.clave === origen);
      if (item) item.puntaje = redondearPct(Math.max(0, Number(item.puntaje) - exceso)) as T['puntaje'];
    }
  }

  // Compensa deriva de redondeo (±0.1) sin tocar el valor que el usuario acaba de fijar.
  const drift = redondearPct(100 - total());
  if (drift !== 0 && Math.abs(drift) <= 0.1) {
    const candidatos = items
      .filter((item) => item.clave !== origen)
      .map((item) => ({
        get: () => Number(item.puntaje),
        set: (v: number) => { item.puntaje = v as T['puntaje']; },
      }));
    if (origen !== 'asistencia') {
      candidatos.push({
        get: () => asistencia,
        set: (v: number) => { asistencia = v; },
      });
    }
    const ajustable = candidatos
      .filter((c) => (drift > 0 ? true : c.get() >= Math.abs(drift)))
      .sort((a, b) => b.get() - a.get())[0];
    if (ajustable) {
      ajustable.set(redondearPct(Math.max(0, Math.min(100, ajustable.get() + drift))));
    }
  }

  return { asistencia, items };
}

/** Mutación in-place para formularios reactivos (NotasRubricaGrid, etc.). */
export function fijarPesoEsquema(esquema: { asistencia: number; items: ItemPeso[] }, origen: 'asistencia' | string, valor: number) {
  const result = aplicarPesoEsquema(esquema, origen, valor);
  esquema.asistencia = result.asistencia;
  for (const updated of result.items) {
    const target = esquema.items.find((item) => item.clave === updated.clave);
    if (target) target.puntaje = updated.puntaje;
  }
  return esquema;
}

/** Texto orientativo para coordinador / superadmin según el tipo de actividad. */
export function guiaEvaluacion(tipo: string, requisitos?: any): {
  modo: ModoEvaluacion;
  titulo: string;
  resumen: string;
  comoSeCalifica: string[];
  certificados: string[];
  queConfiguras: string[];
  tipico: string;
} {
  const modo = modoEvaluacion(tipo, requisitos);
  const nombre = String(tipo || '').trim() || 'esta actividad';

  if (modo === 'curso') {
    return {
      modo,
      titulo: `Curso — nota ponderada`,
      resumen: `En un ${nombre} la nota final se arma con porcentajes que tú defines: asistencia, parciales y prácticas. Deben sumar exactamente 100%.`,
      comoSeCalifica: [
        'Asistencia: aporta el % que indiques según sesiones presentes / total de sesiones.',
        'Parciales: cada parcial tiene su propio %; el docente carga la nota (0–100) y el sistema la pondera.',
        'Prácticas: solo fijas el % de la nota; el docente publica las tareas en el aula (tipo Classroom) y califica entregas.',
        'Plantilla habitual UMSA: 20% asistencia + 25% + 25% parciales + 30% práctica.',
      ],
      certificados: [
        'Si la nota final ≥ nota mínima y cumple asistencia mínima → certificado de aprobación.',
        'Si asiste lo suficiente pero no alcanza la nota → certificado de participación.',
        'Si no cumple la asistencia mínima → no se emite certificado.',
      ],
      queConfiguras: [
        'Nota mínima y asistencia mínima (umbrales).',
        'Reparto de la nota (asistencia / parciales / prácticas).',
        'Si el docente puede publicar material y prácticas en el aula.',
      ],
      tipico: '20% asistencia · 25% 1er parcial · 25% 2do parcial · 30% práctica',
    };
  }

  if (modo === 'configurable') {
    return {
      modo,
      titulo: `${nombre} — reglas abiertas`,
      resumen: `Tipo personalizado: puedes decidir si califica solo por asistencia o con el mismo esquema ponderado que un curso.`,
      comoSeCalifica: [
        'Por defecto arranca al 100% asistencia (como taller o simposio).',
        'Si activas parciales o prácticas, reparte porcentajes hasta sumar 100%, igual que en un curso.',
        'El docente solo gestiona en el aula lo que habilites (material, prácticas, exámenes).',
      ],
      certificados: [
        'Mismos criterios: nota mínima + asistencia mínima definen aprobación vs participación.',
        'Sin evaluaciones activas, suele corresponder participación si cumple asistencia.',
      ],
      queConfiguras: [
        'Umbrales de nota y asistencia.',
        'Composición de la nota (si aplica).',
        'Permisos de contenido del aula.',
      ],
      tipico: '100% asistencia, o un esquema tipo curso si lo defines',
    };
  }

  return {
    modo,
    titulo: `${nombre} — calificación por asistencia`,
    resumen: `Diplomados, especialidades, talleres, seminarios, simposios y similares se evalúan por asistencia (la nota equivale al % de sesiones asistidas). No llevan parciales ni prácticas en la nota.`,
    comoSeCalifica: [
      'La nota final = porcentaje de asistencia (presentes / sesiones) × 100.',
      'No hay ponderación de exámenes ni prácticas en este tipo.',
      'El aula solo admite material de apoyo (PDF, documentos, enlaces). Sin videos ni evaluaciones.',
      'El personal de logística o el ponente registran la asistencia por sesión (PIN / lista).',
    ],
    certificados: [
      'Con asistencia ≥ mínima y nota (asistencia) ≥ nota mínima → aprobación.',
      'Con asistencia suficiente pero bajo la nota mínima → participación.',
      'Sin asistencia mínima → no hay certificado.',
    ],
    queConfiguras: [
      'Nota mínima y asistencia mínima (umbrales del certificado).',
      'Carga horaria y cupo.',
      'No se edita composición de nota: queda fija en 100% asistencia.',
    ],
    tipico: '100% asistencia · umbrales habituales nota 51 / asistencia 80%',
  };
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
    video: false,
    material: config ? config.material === true : true,
    practica: evaluable && practicaOn && (config ? config.practica === true : true),
    examen: evaluable && examenOn && (config ? config.examen === true : true),
    laboratorio: false,
  };
}
