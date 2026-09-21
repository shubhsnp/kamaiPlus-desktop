const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\pos\\pos_billing_screen.dart';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('childAspectRatio') || l.includes('crossAxisCount') || l.includes('stockLeftStr')) {
    console.log(`L${i+1}: ${l}`);
  }
});
