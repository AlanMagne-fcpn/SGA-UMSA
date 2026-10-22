import { expect, test } from '@playwright/test';

test('un banner pequeño se rechaza y uno grande se optimiza sin perder proporción', async ({ page }) => {
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
    let mensaje = '';
    try { await prepararBanner(await crearArchivo(640, 360)); }
    catch (error) { mensaje = (error as Error).message; }
    const optimizado = await prepararBanner(await crearArchivo(3000, 1688));
    return { mensaje, tipo: optimizado.file.type, nombre: optimizado.file.name,
      anchoOriginal: optimizado.width, altoOriginal: optimizado.height };
  });
  expect(result.mensaje).toContain('1280 × 720');
  expect(result.tipo).toBe('image/webp');
  expect(result.nombre).toBe('banner.webp');
  expect(result.anchoOriginal).toBe(3000);
  expect(result.altoOriginal).toBe(1688);
});
