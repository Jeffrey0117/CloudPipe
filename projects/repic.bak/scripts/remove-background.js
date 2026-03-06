import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function removeBackground(inputPath, outputPath) {
  try {
    console.log(`Processing: ${inputPath}`);

    // Read the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`Image size: ${metadata.width}x${metadata.height}`);

    // Get raw pixel data
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Process pixels to remove light gray/white background
    // Using color distance algorithm for better gray detection

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Check if pixel is light (brightness > 200)
      const brightness = (r + g + b) / 3;

      // Check if pixel is grayscale (low color variation)
      const maxChannel = Math.max(r, g, b);
      const minChannel = Math.min(r, g, b);
      const saturation = maxChannel - minChannel;

      // Remove if: bright AND low saturation (gray/white)
      // Brightness threshold: 200 (catches lighter grays)
      // Saturation threshold: 30 (allows slightly colored pixels to pass)
      if (brightness > 200 && saturation < 30) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }

    // Create new image from processed data
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
    .png()
    .toFile(outputPath);

    console.log(`✓ Saved: ${outputPath}`);
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error);
  }
}

async function main() {
  const images = [
    {
      input: join(rootDir, 'repic.jpeg'),
      output: join(rootDir, 'repic.png')
    },
    {
      input: join(rootDir, 'repic-logo.jpeg'),
      output: join(rootDir, 'repic-logo.png')
    }
  ];

  console.log('Starting background removal...\n');

  for (const img of images) {
    await removeBackground(img.input, img.output);
  }

  console.log('\nDone! PNG files with transparent backgrounds created.');
}

main();
