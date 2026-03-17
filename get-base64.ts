import fs from 'fs';

const files = ['public/editorial-feature.jpg', 'public/podcast-feature.jpg'];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const buffer = fs.readFileSync(file);
    console.log(`---BEGIN ${file}---`);
    console.log(buffer.toString('base64'));
    console.log(`---END ${file}---`);
  }
});
