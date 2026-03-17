import sizeOf from 'image-size';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  path.join(__dirname, 'public', 'editorial-feature.jpg'),
  path.join(__dirname, 'public', 'podcast-feature.jpg')
];

files.forEach(file => {
  try {
    const buffer = fs.readFileSync(file);
    const dimensions = sizeOf(buffer);
    console.log(`[Image Check] ${file}: ${dimensions.width}x${dimensions.height} (${dimensions.type})`);
  } catch (err) {
    console.error(`[Image Check] ${file} is NOT a valid image: ${err.message}`);
  }
});
