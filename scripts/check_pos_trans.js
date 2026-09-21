const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\core\\database\\local_database.dart';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
console.log(lines.slice(340, 390).join('\n'));
