import { expect, test, type Page } from '@playwright/test';

async function auth(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('token', 'prueba'); localStorage.setItem('theme', 'dark'); });
  await page.route('http://localhost:3000/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('http://localhost:3000/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 9, usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }) }));
}

test('crear una actividad configura permisos sin subir contenido y solo Curso ofrece evaluaciones', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/admin/eventos/lista?limit=100', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 3, nombre: 'Congreso', estado: 1, actividades: [] }]) }));
  await page.route('http://localhost:3000/actividades-academicas', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 27 }) }));
  await page.goto('/admin/gestion-eventos?newAct=true&eventoId=3');
  const wizard = page.locator('.activity-creation').first();
  const permisos = wizard.getByRole('region', { name: 'Permisos de contenido del ponente' });
  await expect(permisos.getByRole('checkbox')).toHaveCount(2);
  await expect(permisos.locator('input[type=file]')).toHaveCount(0);
  await expect(permisos.getByRole('button')).toHaveCount(0);
  await wizard.getByLabel('Tipo de Actividad', { exact: true }).selectOption('Curso');
  await expect(permisos.getByRole('checkbox')).toHaveCount(4);
  for (const name of ['Permitir videos', 'Permitir archivos de estudio', 'Permitir prácticas', 'Permitir cuestionarios y exámenes']) await permisos.getByRole('checkbox', { name, exact: true }).check();
  await wizard.getByPlaceholder('Ej: Especialidad en Microbiología...').fill('Curso configurable');
  await page.getByText('Aprobación', { exact: true }).click();
  await page.getByLabel('Carga horaria de la actividad', { exact: true }).fill('40');
  await page.getByText('Horarios', { exact: true }).click();
  await page.getByLabel('Fecha de inicio de la actividad', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Fecha de fin de la actividad', { exact: true }).fill('2026-11-03');
  await page.getByText('Resumen', { exact: true }).click();
  const enviado = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/actividades-academicas'));
  await page.getByRole('button', { name: /Publicar Actividad/i }).click();
  const raw = (await enviado).postData()!.match(/name="requisitos"\r?\n\r?\n([^\r\n]+)/)![1];
  expect(JSON.parse(raw).aula).toEqual({ video: true, material: true, practica: true, examen: true });
});

test('editar un simposio solo permite habilitar videos y archivos y conserva sus requisitos', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/actividades-academicas/7', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    id: 7, nombre: 'Simposio', tipo: 'Simposio', estado: 1, horas: 4, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-01', evento: { id: 3 }, modalidades: [{ tipo: 'Presencial' }],
    requisitos: { base: { email: true }, custom: [], extension: 'conservar', aula: { video: false, material: true, practica: true, examen: true } },
  }) }));
  await page.goto('/admin/gestion-eventos/7?edit=true');
  const editor = page.locator('.activity-editor');
  const permisos = editor.getByRole('region', { name: 'Permisos de contenido del ponente' });
  await expect(permisos).toBeVisible({ timeout: 15000 });
  await expect(permisos.getByRole('checkbox')).toHaveCount(2);
  await expect(permisos.getByRole('button')).toHaveCount(0);
  await permisos.getByRole('checkbox', { name: 'Permitir videos', exact: true }).check();
  await permisos.screenshot({ path: 'test-results/permisos-contenido-simposio.png', animations: 'disabled' });
  const enviado = page.waitForRequest(req => req.method() === 'PUT' && req.url().endsWith('/actividades-academicas/7'));
  await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  const raw = (await enviado).postData()!.match(/name="requisitos"\r?\n\r?\n([^\r\n]+)/)![1];
  expect(JSON.parse(raw)).toMatchObject({ extension: 'conservar', base: { email: true }, aula: { video: true, material: true, practica: false, examen: false } });
});

test('el panel del ponente respeta los permisos y no ofrece exámenes para un simposio', async ({ page }) => {
  await auth(page);
  await page.route('http://localhost:3000/actividades-academicas/7/aula/configuracion', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tipo_actividad: 'Simposio', permisos: { video: true, material: false, practica: true, examen: true } }) }));
  await page.goto('/ponente/curso/7/aula');
  const selector = page.getByLabel('Tipo de contenido', { exact: true });
  await expect(selector.locator('option')).toHaveCount(1);
  await expect(selector).toHaveValue('video');
  await expect(page.getByLabel('Subir video (máximo 500 MB)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Pregunta', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Entregas de prácticas' })).toHaveCount(0);
  await expect(page.getByLabel('Archivos de estudio o instrucciones', { exact: false })).toHaveCount(0);
});

