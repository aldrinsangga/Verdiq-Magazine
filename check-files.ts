import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  path.join(__dirname, 'public', 'editorial-feature.jpg'),
  path.join(__dirname, 'public', 'podcast-feature.jpg'),
  path.join(__dirname, 'dist', 'editorial-feature.jpg'),
  path.join(__dirname, 'dist', 'podcast-feature.jpg')
];

files.forEach(file => {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    const stats = fs.statSync(file);
    console.log(`[File Check] ${file} is READABLE. Size: ${stats.size} bytes`);
  } catch (err) {
    console.error(`[File Check] ${file} is NOT READABLE or NOT FOUND: ${err.message}`);
  }
});
