export async function prepararBanner(file: File): Promise<{ file: File; width: number; height: number }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('El banner debe ser una imagen JPG, PNG o WebP.');
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width < 1280 || height < 720) {
    throw new Error(`La imagen mide ${width} × ${height} px. Para evitar pixelación, sube una de al menos 1280 × 720 px; se recomienda 1920 × 1080 px.`);
  }

  if (width <= 2560 && file.size <= 2_000_000) return { file, width, height };

  const scale = Math.min(1, 2560 / width, 1440 / height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) return { file, width, height };
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return { file, width, height };
  return { file: new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }), width, height };
}
