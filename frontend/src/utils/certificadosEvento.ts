export const certificadosDeEvento = (certificados: any[], evento: any): any[] => {
  const idEvento = Number(evento?.id);
  if (!idEvento) return [];
  const actividades = new Set((evento.actividades || []).map((actividad: any) => Number(actividad.id)));
  return certificados.filter((certificado) => {
    const idActividad = Number(certificado.actividadAcademica?.id);
    return Number(certificado.infoCertificado?.evento?.id) === idEvento
      || Number(certificado.actividadAcademica?.evento?.id) === idEvento
      || (idActividad > 0 && actividades.has(idActividad));
  });
};
