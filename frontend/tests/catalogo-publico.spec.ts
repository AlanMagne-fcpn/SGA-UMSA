import { expect, test } from '@playwright/test';

test('cada evento tiene enlace propio, conserva sus cursos al recargar y no mezcla otros eventos', async ({ page }) => {
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([
      { id: 1, nombre: 'Congreso de ciencias', estado: 1, actividades: [{ id: 7, nombre: 'Investigación científica', estado: 1 }] },
      { id: 2, nombre: 'Encuentro de tecnología', estado: 1, actividades: [{ id: 8, nombre: 'Robótica aplicada', estado: 1 }] },
      { id: 3, nombre: 'Evento sin cursos', estado: 1, actividades: [] },
    ]),
  }));
  await page.route('http://localhost:3000/eventos/*/imparticiones', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.goto('/eventos');
  const evento = page.getByRole('link', { name: /Congreso de ciencias.*Explorar/i });
  await expect(evento).toHaveAttribute('href', '/eventos/1');
  await evento.click();
  await expect(page).toHaveURL(/\/eventos\/1$/);
  await expect(page.getByRole('heading', { name: 'Cursos de este evento' })).toBeVisible();
  await expect(page.locator('#cursos').getByRole('link', { name: /Investigación científica/i })).toHaveAttribute('href', '/cursos/7');
  await expect(page.locator('#cursos')).not.toContainText('Robótica aplicada');
  await page.reload();
  await expect(page.locator('#cursos')).toContainText('Investigación científica');
  await expect(page.locator('#cursos')).not.toContainText('Robótica aplicada');

  await page.goto('/eventos/2#cursos');
  await expect(page.locator('#cursos')).toContainText('Robótica aplicada');
  await expect(page.locator('#cursos')).not.toContainText('Investigación científica');
  await page.goto('/eventos/3');
  await expect(page.locator('#cursos')).toContainText('Este evento todavía no tiene cursos publicados.');
  await page.goto('/eventos/999');
  await expect(page.getByRole('heading', { name: 'Evento no disponible' })).toBeVisible();
  await expect(page.locator('#cursos')).toHaveCount(0);
});

test('el cambio de tema alcanza el catálogo, los filtros y las tarjetas y persiste al recargar', async ({ page }) => {
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 1, nombre: 'Congreso de ciencias', estado: 1, actividades: [{ id: 7, nombre: 'Curso de investigación', estado: 1 }] },
      { id: 2, nombre: 'Encuentro académico', estado: 1, actividades: [] },
    ]),
  }));
  await page.route('http://localhost:3000/eventos/*/imparticiones', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.goto('/eventos');
  const catalogo = page.getByRole('navigation', { name: 'Listado de eventos' });
  const cursos = page.locator('#cursos');
  const tarjeta = cursos.getByRole('link', { name: /Curso de investigación/i });
  const filtro = cursos.getByRole('searchbox', { name: /Buscar curso/ });

  await expect(catalogo).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Activar modo oscuro', exact: true }).click();
  await expect(catalogo).toHaveCSS('background-color', 'rgb(7, 21, 35)');
  await expect(cursos).toHaveCSS('background-color', 'rgb(11, 29, 47)');
  await expect(cursos.getByRole('heading', { level: 2 })).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(tarjeta).toHaveCSS('background-color', 'rgb(20, 42, 64)');
  await expect(tarjeta).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(filtro).toHaveCSS('background-color', 'rgb(18, 40, 60)');

  await page.reload();
  await expect(catalogo).toHaveCSS('background-color', 'rgb(7, 21, 35)');
  await page.getByRole('button', { name: 'Activar modo claro', exact: true }).click();
  await expect(catalogo).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(tarjeta).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(tarjeta).toHaveCSS('color', 'rgb(16, 46, 76)');
});

