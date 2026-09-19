/**
 * Returned by insertExpense when there is no session. Lives in its own
 * module (no server imports) so the offline sync client can tell "sign in
 * again" apart from a validation error without importing service.ts.
 */
export const EXPENSES_AUTH_REQUIRED_MESSAGE = 'Iniciá sesión para registrar gastos.'
