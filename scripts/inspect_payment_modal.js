const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\pos\\payment_modal.dart';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
console.log(lines.slice(25, 120).join('\n'));
