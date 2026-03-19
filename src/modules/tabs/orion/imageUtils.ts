const PHOTO_SIZE_PX = 250;

function optimizeImageToWebp250(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = PHOTO_SIZE_PX;
        canvas.height = PHOTO_SIZE_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to process image'));
          return;
        }

        const sourceAspect = image.width / image.height;
        const targetAspect = 1;
        let sourceWidth = image.width;
        let sourceHeight = image.height;
        let sourceX = 0;
        let sourceY = 0;

        if (sourceAspect > targetAspect) {
          sourceWidth = image.height;
          sourceX = (image.width - sourceWidth) / 2;
        } else if (sourceAspect < targetAspect) {
          sourceHeight = image.width;
          sourceY = (image.height - sourceHeight) / 2;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          PHOTO_SIZE_PX,
          PHOTO_SIZE_PX
        );

        resolve(canvas.toDataURL('image/webp', 0.9));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image file'));
    };

    image.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image file'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
}

export async function processStrategyPhoto(file: File): Promise<string> {
  if (isSvgFile(file)) return readFileAsDataUrl(file);
  return optimizeImageToWebp250(file);
}
