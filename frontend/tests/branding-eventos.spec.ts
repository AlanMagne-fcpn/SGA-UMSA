import { expect, test } from '@playwright/test';

test('la identidad del sistema permanece fija y cada evento usa únicamente su propio logo', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const eventos = [
    { id: 1, nombre: 'Congreso Rojo', estado: 1, color_principal: '#ff0000', institucion_badge: 'Identidad roja', logo: '/uploads/logo/rojo.png', imagen_portada: 'antiguo.png' },
    { id: 2, nombre: 'Encuentro Dorado', estado: 1, color_principal: '#ffaa00', institucion_badge: 'Identidad dorada', logo: '/uploads/eventos/dorado.png' },
    { id: 3, nombre: 'Evento sin logo', estado: 1 },
    { id: 4, nombre: 'Archivo faltante', estado: 1, logo: '/uploads/logo/faltante.png' },
  ];
  await page.route('http://localhost:3000/eventos', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(eventos) }));
  await page.route('http://localhost:3000/eventos/*/imparticiones', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  for (const path of ['/uploads/logo/rojo.png', '/uploads/eventos/dorado.png']) {
    await page.route(`http://localhost:3000${path}`, route => route.fulfill({
      contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6FncAAAAASUVORK5CYII=', 'base64'),
    }));
  }
  await page.route('http://localhost:3000/uploads/logo/faltante.png', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/eventos');
  const catalogo = page.locator('#eventos');
  await expect(catalogo.getByRole('link', { name: /Congreso Rojo.*Explorar/i }).locator('img[data-event-logo]')).toHaveAttribute('src', 'http://localhost:3000/uploads/logo/rojo.png');
  await expect(catalogo.getByRole('link', { name: /Encuentro Dorado.*Explorar/i }).locator('img[data-event-logo]')).toHaveAttribute('src', 'http://localhost:3000/uploads/eventos/dorado.png');
  await expect(catalogo.getByRole('img', { name: 'Evento sin logo: logo no disponible', exact: true })).toBeVisible();
  await expect(catalogo.getByRole('img', { name: 'Archivo faltante: logo no disponible', exact: true })).toBeVisible();
  await expect(catalogo.locator('img[src="/logo/logoOficial.png"]')).toHaveCount(0);

  const marca = page.locator('[data-system-brand]');
  const logoSistema = page.locator('nav img[alt="SGEA"]');
  const ingreso = page.locator('nav a[href="/login"]').first();
  await page.goto('/eventos/1');
  await expect(page.getByText('Identidad roja', { exact: true })).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  await expect(page.locator('#inicio img[data-event-logo]')).toHaveAttribute('src', 'http://localhost:3000/uploads/logo/rojo.png');
  await expect(marca).toHaveCSS('color', 'rgb(0, 112, 187)');
  const fondoIngreso = await ingreso.evaluate(element => getComputedStyle(element).backgroundImage);
  await page.goto('/eventos/2');
  await expect(page.getByText('Identidad dorada', { exact: true })).toHaveCSS('background-color', 'rgb(255, 170, 0)');
  await expect(marca).toHaveCSS('color', 'rgb(0, 112, 187)');
  await expect(ingreso).toHaveCSS('background-image', fondoIngreso);
  await expect(logoSistema).toHaveAttribute('src', '/logo/logoOficial.png');
  await expect(logoSistema).toHaveCSS('opacity', '1');
  await expect(logoSistema).toHaveCSS('filter', 'none');
  await page.goto('/eventos');
  await expect(marca).toHaveCSS('color', 'rgb(0, 112, 187)');
  await page.getByRole('button', { name: 'Activar modo claro', exact: true }).click();
  await expect(marca).toHaveCSS('color', 'rgb(0, 112, 187)');
  await expect(logoSistema).toHaveCSS('opacity', '1');
});
