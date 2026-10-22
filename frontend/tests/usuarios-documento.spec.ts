import { expect, test, type Page } from '@playwright/test';

async function preparar(page: Page, documento: string) {
  await page.addInitScript(() => { localStorage.setItem('token', 'prueba'); localStorage.setItem('theme', 'dark'); });
  const usuario = { id: 9, email: 'kevin@example.test', estado: 1, persona: { nombres: 'Kevin', primer_apellido: 'Soto', documento_identidad: documento, genero: 0 }, usuariosRoles: [{ rol: { id: 5, nombre_rol: 'Ponente' } }], afiliaciones: [] };
  await page.route('http://localhost:3000/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('http://localhost:3000/auth/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 1, usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }) }));
  await page.route(/^http:\/\/localhost:3000\/usuarios\?/, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [usuario], total: 1 }) }));
  await page.route('http://localhost:3000/usuarios/9/perfil', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(usuario) }));
  await page.goto('/admin/usuarios');
}

for (const caso of [
  { guardado: 'Carnet de Identidad: 13232325', tipo: 'Carnet de Identidad', numero: '13232325' },
  { guardado: 'Pasaporte: AB-001234', tipo: 'Pasaporte', numero: 'AB-001234' },
  { guardado: '001234-1A', tipo: '', numero: '001234-1A' },
]) {
  test(`edita el documento ${caso.tipo || 'sin prefijo'} sin perder su tipo, letras ni ceros`, async ({ page }) => {
    await preparar(page, caso.guardado);
    await page.getByTitle('Ver / Editar Detalles', { exact: true }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByLabel('Número de documento', { exact: true })).toHaveValue(caso.numero);
    await expect(dialogo.getByLabel('Tipo de documento', { exact: true })).toHaveValue(caso.tipo);
    await expect(dialogo.getByLabel('Género', { exact: true })).toHaveValue('0');
    await expect(dialogo.locator('.v-select')).toHaveCount(0);
    await expect(dialogo.getByLabel('Nombres *', { exact: true })).toHaveCSS('color', 'rgb(241, 245, 249)');
    await expect(dialogo.getByLabel('Número de documento', { exact: true })).toHaveCSS('border-top-width', '1px');
    const enviado = page.waitForRequest(req => req.method() === 'PATCH' && req.url().endsWith('/usuarios/9/perfil-completo'));
    await dialogo.getByRole('button', { name: /Guardar Cambios/i }).click();
    expect((await enviado).postDataJSON()).toMatchObject({ documento_identidad: caso.guardado, genero: 0 });
  });
}

test('el formulario de usuarios cabe en móvil y conserva contraste al cambiar de tema', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparar(page, 'Otro Documento Válido: AB-019');
  await page.getByTitle('Ver / Editar Detalles', { exact: true }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByLabel('Número de documento', { exact: true })).toHaveValue('AB-019');
  expect(await dialogo.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await expect(dialogo.getByLabel('Número de documento', { exact: true })).toHaveCSS('color', 'rgb(15, 23, 42)');
  await dialogo.screenshot({ path: 'test-results/usuario-formulario-movil.png', animations: 'disabled' });
});

test('crear usuario envía el documento separado en pantalla y conserva el rol numérico', async ({ page }) => {
  await preparar(page, '13232325');
  await page.getByRole('button', { name: /Nuevo Usuario/i }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Nombres *', { exact: true }).fill('Ana');
  await dialogo.getByLabel('Primer Apellido *', { exact: true }).fill('Pérez');
  await dialogo.getByLabel('Tipo de documento', { exact: true }).selectOption('Pasaporte');
  await dialogo.getByLabel('Número de documento', { exact: true }).fill('AB-001234');
  await dialogo.getByLabel('Rol del Sistema *', { exact: true }).selectOption('5');
  await dialogo.getByLabel('Correo Electrónico *', { exact: true }).fill('ana@example.test');
  await dialogo.getByLabel('Contraseña Temporal *', { exact: true }).fill('ClavePrueba123!');
  const enviado = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/usuarios/ponente'));
  await dialogo.getByRole('button', { name: /Crear Usuario/i }).click();
  expect((await enviado).postDataJSON()).toMatchObject({ documento_identidad: 'Pasaporte: AB-001234', id_rol: 5 });
});
