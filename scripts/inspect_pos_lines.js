const fs = require('fs');
const file1 = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\pos\\pos_billing_screen.dart';
const content = fs.readFileSync(file1, 'utf8');
const lines = content.split('\n');
console.log(lines.slice(40, 250).join('\n'));
