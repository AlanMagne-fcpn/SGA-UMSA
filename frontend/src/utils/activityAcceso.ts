/** Lugar físico / enlace de reunión según modalidad (solo para inscritos y roles internos). */

export type AccesoActividad = {
  aula_fisica: string;
  enlace_virtual: string;
};

export function accesoVacio(): AccesoActividad {
  return { aula_fisica: '', enlace_virtual: '' };
}

export function leerAcceso(requisitos: any): AccesoActividad {
  const raw = requisitos?.acceso || {};
  return {
    aula_fisica: String(raw.aula_fisica || '').trim(),
    enlace_virtual: String(raw.enlace_virtual || '').trim(),
  };
}

export function asegurarAcceso(requisitos: any) {
  const actual = requisitos || {};
  return {
    ...actual,
    acceso: {
      ...accesoVacio(),
      ...(actual.acceso || {}),
    },
  };
}

export function modalidadPideAula(modalidad?: string) {
  const m = String(modalidad || '').trim().toLowerCase();
  return m === 'presencial' || m === 'híbrido' || m === 'hibrido' || m === 'semipresencial';
}

export function modalidadPideEnlace(modalidad?: string) {
  const m = String(modalidad || '').trim().toLowerCase();
  return m === 'virtual' || m === 'híbrido' || m === 'hibrido' || m === 'semipresencial';
}

export function accesoTieneDatos(acceso: AccesoActividad, modalidad?: string) {
  const aula = modalidadPideAula(modalidad) && !!acceso.aula_fisica;
  const enlace = modalidadPideEnlace(modalidad) && !!acceso.enlace_virtual;
  return aula || enlace;
}
