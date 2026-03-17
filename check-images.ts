import fs from 'fs';
import path from 'path';

const files = fs.readdirSync(path.join(process.cwd(), 'public'))
  .filter(f => f.endsWith('.jpg'))
  .map(f => path.join('public', f));

files.forEach(file => {
  if (fs.existsSync(file)) {
    const buffer = fs.readFileSync(file);
    console.log(`File: ${file}`);
    console.log(`Size: ${buffer.length} bytes`);
    console.log(`First 10 bytes: ${buffer.slice(0, 10).toString('hex')}`);
    // JPEG magic number: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      console.log('Valid JPEG header found.');
    } else {
      console.log('INVALID JPEG header!');
    }
  } else {
    console.log(`File not found: ${file}`);
  }
});
