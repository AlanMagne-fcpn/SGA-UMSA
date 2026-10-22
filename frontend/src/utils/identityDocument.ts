export const tiposDocumento = ['Carnet de Identidad', 'Pasaporte', 'Otro Documento Válido'];

export function separarDocumento(valor: string | null | undefined) {
  const texto = String(valor || '').trim();
  const separador = texto.indexOf(':');
  return separador > 0
    ? { tipo: texto.slice(0, separador).trim(), numero: texto.slice(separador + 1).trim() }
    : { tipo: '', numero: texto };
}

export function unirDocumento(tipo: string, numero: string) {
  const valor = String(numero || '').trim();
  return valor && tipo ? `${tipo.trim()}: ${valor}` : valor;
}
