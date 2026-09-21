const fs = require('fs');
const path = require('path');

const posDir = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\pos';
if (fs.existsSync(posDir)) {
  const files = fs.readdirSync(posDir);
  console.log('Files in pos dir:', files);
} else {
  console.log('Pos dir does not exist');
}
