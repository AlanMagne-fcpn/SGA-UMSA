type ConNombre = { id?: number | null; nombre?: string | null; title?: string | null }

export function slugPublico(texto: string) {
  const slug = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'item'
}

export function idDeEnlace(valor: unknown) {
  const coincidencia = String(valor ?? '').match(/(\d+)$/)
  return coincidencia ? Number(coincidencia[1]) : NaN
}

export function enlaceEvento(evento: ConNombre) {
  const id = Number(evento.id)
  return `/eventos/${slugPublico(evento.nombre || evento.title || 'evento')}-${id}`
}

export function enlaceCurso(curso: ConNombre) {
  const id = Number(curso.id)
  return `/cursos/${slugPublico(curso.nombre || curso.title || 'curso')}-${id}`
}
