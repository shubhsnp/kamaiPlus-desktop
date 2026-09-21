const fs = require('fs');
const path = require('path');

function findInDir(dir, str) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      findInDir(full, str);
    } else if (full.endsWith('.dart')) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes(str)) {
        console.log('Found in:', full);
      }
    }
  }
}

findInDir('D:\\My Web Sites\\KamaiPlus Android\\lib', 'PosBillingScreen');
