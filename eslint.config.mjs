import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
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
    "public/tickets/vendor/**",
  ]),
]);

export default eslintConfig;
