const fs = require('fs');

let t = fs.readFileSync('src/graphql/expenses.test.ts', 'utf8');

t = t.replace(
  `vi.mock('@/src/domains/expenses/service', () => ({
  insertExpense: vi.fn(),
  modifyExpense: vi.fn(),
  removeExpense: vi.fn(),
}))`,
  `import * as actualService from '@/src/domains/expenses/service'
vi.mock('@/src/domains/expenses/service', async () => {
  const actual = await vi.importActual('@/src/domains/expenses/service')
  return {
    ...actual,
    insertExpense: vi.fn(),
    modifyExpense: vi.fn(),
    removeExpense: vi.fn(),
  }
})`
);

fs.writeFileSync('src/graphql/expenses.test.ts', t);
