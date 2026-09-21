const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern, results = []) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      searchDir(full, pattern, results);
    } else if (full.endsWith('.dart')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes(pattern)) {
        results.push(full);
      }
    }
  }
  return results;
}

const res = searchDir('D:\\My Web Sites\\KamaiPlus Android\\lib', 'CartItemModel');
console.log('CartItemModel references:', res);
