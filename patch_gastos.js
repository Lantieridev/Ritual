const fs = require('fs');

let page = fs.readFileSync('app/events/[id]/gastos/page.tsx', 'utf8');
page = page.replace(
  'const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)',
  'const total = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0)'
);
fs.writeFileSync('app/events/[id]/gastos/page.tsx', page);
