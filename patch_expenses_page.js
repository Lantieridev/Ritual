const fs = require('fs');

let page = fs.readFileSync('app/expenses/page.tsx', 'utf8');
page = page.replace(
  '{topCategories.map(([cat, amount]) => {',
  '{topCategories.map(([cat, amount]: [string, any]) => {'
);
fs.writeFileSync('app/expenses/page.tsx', page);
