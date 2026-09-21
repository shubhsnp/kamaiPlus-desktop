const fs = require('fs');

const file1 = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\pos\\pos_billing_screen.dart';
const file2 = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\pos\\payment_modal.dart';

console.log('--- pos_billing_screen.dart ---');
if (fs.existsSync(file1)) {
  const content = fs.readFileSync(file1, 'utf8');
  console.log('Length:', content.length, 'lines:', content.split('\n').length);
  console.log(content.slice(0, 1500));
}

console.log('--- payment_modal.dart ---');
if (fs.existsSync(file2)) {
  const content2 = fs.readFileSync(file2, 'utf8');
  console.log('Length:', content2.length, 'lines:', content2.split('\n').length);
  console.log(content2.slice(0, 1000));
}
