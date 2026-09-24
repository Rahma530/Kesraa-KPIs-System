const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(path.join(__dirname, 'src'), (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove Tailwind backdrop-blur classes
    content = content.replace(/\bbackdrop-blur-(sm|md|lg|xl|2xl|3xl|none)\b/g, '');
    content = content.replace(/\bbackdrop-blur\b/g, '');
    
    // Remove inline backdropFilter styles
    // Match cases like `, backdropFilter: 'blur(16px)'`
    content = content.replace(/,\s*backdropFilter:\s*['"]blur\([^)]+\)['"]/g, '');
    // Match cases like `backdropFilter: 'blur(16px)',`
    content = content.replace(/backdropFilter:\s*['"]blur\([^)]+\)['"]\s*,?/g, '');

    fs.writeFileSync(filePath, content, 'utf8');
  }
});
console.log('Finished removing blur effects.');
