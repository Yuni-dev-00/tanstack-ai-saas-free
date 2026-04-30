import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importX from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import unicorn from "eslint-plugin-unicorn";
import pluginQuery from "@tanstack/eslint-plugin-query";
import pluginRouter from "@tanstack/eslint-plugin-router";
import globals from "globals";

// Flat config. TanStack Router's `create-route-property-order` is the key
// rule here — property misordering in createFileRoute/createRootRoute
// silently breaks context/loader type inference without a tsc error.
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".wrangler/**",
      ".tanstack/**",
      "src/routeTree.gen.ts",
      "worker-configuration.d.ts",
      "scripts/**",
      // CLI-only seed script — runs via tsx in Node, prints progress to
      // stdout. Worker-runtime console rules don't apply.
      "src/db/seed-models.ts",
      // shadcn/ui primitives are copied from the shadcn registry with
      // documented a11y patterns that some lint rules flag as false
      // positives (label-has-associated-control matches Radix via asChild
      // rather than <input>). Don't lint vendor code.
      "src/components/ui/**",
    ],
  },
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  unicorn.configs["flat/recommended"],
  ...pluginQuery.configs["flat/recommended"],
  ...pluginRouter.configs["flat/recommended"],
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: "detect" },
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        }),
      ],
      // CF Workers virtual module — no on-disk file to resolve. Tell
      // import-x to treat it as external so it stops reporting it as
      // unresolved.
      "import-x/core-modules": ["cloudflare:workers"],
    },
    rules: {
      // Structured logging lives in src/lib/log.ts. Client error boundaries
      // and dev-only warnings may still use console warn/error with a
      // documented reason.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Underscore-prefixed names are intentional ignores.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // -- Unicorn opinions we reject --------------------------------------
      // Filename convention is kebab-case across this repo, but TanStack
      // Start's file-based router needs `$param`, `{-$param}`, and `__root`
      // literals — they don't match kebab-case. Turn the rule off rather
      // than allowlisting every variant.
      "unicorn/filename-case": "off",
      // `null` is the canonical "no row" signal from Drizzle queries and
      // a legal JSON atom; we use it intentionally.
      "unicorn/no-null": "off",
      // React event handler props are conventionally named `onX` — the
      // rule's preference clashes with ecosystem convention.
      "unicorn/no-useless-undefined": "off",
      // Prevents `for (const x of array)` in favour of forEach, but
      // readability is better with for-of for side-effect loops.
      "unicorn/no-array-for-each": "off",
      // We build interpolated strings often (SQL keys, message templates);
      // the no-nested-ternary + prefer-string-replace-all chain fires on
      // ergonomic code.
      "unicorn/prefer-string-replace-all": "off",
      // Prevents `.reduce()` as "complex" — used legitimately in credits
      // + webhook classifier reducers.
      "unicorn/no-array-reduce": "off",
      // Abbreviations like `env`, `ctx`, `db`, `fn` are idiomatic and
      // appear in every TanStack Start / CF Workers doc example.
      "unicorn/prevent-abbreviations": "off",
      // `new Array(n)` with `.map` is the terse way to build a fixed-size
      // array; the preferred alternative `Array.from` reads worse.
      "unicorn/no-new-array": "off",
      // `.toSorted()` is ES2023; our tsconfig target is ES2022 so the
      // DOM lib's typings differ (upgrading broke ArrayBuffer inference
      // in the fal tests). Use `[...arr].sort(…)` for immutable ordering
      // until we're ready to bump lib + settle the DOM iterable fallout.
      "unicorn/no-array-sort": "off",
      // `unicorn/prefer-spread` auto-fixes `.slice(0)` → `[...x]`, which
      // silently breaks ArrayBuffer copies (ArrayBuffer isn't iterable
      // under ES2022 DOM lib). `.slice()` is the idiomatic clone for both
      // arrays and buffers; leave it alone.
      "unicorn/prefer-spread": "off",
      // `prefer-dom-node-append` rewrites `appendChild()` → `append()`;
      // under @cloudflare/workers-types the latter's overload clashes
      // with Response/FormData `append` via type merging, so TS mis-picks
      // the wrong overload. Stick with the unambiguous DOM method.
      "unicorn/prefer-dom-node-append": "off",
      // `err` is our idiomatic catch name — matches the rest of the
      // ecosystem (TanStack docs, Better Auth, Stripe samples). Forcing
      // `error` is bikeshed.
      "unicorn/catch-error-name": "off",
      // `window.X` is clearer than `globalThis.X` in unambiguously-browser
      // code (popup window sizing, media queries). `globalThis` matters
      // for isomorphic modules — those already use it intentionally.
      "unicorn/prefer-global-this": "off",
      // Multiple `.push()` calls often read better than packing into one
      // call when interleaved with conditionals (see utils/seo.ts).
      "unicorn/prefer-single-call": "off",

      // -- import-x opinions -------------------------------------------------
      // Stripe SDK uses `export = Stripe` (CJS interop) so `import Stripe
      // from "stripe"` is the documented pattern, even though `Stripe` is
      // also a namespace export. Ignore this well-known intentional shape.
      "import-x/no-named-as-default": "off",
      // Allow default + named imports on same line (common for React).
      "import-x/no-default-export": "off",
      // TanStack Start route files must `export const Route = ...` AND
      // optionally default-export the component; no-anonymous-default is
      // fine but we don't care about default-export preference.
      "import-x/prefer-default-export": "off",
      // Circular-dep detection is worth it.
      "import-x/no-cycle": ["error", { maxDepth: 5, ignoreExternal: true }],
      // Consistent import order keeps diffs small.
      "import-x/order": [
        "warn",
        {
          "newlines-between": "never",
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          pathGroups: [
            { pattern: "@/**", group: "internal" },
            { pattern: "cloudflare:workers", group: "external", position: "before" },
          ],
        },
      ],

      // -- React opinions ----------------------------------------------------
      // We rely on jsx-runtime (already enabled above), so React import
      // is not required in TSX files.
      "react/react-in-jsx-scope": "off",
      // We fully type component props with TS interfaces; prop-types is
      // redundant (and CPU-costly) noise.
      "react/prop-types": "off",
    },
  },
  {
    // log.ts IS the logger wrapping console — full console access is the
    // whole point of the module.
    files: ["src/lib/log.ts"],
    rules: { "no-console": "off" },
  },
  {
    // Tests legitimately import a module twice (vi.mock + the subject
    // under test) to avoid hoisting order surprises.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "import-x/no-duplicates": "off",
      "import-x/order": "off",
    },
  },
);
