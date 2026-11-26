/** Públicos objetivo formales para actividades académicas. */
export const PUBLICOS_OBJETIVO = [
  { id: 'estudiantes-umsa', label: 'Estudiantes de la universidad (UMSA)' },
  { id: 'estudiantes-pregrado', label: 'Estudiantes de pregrado' },
  { id: 'estudiantes-posgrado', label: 'Estudiantes de posgrado' },
  { id: 'estudiantes-externos', label: 'Estudiantes externos de otras universidades' },
  { id: 'interesados', label: 'Personas interesadas en aprender / formación continua' },
  { id: 'publico-general', label: 'Público general interesado en la temática' },
  { id: 'docentes-pregrado', label: 'Docentes de pregrado' },
  { id: 'docentes-posgrado', label: 'Docentes de posgrado' },
  { id: 'docentes-institucion', label: 'Docentes de la institución' },
  { id: 'investigadores', label: 'Investigadores y académicos' },
  { id: 'profesionales', label: 'Profesionales del área' },
] as const;

/** Solo Super Usuario puede elegir este perfil (o un texto libre bajo “Otros”). */
export const PUBLICO_OBJETIVO_OTROS = 'Otros';

export type PublicoObjetivoId = (typeof PUBLICOS_OBJETIVO)[number]['id'];

const SEPARADOR = '; ';

export function labelsPublicoObjetivo(): string[] {
  return PUBLICOS_OBJETIVO.map((item) => item.label);
}

export function parsePublicoObjetivo(valor: unknown): string[] {
  const texto = String(valor || '').trim();
  if (!texto) return [];
  return texto
    .split(/\s*;\s*|\n+/)
    .map((parte) => parte.trim())
    .filter(Boolean);
}

export function serializarPublicoObjetivo(seleccion: string[]): string {
  return seleccion
    .map((item) => item.trim())
    .filter(Boolean)
    .join(SEPARADOR);
}

export function listarPublicoObjetivo(valor: unknown): string[] {
  const texto = String(valor || '').trim();
  if (!texto) return [];
  const parseados = parsePublicoObjetivo(texto);
  if (parseados.length) return parseados;
  return [texto];
}

export function esPublicoOtros(label: string): boolean {
  const texto = String(label || '').trim();
  return texto === PUBLICO_OBJETIVO_OTROS || /^otros(\s*:|$)/i.test(texto);
}