test('el catálogo pagina muchos eventos y encuentra cursos de cualquier evento', async ({ page }) => {
  const eventos = Array.from({ length: 33 }, (_, index) => ({
    id: index + 1, nombre: `Evento académico ${index + 1}`, estado: 1, gestion: 2026,
    actividades: index === 29 ? [{ id: 77, nombre: 'Curso de química avanzada', modalidad: 'Virtual', estado: 1 }] : [],
  }));
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(eventos),
  }));
  await page.route('http://localhost:3000/eventos/*/imparticiones', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));

  await page.goto('/eventos', { waitUntil: 'domcontentloaded' });
  const listado = page.getByRole('navigation', { name: 'Listado de eventos' });
  await expect(listado.locator('a[href^="/eventos/"]')).toHaveCount(8);
  await expect(listado.getByRole('button')).toHaveCount(2);
  await expect(listado).toContainText('33 eventos');
  await listado.getByRole('button', { name: 'Siguiente' }).click();
  await expect(listado).toContainText('Página 2 de 5');
  await listado.getByRole('searchbox', { name: 'Buscar eventos o cursos' }).fill('química avanzada');
  await expect(listado.getByRole('link', { name: /Evento académico 30/i })).toBeVisible();
  await expect(listado).toContainText('1 resultado');
  await expect(page.locator('#cursos').getByRole('link', { name: /Curso de química avanzada/i })).toBeVisible();
});

test('un evento único ofrece acceso a su contenido sin una tarjeta aislada', async ({ page }) => {
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 1, nombre: 'Congreso de ciencias', sigla: 'CC', estado: 1, gestion: 2026,
      imagen_portada: 'escudo.png', actividades: [{ id: 5, nombre: 'Taller de ciencias', estado: 1 }] }]),
  }));
  await page.route('http://localhost:3000/eventos/1/imparticiones', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.route('http://localhost:3000/uploads/eventos/escudo.png', route => route.fulfill({
    status: 200, contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6FncAAAAASUVORK5CYII=', 'base64'),
  }));
  await page.goto('/eventos', { waitUntil: 'domcontentloaded' });
  const listado = page.getByRole('navigation', { name: 'Listado de eventos' });
  await expect(listado.getByRole('link', { name: /Congreso de ciencias/i })).toHaveAttribute('href', '/eventos/1');
  await expect(listado.getByRole('link', { name: 'Información' })).toBeVisible();
  await expect(listado.getByRole('link', { name: 'Cronograma' })).toBeVisible();
  await expect(listado.getByRole('link', { name: 'Cursos' })).toBeVisible();
  await expect(listado.getByRole('searchbox')).toHaveCount(0);
  await listado.getByRole('link', { name: /Congreso de ciencias/i }).click();
  await expect(page).toHaveURL(/\/eventos\/1$/);
  await expect(page.locator('#cronograma')).toBeAttached();
  await expect(page.locator('#cursos').getByRole('link', { name: /Taller de ciencias/i })).toBeVisible();
  await expect(page.locator('#inicio img[alt="Logo de Congreso de ciencias"]')).toHaveAttribute('src', 'http://localhost:3000/uploads/eventos/escudo.png');
});

test('muestra eventos concluidos visibles y oculta borradores y concluidos ocultos', async ({ page }) => {
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 1, nombre: 'Evento actual', estado: 1 },
      { id: 2, nombre: 'Evento concluido', estado: 0, visibilidad_al_finalizar: 'visible' },
      { id: 3, nombre: 'Evento oculto', estado: 0, visibilidad_al_finalizar: 'oculto' },
      { id: 4, nombre: 'Evento borrador', estado: 3 },
    ]),
  }));
  await page.route('http://localhost:3000/eventos/*/imparticiones', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.goto('/eventos', { waitUntil: 'domcontentloaded' });
  const listado = page.getByRole('navigation', { name: 'Listado de eventos' });
  await expect(listado.locator('a[href^="/eventos/"]')).toHaveCount(2);
  await expect(listado).toContainText('Evento concluido');
  await expect(listado).toContainText('Finalizado');
  await expect(listado).not.toContainText('Evento oculto');
  await expect(listado).not.toContainText('Evento borrador');
  await expect(page.locator('#inicio')).toHaveCount(0);
});
