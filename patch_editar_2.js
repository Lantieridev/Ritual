const fs = require('fs');

let page = fs.readFileSync('app/expenses/[id]/editar/page.tsx', 'utf8');
page = page.replace("import { updateExpense } from '@/src/domains/expenses/actions'", "");
page = page.replace(" updateExpense={updateExpense}", "");
fs.writeFileSync('app/expenses/[id]/editar/page.tsx', page);
