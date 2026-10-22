import { expect, test } from '@playwright/test';

test('un visitante puede abrir la ficha de un curso y conocer su certificado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('http://localhost:3000/eventos', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 1, nombre: 'Congreso de ciencias', estado: 1, gestion: 2026,
      actividades: [{ id: 7, nombre: 'Introducción a la investigación', descripcion: 'Aprende los fundamentos.', tipo: 'Curso', modalidad: 'Virtual', estado: 1, horas: 20 }] }]),
  }));
  await page.route('http://localhost:3000/eventos/1/imparticiones', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('http://localhost:3000/actividades-academicas/publicos/7', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 7, nombre: 'Introducción a la investigación', descripcion: 'Aprende los fundamentos.', tipo: 'Curso',
      imagen: null, fecha_inicio: '2026-11-01', fecha_fin: '2026-12-01', horas: 20, cupo: 30, inscritos: 3, estado: 1,
      modalidades: [{ id: 1, tipo: 'Virtual', min_nota: 70, min_asistencia: 0 }], docentes: [],
      valoracion: { promedio: 4.5, cantidad: 8 },
      evento: { id: 1, nombre: 'Congreso de ciencias', gestion: '2026', estado: 1, imagen_fondo: null },
    }),
  }));

  await page.goto('/eventos', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /Introducción a la investigación/i }).click();
  await expect(page).toHaveURL(/\/cursos\/7$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Introducción a la investigación' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Ruta' }).getByRole('link', { name: 'Congreso de ciencias' })).toHaveAttribute('href', '/eventos/1');
  await expect(page.getByRole('link', { name: /Ver cursos del evento/i })).toHaveAttribute('href', '/eventos/1#cursos');
  await expect(page.getByText('70/100')).toBeVisible();
  await expect(page.getByText('4.5/5 · 8 valoraciones')).toBeVisible();
  await expect(page.getByText('participación', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crear cuenta para inscribirme' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('la ficha usa la ruta existente cuando el backend aún no publica la ruta nueva', async ({ page }) => {
  await page.route('http://localhost:3000/actividades-academicas/publicos/16', route => route.fulfill({
    status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Cannot GET /actividades-academicas/publicos/16' }),
  }));
  await page.route('http://localhost:3000/actividades-academicas/16', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 16, nombre: 'Simposio sobre Biología Molecular', descripcion: 'Conferencias y prácticas de laboratorio.',
      tipo: 'Simposio', estado: 1, horas: 40, requisitos: { presentacion: {
        objetivos: 'Identificar avances recientes.\nComparar métodos de laboratorio.',
        publico_objetivo: 'Estudiantes e investigadores.',
      }, custom: [] },
      evento: { id: 1, nombre: 'Congreso TWAS-TYAN', estado: 1, gestion: '2025' },
      modalidades: [{ id: 1, tipo: 'Presencial', min_nota: 51, min_asistencia: 80 }],
    }),
  }));
  await page.goto('/cursos/16');
  await expect(page.getByRole('heading', { level: 1, name: 'Simposio sobre Biología Molecular' })).toBeVisible();
  await expect(page.getByText('Identificar avances recientes.')).toBeVisible();
  await expect(page.getByText('Estudiantes e investigadores.')).toBeVisible();
});
