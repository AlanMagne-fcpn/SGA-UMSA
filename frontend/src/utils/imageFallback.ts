export const SIN_IMAGEN =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#003B71"/>
          <stop offset="100%" stop-color="#0070BB"/>
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#g)"/>
      <g fill="none" stroke="#bae6fd" stroke-width="8" stroke-linejoin="round" opacity="0.85">
        <rect x="330" y="150" width="140" height="110" rx="12"/>
        <path d="M348 242 l36-40 28 30 18-18 22 28"/>
        <circle cx="378" cy="184" r="10" fill="#bae6fd" stroke="none"/>
      </g>
      <text x="400" y="310" text-anchor="middle" fill="#e0f2fe" font-family="Arial, sans-serif" font-size="22">Sin imagen</text>
    </svg>`,
  );

/** Portada legible para cursos sin foto o con un archivo demasiado pequeño. */
export const portadaCurso = (nombre: string): string => {
  const titulo = String(nombre || 'Curso académico').trim();
  const hash = [...titulo].reduce((valor, letra) => (valor * 31 + letra.charCodeAt(0)) >>> 0, 7);
  const acentos = ['#0070bb', '#059669', '#8055c8', '#c28d22', '#0e7490'];
  const acento = acentos[hash % acentos.length];
  const palabras = titulo.split(/\s+/);
  const lineas: string[] = [];
  let linea = '';
  for (const palabra of palabras) {
    if (`${linea} ${palabra}`.trim().length > 28 && linea) { lineas.push(linea); linea = palabra; }
    else linea = `${linea} ${palabra}`.trim();
  }
  if (linea) lineas.push(linea);
  const escapar = (texto: string) => texto.replace(/[&<>"']/g, letra => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[letra] || letra);
  const texto = lineas.slice(0, 3).map((parte, index) => `<text x="72" y="${320 + index * 93}" fill="white" font-family="Arial,sans-serif" font-size="72" font-weight="700">${escapar(parte)}</text>`).join('');
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#08243e"/><circle cx="1090" cy="90" r="320" fill="${acento}" opacity=".45"/><circle cx="1180" cy="650" r="420" fill="${acento}" opacity=".22"/><path d="M72 140h500" stroke="${acento}" stroke-width="12" stroke-linecap="round"/><text x="72" y="205" fill="#9eddfa" font-family="Arial,sans-serif" font-size="29" font-weight="700" letter-spacing="5">FORMACIÓN ACADÉMICA</text>${texto}<path d="M72 620h410" stroke="#9eddfa" stroke-width="3" opacity=".7"/><text x="72" y="665" fill="#c7d9e9" font-family="Arial,sans-serif" font-size="25">SGEA · UMSA</text></svg>`);
};

const PLACEHOLDER = SIN_IMAGEN;

window.addEventListener(
  'error',
  (event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (target.hasAttribute('data-event-logo')) return;
    if (target.dataset.fallbackApplied === '1') return;
    if (!target.getAttribute('src')) return;
    target.dataset.fallbackApplied = '1';
    target.src = target.hasAttribute('data-course-image') ? portadaCurso(target.alt) : target.dataset.fallbackSrc || PLACEHOLDER;
  },
  true,
);

window.addEventListener('load', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement) || !target.hasAttribute('data-course-image')) return;
  if (target.dataset.qualityApplied === '1' || target.src.startsWith('data:')) return;
  if (target.naturalWidth >= 800 && target.naturalHeight >= 450) return;
  target.dataset.qualityApplied = '1';
  target.src = portadaCurso(target.alt);
}, true);
