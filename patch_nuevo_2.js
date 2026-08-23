const fs = require('fs');

let page = fs.readFileSync('app/expenses/nuevo/page.tsx', 'utf8');
page = page.replace("import { createExpense } from '@/src/domains/expenses/actions'", "");
page = page.replace(" createExpense={createExpense}", "");
fs.writeFileSync('app/expenses/nuevo/page.tsx', page);
