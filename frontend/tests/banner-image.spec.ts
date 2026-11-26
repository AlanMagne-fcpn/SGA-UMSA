import { expect, test } from '@playwright/test';

test('cualquier banner se ajusta a 1920 × 1080', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const { prepararBanner } = await import('/src/utils/bannerImage.ts');
    const crearArchivo = async (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#076db4';
      context.fillRect(0, 0, width, height);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'));
      return new File([blob], 'banner.png', { type: 'image/png' });
    };
    const pequeno = await prepararBanner(await crearArchivo(447, 447));
    const grande = await prepararBanner(await crearArchivo(3000, 1688));
    return {
      pequeno: { tipo: pequeno.file.type, nombre: pequeno.file.name, ancho: pequeno.width, alto: pequeno.height },
      grande: { tipo: grande.file.type, ancho: grande.width, alto: grande.height },
    };
  });
  expect(result.pequeno.tipo).toBe('image/webp');
  expect(result.pequeno.nombre).toBe('banner.webp');
  expect(result.pequeno.ancho).toBe(1920);
  expect(result.pequeno.alto).toBe(1080);
  expect(result.grande.tipo).toBe('image/webp');
  expect(result.grande.ancho).toBe(1920);
  expect(result.grande.alto).toBe(1080);
});
