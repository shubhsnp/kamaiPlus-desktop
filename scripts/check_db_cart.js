const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\core\\database\\local_database.dart';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('CartItemModel')) {
    console.log(`L${i+1}: ${l}`);
  }
});
