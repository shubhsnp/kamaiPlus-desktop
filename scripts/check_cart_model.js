const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\models\\models.dart';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('class CartItemModel'));
console.log(lines.slice(idx - 2, idx + 40).join('\n'));
