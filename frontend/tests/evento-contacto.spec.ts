import { expect, test } from '@playwright/test';

test('el campo Dónde estamos del editor se envía como dirección del evento', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'prueba'));
  await page.route('http://localhost:3000/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('http://localhost:3000/auth/me', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ id: 1, usuariosRoles: [{ rol: { id: 6, nombre_rol: 'Super Usuario' } }] }),
  }));
  await page.goto('/admin/eventos');
  await page.getByRole('button', { name: /Nuevo Evento/i }).click();
  await page.getByPlaceholder('NOMBRE DEL EVENTO').fill('Evento con contacto propio');
  await page.getByText('Cronograma', { exact: true }).click();
  await page.getByText('Fecha de Inicio General', { exact: true }).locator('..').locator('input').fill('2026-11-01');
  await page.getByText('Fecha de Fin General', { exact: true }).locator('..').locator('input').fill('2026-11-02');
  await page.getByText('Contacto', { exact: true }).last().click();
  await page.getByPlaceholder('Ej: Campus Central UMSA, Avenida Villazón').fill('Campus editado desde Contacto');
  const enviado = page.waitForRequest(request => request.method() === 'POST' && request.url() === 'http://localhost:3000/admin/eventos');
  await page.getByRole('button', { name: /Finalizar Cambios/i }).click();
  const request = await enviado;
  expect(request.postData()).toMatch(/name="direccion"\r?\n\r?\nCampus editado desde Contacto/);
});

test('el pie muestra el contacto de la ruta y del evento del curso sin heredar auspiciadores', async ({ page }) => {
  const eventos = [
    { id: 1, nombre: 'Evento del norte', estado: 1, direccion: 'Campus Norte', telefono: '11111111', email: 'norte@example.test',
      organizadores: JSON.stringify([{ nombre: 'Organización Norte', link: 'https://norte.example.test' }]), actividades: [] },
    { id: 2, nombre: 'Evento del sur', estado: 1, direccion: 'Campus Sur', telefono: '22222222', email: 'sur@example.test',
      organizadores: [{ nombre: 'Organización Sur', link: 'https://sur.example.test' }], actividades: [] },
    { id: 3, nombre: 'Evento sin contacto', estado: 1, organizadores: '[]', actividades: [] },
    { id: 4, nombre: 'Contacto oculto', estado: 1, telefono: '44444444', secciones_visibles: { contacto: false }, actividades: [] },
  ];
  await page.route('http://localhost:3000/eventos', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(eventos) }));
  await page.route('http://localhost:3000/eventos/*/imparticiones', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('http://localhost:3000/actividades-academicas/publicos/7', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({
      id: 7, nombre: 'Curso del norte', estado: 1, evento: { id: 1, nombre: 'Evento del norte', estado: 1 },
      modalidades: [], docentes: [], contenido: [], valoracion: { promedio: null, cantidad: 0 },
    }),
  }));
  const footer = page.locator('#footer');
  await page.goto('/eventos/1');
  await expect(footer).toContainText('Campus Norte');
  await expect(footer).toContainText('11111111');
  await expect(footer.getByRole('link', { name: 'norte@example.test' })).toHaveAttribute('href', 'mailto:norte@example.test');
  await expect(footer.getByRole('link', { name: 'Organización Norte' })).toHaveAttribute('href', 'https://norte.example.test');
  await page.goto('/eventos/2');
  await expect(footer).toContainText('Campus Sur');
  await expect(footer).toContainText('Organización Sur');
  await expect(footer).not.toContainText('Campus Norte');
  await expect(footer).not.toContainText('norte@example.test');
  await page.reload();
  await expect(footer).toContainText('sur@example.test');

  await page.goto('/cursos/7');
  await expect(footer).toContainText('Campus Norte');
  await expect(footer).not.toContainText('Campus Sur');
  await page.reload();
  await expect(footer).toContainText('Organización Norte');
  await page.goto('/eventos/3');
  await expect(footer).toContainText('Contacto por confirmar.');
  await expect(footer).toContainText('Organización y auspicio por confirmar.');
  await expect(footer).not.toContainText('TWAS');
  await expect(footer).not.toContainText('Embajada de Brasil');
  await page.goto('/eventos/4');
  await expect(page.getByRole('heading', { level: 1, name: 'Contacto oculto' })).toBeVisible();
  await expect(footer).not.toContainText('44444444');
  await page.goto('/eventos');
  await expect(footer).toContainText('www.umsa.bo');
  await expect(footer).not.toContainText('norte@example.test');
  await expect(footer).not.toContainText('sur@example.test');
});
