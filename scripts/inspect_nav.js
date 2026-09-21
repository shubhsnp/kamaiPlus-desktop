const fs = require('fs');
const file = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\dashboard\\home_dashboard_screen.dart';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('BottomNavigationBar') || l.includes('PosBillingScreen') || l.includes('_selectedIndex') || l.includes('onTap:')) {
    console.log(`L${i+1}: ${l}`);
  }
});
