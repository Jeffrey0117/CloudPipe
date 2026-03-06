/**
 * Detect if an image has transparency (alpha channel with values < 255)
 * @param {string} imageSrc - Image source (data URL or URL)
 * @returns {Promise<boolean>} - True if image has transparent pixels
 */
export async function hasImageTransparency(imageSrc) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Check alpha channel (every 4th byte starting from index 3)
        // If any pixel has alpha < 255, it has transparency
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            resolve(true);
            return;
          }
        }

        // No transparent pixels found
        resolve(false);
      } catch (error) {
        // If canvas operations fail (CORS, etc), assume no transparency
        console.warn('Failed to detect transparency:', error);
        resolve(false);
      }
    };

    img.onerror = () => {
      resolve(false);
    };

    img.src = imageSrc;
  });
}

/**
 * Quick check if image is likely to have transparency based on format
 * @param {string} src - Image source
 * @returns {boolean}
 */
export function isPNGFormat(src) {
  if (!src) return false;
  return (
    src.toLowerCase().includes('.png') ||
    src.toLowerCase().includes('image/png') ||
    src.toLowerCase().includes('data:image/png')
  );
}
