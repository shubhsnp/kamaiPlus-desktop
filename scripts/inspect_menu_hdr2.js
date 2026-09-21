const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\menu\\menu_screen.dart';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
console.log(lines.slice(95, 175).join('\n'));
