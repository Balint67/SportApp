const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const webDir = path.join(rootDir, 'www');
const filesToCopy = ['index.html', 'index.css', 'index.js'];

fs.mkdirSync(webDir, { recursive: true });

for (const fileName of filesToCopy) {
  const sourcePath = path.join(rootDir, fileName);
  const targetPath = path.join(webDir, fileName);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required web asset: ${fileName}`);
  }

  fs.copyFileSync(sourcePath, targetPath);
}

console.log(`Copied ${filesToCopy.length} web files into ${webDir}`);
