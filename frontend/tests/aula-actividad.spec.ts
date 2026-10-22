import { expect, test, type Page } from '@playwright/test';

async function auth(page: Page, estudiante = false) {
  await page.addInitScript(() => { localStorage.setItem('token', 'prueba'); localStorage.setItem('theme', 'dark'); });
  await page.route('http://localhost:3000/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('http://localhost:3000/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    id: 9, email: 'aula@example.test', usuariosRoles: [{ rol: { id: estudiante ? 1 : 6, nombre_rol: estudiante ? 'Estudiante' : 'Super Usuario' } }],
  }) }));
  await page.route('http://localhost:3000/actividades-academicas/*/aula/configuracion', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tipo_actividad: 'Curso', permisos: { video: true, material: true, practica: true, examen: true } }) }));
}
const contenido = [
  { id: 1, tipo: 'material', titulo: 'Lectura inicial', descripcion: 'Lee el documento', orden: 1, preguntas: [], peso: 0, publicado: true, recursos: [{ nombre: 'Guía.pdf', url: '/uploads/materiales/guia.pdf' }] },
  { id: 2, tipo: 'practica', titulo: 'Trabajo de laboratorio', descripcion: 'Presenta tus conclusiones', orden: 2, preguntas: [], peso: 30, publicado: true },
  { id: 3, tipo: 'examen', titulo: 'Examen final', descripcion: '', orden: 3, preguntas: [{ enunciado: '¿Cuál es correcta?', opciones: ['A','B'] }], peso: 70, publicado: true },
];

test('la creación conserva bordes y un solo selector en ambos temas', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/admin/eventos/lista?limit=100', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 3, nombre: 'Congreso', estado: 1, actividades: [] }]) }));
  await page.goto('/admin/gestion-eventos?newAct=true&eventoId=3');
  const wizard = page.locator('.activity-creation').first();
  await expect(wizard.getByRole('heading', { name: /Diseño de la Actividad/i })).toBeVisible();
  await expect(wizard.getByLabel('Tipo de Actividad', { exact: true })).toHaveValue('Diplomado');
  await expect(wizard.locator('.v-select')).toHaveCount(0);
  const nombre = wizard.getByPlaceholder('Ej: Especialidad en Microbiología...');
  expect(await nombre.evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth))).toBeGreaterThan(0);
  await expect(nombre).toHaveCSS('color', 'rgb(241, 245, 249)');
  await nombre.fill('Curso con aula');
  await page.getByRole('button', { name: 'light_mode', exact: true }).click();
  await expect(nombre).toHaveCSS('color', 'rgb(15, 23, 42)');
  await expect(nombre).toHaveValue('Curso con aula');
  await wizard.screenshot({ path: 'test-results/actividad-creacion.png', animations: 'disabled' });
});

test('el docente publica una práctica con archivo y peso y califica una entrega', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/actividades-academicas/7/lecciones/editor', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(contenido) }));
  await page.route('http://localhost:3000/actividades-academicas/7/entregas', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 5, titulo: 'Laboratorio', estudiante: 'Ana Pérez', nota: null, entrega: { texto: 'Mi informe' } }]) }));
  await page.route('http://localhost:3000/actividades-academicas/7/materiales/upload', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ path: '/uploads/materiales/documento.pdf' }) }));
  await page.goto('/admin/cursos/7/aula');
  await page.getByLabel('Tipo de contenido', { exact: true }).selectOption('practica');
  await page.getByLabel('Título del contenido', { exact: true }).fill('Nueva práctica');
  await page.getByLabel('Peso de esta evaluación', { exact: true }).fill('30');
  await page.getByLabel('Archivos de estudio o instrucciones', { exact: false }).setInputFiles({ name: 'Trabajo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.getByLabel('Publicar contenido', { exact: true }).check();
  const post = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/7/lecciones'));
  await page.getByRole('button', { name: 'Guardar contenido', exact: true }).click();
  expect((await post).postDataJSON()).toMatchObject({ tipo: 'practica', peso: 30, recursos: [{ nombre: 'Trabajo.pdf', url: '/uploads/materiales/documento.pdf' }], publicado: true, preguntas: [] });
  await page.getByLabel('Nota (0 a 100)', { exact: true }).fill('90');
  await page.getByLabel('Devolución al estudiante', { exact: true }).fill('Buen trabajo');
  const nota = page.waitForRequest(req => req.method() === 'PUT' && req.url().endsWith('/entregas/5/nota'));
  await page.getByRole('button', { name: 'Guardar calificación', exact: true }).click();
  expect((await nota).postDataJSON()).toEqual({ nota: 90, retroalimentacion: 'Buen trabajo' });
  await page.locator('.aula').screenshot({ path: 'test-results/aula-docente.png', animations: 'disabled' });
});

test('el estudiante descarga materiales, entrega su práctica y responde el examen', async ({ page }) => {
  await auth(page, true);
  await page.route('http://localhost:3000/actividades-academicas/7/aula', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(contenido) }));
  await page.route('http://localhost:3000/actividades-academicas/7/aula/resumen', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ promedio: 24, evaluadas: 1, evaluaciones: 2, progreso: 33.33, pendientes: 0 }) }));
  await page.goto('/estudiante/actividades/7/aula');
  await expect(page.getByRole('link', { name: 'Descargar Guía.pdf' })).toHaveAttribute('href', 'http://localhost:3000/uploads/materiales/guia.pdf');
  await expect(page.getByRole('region', { name: 'Mi calificación' })).toContainText('24/100');
  await page.getByRole('button', { name: /Trabajo de laboratorio/ }).click();
  await page.getByLabel('Respuesta o comentario', { exact: true }).fill('Mis conclusiones');
  await page.getByLabel('Adjuntar trabajo', { exact: false }).setInputFiles({ name: 'Informe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  const envio = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/lecciones/2/entrega'));
  await page.getByRole('button', { name: 'Enviar práctica', exact: true }).click();
  const body = (await envio).postData()!;
  expect(body).toContain('Mis conclusiones'); expect(body).toContain('Informe.pdf');
  await page.getByRole('button', { name: /Examen final/ }).click();
  await expect(page.getByRole('button', { name: 'Enviar respuestas', exact: true })).toBeDisabled();
  await page.getByLabel('B', { exact: true }).check();
  const respuestas = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/lecciones/3/completar'));
  await page.getByRole('button', { name: 'Enviar respuestas', exact: true }).click();
  expect((await respuestas).postDataJSON()).toEqual({ respuestas: [1] });
});
