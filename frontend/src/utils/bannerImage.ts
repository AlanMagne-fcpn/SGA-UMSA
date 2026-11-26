const ANCHO = 1920;
const ALTO = 1080;

function dibujarCubriendo(context: CanvasRenderingContext2D, image: CanvasImageSource, ancho: number, alto: number) {
  const escala = Math.max(ANCHO / ancho, ALTO / alto);
  const w = ancho * escala;
  const h = alto * escala;
  context.drawImage(image, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
}

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

  const ancho = image.naturalWidth;
  const alto = image.naturalHeight;
  if (!ancho || !alto) throw new Error('No se pudo leer la imagen seleccionada.');

  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const context = canvas.getContext('2d');
  if (!context) return { file, width: ancho, height: alto };
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const ampliacion = Math.max(ANCHO / ancho, ALTO / alto);
  if (ampliacion > 1.2) {
    context.filter = 'blur(28px)';
    dibujarCubriendo(context, image, ancho, alto);
    context.filter = 'none';
    context.fillStyle = 'rgba(6, 37, 72, 0.28)';
    context.fillRect(0, 0, ANCHO, ALTO);
    const escala = Math.min(ANCHO / ancho, ALTO / alto, 1);
    const w = ancho * escala;
    const h = alto * escala;
    context.drawImage(image, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
  } else {
    dibujarCubriendo(context, image, ancho, alto);
  }

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) return { file, width: ancho, height: alto };
  return {
    file: new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }),
    width: ANCHO,
    height: ALTO,
  };
}
