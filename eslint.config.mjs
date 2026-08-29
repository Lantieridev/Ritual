import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Sin esto, destructurar sólo para excluir una clave (el patrón
      // `const { x, ...rest } = obj` cuando lo que importa es `rest`, no `x`)
      // marca `x` como no usada. Es el caso exacto que ignoreRestSiblings
      // existe para cubrir.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/src/core/lib/auth",
              message:
                "This dev-only auth stub was removed (2026-07-11) — it caused a real production bug (expenses silently broken for every logged-in user, RITUAL_DEV_USER_ID never set outside local dev). Use getCurrentUserId from '@/src/core/auth/session' instead.",
            },
            {
              name: "@/src/core/lib/supabase",
              message:
                "The bare, session-unaware Supabase client was removed (2026-07-11) — it can't authenticate as the logged-in user, so any RLS-scoped table (attendance, expenses, wishlist, ...) silently reads back empty. Use createClient from '@/src/core/lib/supabase/server' (or 'client'/'middleware' as appropriate) instead.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Generated: istanbul/vitest coverage reporter output.
    "coverage/**",

    // Generated: Supabase CLI scratch space. Holds the bundled edge runtime,
    // which is minified onto a handful of lines and lints as ~200 problems.
    "supabase/.temp/**",

    // Vendored: third-party libs plus the copied omelette starter components,
    // which are overwritten wholesale whenever the starter is re-copied.
    "public/tickets/**",
  ]),
]);

export default eslintConfig;
