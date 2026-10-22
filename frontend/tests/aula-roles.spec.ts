import { expect, test } from '@playwright/test';

for (const perfil of [
  { nombre: 'Ponente', rolId: 2, detalle: '/ponente/curso/7', aula: '/ponente/curso/7/aula' },
  { nombre: 'Coordinador', rolId: 4, detalle: '/coordinador/gestion-eventos/7', aula: '/coordinador/cursos/7/aula' },
]) {
  test(`${perfil.nombre} abre el aula desde su actividad y sube archivos sin ser superadministrador`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('token', 'prueba'));
    await page.route('http://localhost:3000/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.route('http://localhost:3000/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      id: 9, email: 'prueba@example.test', usuariosRoles: [{ rol: { id: perfil.rolId, nombre_rol: perfil.nombre } }],
    }) }));
    await page.route('http://localhost:3000/actividades-academicas/7', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      id: 7, nombre: 'Curso de prueba', tipo: 'Curso', estado: 1, horas: 40, evento: { id: 3, nombre: 'Evento de prueba' },
      modalidades: [{ tipo: 'Virtual', min_nota: 51, min_asistencia: 80, sesiones: [] }], imparticiones: [{ usuario: { id: 9 } }], inscripciones: [],
      requisitos: { aula: { video: true, material: true, practica: true, examen: true } },
    }) }));
    await page.route('http://localhost:3000/actividades-academicas/7/aula/configuracion', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      tipo_actividad: 'Curso', permisos: { video: true, material: true, practica: true, examen: true },
    }) }));
    await page.route('http://localhost:3000/actividades-academicas/7/materiales/upload', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ path: '/uploads/materiales/guia.pdf' }) }));
    await page.goto(perfil.detalle);
    const acceso = page.getByRole('link', { name: /Editar aula virtual/ });
    await expect(acceso).toHaveAttribute('href', perfil.aula);
    await acceso.click();
    await expect(page).toHaveURL(perfil.aula);
    const tipo = page.getByLabel('Tipo de contenido', { exact: true });
    await expect(tipo.locator('option')).toHaveCount(4);
    await tipo.selectOption('material');
    await page.getByLabel('Título del contenido', { exact: true }).fill(`Guía del ${perfil.nombre}`);
    await page.getByLabel('Archivos de estudio o instrucciones', { exact: false }).setInputFiles({ name: 'Guia.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    const enviado = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/7/lecciones'));
    await page.getByRole('button', { name: 'Guardar contenido', exact: true }).click();
    expect((await enviado).postDataJSON()).toMatchObject({ tipo: 'material', recursos: [{ nombre: 'Guia.pdf', url: '/uploads/materiales/guia.pdf' }] });
  });
}
