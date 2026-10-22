import { expect, test, type Page } from '@playwright/test';

const requisitos = {
  base: { email: true, celular: false },
  custom: [{ label: 'Experiencia', type: 'select', options: ['Inicial', 'Avanzada'], id: 'original' }],
  presentacion: { objetivos: 'Objetivo original', publico_objetivo: 'Estudiantes', extra: 'conservar' },
  fields: [{ legacy: true }], extension: { conservar: true },
};
async function abrir(page: Page, config: any = requisitos) {
  await page.addInitScript(() => { localStorage.setItem('token', 'prueba'); localStorage.setItem('theme', 'dark'); });
  await page.route('http://localhost:3000/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('http://localhost:3000/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    id: 1, usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }],
  }) }));
  await page.route('http://localhost:3000/actividades-academicas/7', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    id: 7, nombre: 'Simposio de Biología', tipo: 'Simposio', estado: 1, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-03', horas: 40,
    requisitos: config, logistica_ids: [9], evento: { id: 3 },
    modalidades: [{ tipo: 'Presencial', min_nota: 51, min_asistencia: 80, sesiones: [] }],
  }) }));
  await page.goto('/admin/gestion-eventos/7?edit=true');
  await expect(page.getByRole('heading', { name: 'Editar actividad', exact: true })).toBeVisible({ timeout: 15000 });
}

test('editar requisitos sin código conserva metadatos y muestra campos legibles', async ({ page }) => {
  await abrir(page);
  const editor = page.locator('.activity-editor');
  await expect(editor).not.toContainText('JSON');
  await expect(editor.getByLabel('Tipo de Actividad', { exact: true })).toHaveValue('Simposio');
  await expect(editor.locator('.v-select')).toHaveCount(0);
  await expect(editor.getByLabel('Título de la Actividad')).toHaveCSS('color', 'rgb(241, 245, 249)');
  await editor.screenshot({ path: 'test-results/actividad-editor-oscuro.png', animations: 'disabled' });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await expect(editor.getByLabel('Título de la Actividad')).toHaveCSS('color', 'rgb(15, 23, 42)');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await editor.getByLabel('Correo electrónico').uncheck();
  await editor.getByLabel('Celular', { exact: true }).check();
  await editor.getByLabel('Objetivos de aprendizaje').fill('Objetivo actualizado');
  await editor.getByLabel('Opciones del requisito 1').fill('Inicial\nIntermedia\nAvanzada');
  const enviado = page.waitForRequest(req => req.method() === 'PUT' && req.url().endsWith('/actividades-academicas/7'));
  await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  const body = (await enviado).postData()!;
  const raw = body.match(/name="requisitos"\r?\n\r?\n([^\r\n]+)/)![1];
  expect(JSON.parse(raw)).toEqual({
    ...requisitos, base: { email: false, celular: true },
    custom: [{ ...requisitos.custom[0], options: ['Inicial', 'Intermedia', 'Avanzada'] }],
    presentacion: { ...requisitos.presentacion, objetivos: 'Objetivo actualizado' },
  });
});

test('descartar restaura requisitos y título; fechas y horarios inválidos no se guardan', async ({ page }) => {
  await abrir(page);
  const editor = page.locator('.activity-editor');
  await editor.getByLabel('Título de la Actividad').fill('Cambio descartado');
  await editor.getByLabel('Correo electrónico').uncheck();
  await editor.getByRole('button', { name: 'Descartar', exact: true }).click();
  await page.getByRole('button', { name: /Editar actividad/i }).click();
  await expect(editor.getByLabel('Título de la Actividad')).toHaveValue('Simposio de Biología');
  await expect(editor.getByLabel('Correo electrónico')).toBeChecked();
  await editor.getByLabel('Hora de inicio', { exact: true }).fill('22:00');
  await editor.getByRole('button', { name: /Agregar/i }).click();
  await expect(page.getByText('La hora de fin debe ser posterior a la de inicio.')).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await editor.getByLabel('Fecha Fin', { exact: true }).fill('2026-10-01');
  let enviados = 0;
  page.on('request', request => { if (request.method() === 'PUT') enviados++; });
  await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Completa el título, el tipo, las fechas en orden y una carga horaria mayor a cero.')).toBeVisible();
  expect(enviados).toBe(0);
});

test('una configuración antigua ilegible bloquea el guardado sin reemplazar requisitos', async ({ page }) => {
  await abrir(page, '{incorrecto');
  await expect(page.locator('.activity-editor').getByRole('alert')).toContainText('evitar perder esa configuración');
  await expect(page.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeDisabled();
});

test('el editor permite añadir requisitos y cabe en una pantalla móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrir(page);
  const editor = page.locator('.activity-editor');
  await editor.getByRole('button', { name: /Añadir requisito/i }).click();
  await editor.getByLabel('Nombre del requisito 2', { exact: true }).fill('Área de interés');
  await editor.getByLabel('Tipo de respuesta 2', { exact: true }).selectOption('text');
  expect(await editor.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await editor.getByRole('heading', { name: 'Editar actividad', exact: true }).scrollIntoViewIfNeeded();
  await editor.screenshot({ path: 'test-results/actividad-editor-movil.png', animations: 'disabled' });
});
