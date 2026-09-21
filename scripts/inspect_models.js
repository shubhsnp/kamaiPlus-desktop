const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\models\\models.dart';
const content = fs.readFileSync(file, 'utf8');
console.log(content.slice(0, 3000));
