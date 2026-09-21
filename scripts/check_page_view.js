const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\dashboard\\home_dashboard_screen.dart';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
console.log(lines.slice(55, 110).join('\n'));
