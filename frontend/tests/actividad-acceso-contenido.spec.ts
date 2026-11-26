import { expect, test, type Page } from '@playwright/test';

async function auth(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('token', 'prueba'); localStorage.setItem('theme', 'dark'); });
  await page.route('http://localhost:3000/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('http://localhost:3000/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 9, usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }) }));
}

async function irAAprobacion(page: Page) {
  await page.getByText('Aprobación', { exact: true }).click();
}

test('crear una actividad configura permisos sin subir contenido y solo Curso ofrece evaluaciones', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/admin/eventos/lista?limit=100', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 3, nombre: 'Congreso', estado: 1, actividades: [] }]) }));
  await page.route('http://localhost:3000/actividades-academicas', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 27 }) }));
  await page.goto('/admin/gestion-eventos?newAct=true&eventoId=3');
  const wizardDiseno = page.locator('.activity-creation').first();
  await wizardDiseno.getByLabel('Tipo de Actividad', { exact: true }).selectOption('Curso');
  await wizardDiseno.getByPlaceholder('Ej: Especialidad en Microbiología...').fill('Curso configurable');
  await irAAprobacion(page);
  const permisos = page.locator('.activity-creation').filter({ has: page.getByRole('region', { name: 'Contenido del docente' }) }).getByRole('region', { name: 'Contenido del docente' });
  await expect(permisos.getByRole('checkbox', { name: 'Prácticas', exact: true })).toBeVisible();
  await expect(permisos.getByRole('checkbox', { name: 'Permitir archivos', exact: true })).toBeVisible();
  await expect(permisos.getByRole('checkbox', { name: 'Permitir videos', exact: true })).toHaveCount(0);
  await expect(permisos).toContainText('Composición de la nota');
  await expect(permisos).toContainText('1er parcial');
  await expect(permisos.locator('input[type=file]')).toHaveCount(0);
  await page.getByLabel('Carga horaria de la actividad', { exact: true }).fill('40');
  await page.getByText('Horarios', { exact: true }).click();
  await page.getByLabel('Fecha de inicio de la actividad', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Fecha de fin de la actividad', { exact: true }).fill('2026-11-03');
  await page.getByText('Resumen', { exact: true }).click();
  const enviado = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/actividades-academicas'));
  await page.getByRole('button', { name: /Publicar Actividad/i }).click();
  const raw = (await enviado).postData()!.match(/name="requisitos"\r?\n\r?\n([^\r\n]+)/)![1];
  const requisitos = JSON.parse(raw);
  expect(requisitos.aula).toEqual({ video: false, material: true, practica: true, examen: true });
  expect(requisitos.evaluacion.asistencia).toBe(20);
  expect(requisitos.evaluacion.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ nombre: '1er parcial', puntaje: 25 }),
    expect.objectContaining({ nombre: '2do parcial', puntaje: 25 }),
    expect.objectContaining({ nombre: 'Práctica 1', puntaje: 30 }),
  ]));
});

test('editar un simposio solo permite archivos y conserva sus requisitos', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/actividades-academicas/7', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    id: 7, nombre: 'Simposio', tipo: 'Simposio', estado: 1, horas: 4, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-01', evento: { id: 3 }, modalidades: [{ tipo: 'Presencial' }],
    requisitos: { base: { email: true }, custom: [], extension: 'conservar', aula: { video: false, material: true, practica: true, examen: true } },
  }) }));
  await page.goto('/admin/gestion-eventos/7?edit=true');
  const editor = page.locator('.activity-editor');
  const permisos = editor.getByRole('region', { name: 'Contenido del docente' });
  await expect(permisos).toBeVisible({ timeout: 15000 });
  await expect(permisos.getByRole('checkbox')).toHaveCount(0);
  await expect(permisos).toContainText('Sin videos');
  await expect(permisos.getByRole('checkbox', { name: 'Permitir videos', exact: true })).toHaveCount(0);
  await permisos.screenshot({ path: 'test-results/permisos-contenido-simposio.png', animations: 'disabled' });
  const enviado = page.waitForRequest(req => req.method() === 'PUT' && req.url().endsWith('/actividades-academicas/7'));
  await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  const raw = (await enviado).postData()!.match(/name="requisitos"\r?\n\r?\n([^\r\n]+)/)![1];
  expect(JSON.parse(raw)).toMatchObject({ extension: 'conservar', base: { email: true }, aula: { video: false, material: true, practica: false, examen: false } });
});

test('otro y curso muestran prácticas, archivos y sección de notas sin videos', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/admin/eventos/lista?limit=100', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 3, nombre: 'Congreso', estado: 1, actividades: [] }]) }));
  await page.goto('/admin/gestion-eventos?newAct=true&eventoId=3');
  const diseno = page.locator('.activity-creation').first();
  await diseno.getByLabel('Tipo de Actividad', { exact: true }).selectOption('Otro');
  await irAAprobacion(page);
  const permisos = page.getByRole('region', { name: 'Contenido del docente' });
  await expect(permisos.getByRole('checkbox', { name: 'Prácticas', exact: true })).toBeVisible();
  await expect(permisos.getByRole('checkbox', { name: 'Permitir archivos', exact: true })).toBeVisible();
  await expect(permisos.getByRole('checkbox', { name: 'Secciones con nota', exact: true })).toHaveCount(0);
  await expect(permisos.getByRole('checkbox', { name: 'Permitir videos', exact: true })).toHaveCount(0);
  await expect(permisos).toContainText('Composición de la nota');
  await page.getByText('Diseño', { exact: true }).click();
  await page.locator('.activity-creation').first().getByLabel('Tipo de Actividad', { exact: true }).selectOption('Simposio');
  await irAAprobacion(page);
  await expect(permisos).toContainText('100% asistencia');
  await expect(permisos.getByRole('checkbox')).toHaveCount(0);
  await page.getByText('Diseño', { exact: true }).click();
  await page.locator('.activity-creation').first().getByLabel('Tipo de Actividad', { exact: true }).selectOption('Curso');
  await irAAprobacion(page);
  await expect(permisos.getByRole('checkbox', { name: 'Prácticas', exact: true })).toBeVisible();
  await expect(permisos.getByRole('checkbox', { name: 'Permitir archivos', exact: true })).toBeVisible();
  await expect(permisos).toContainText('Composición de la nota');
  await expect(permisos).toContainText('Esquema completo');
});

test('el panel del ponente no ofrece videos y respeta archivos', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/actividades-academicas/7/aula/configuracion', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tipo_actividad: 'Simposio', permisos: { video: false, material: true, practica: false, examen: false } }) }));
  await page.goto('/ponente/curso/7/aula');
  const selector = page.getByLabel('Tipo de contenido', { exact: true });
  await expect(selector.locator('option')).toHaveCount(1);
  await expect(selector).toHaveValue('material');
  await expect(page.getByLabel('Subir video (máximo 500 MB)', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Pregunta', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Entregas de prácticas' })).toHaveCount(0);
  await expect(page.getByLabel('Archivos (PDF, Word, Excel, JPG, PNG)', { exact: false })).toBeVisible();
});
