// Flat config (ESLint 9). Replaces .eslintrc.js.
const expoFlat = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");
const prettierPlugin = require("eslint-plugin-prettier");
const reactHooks = require("eslint-plugin-react-hooks");

// eslint-config-expo bundles eslint-plugin-react-hooks 5.x, but this workspace declares 7.x
// and the v7-only rules (immutability, set-state-in-effect, preserve-manual-memoization)
// are part of our lint baseline. ESLint 9 refuses to bind two instances of the same plugin
// name ("Cannot redefine plugin"), so drop expo's registration and its react-hooks rules
// here, then re-add the declared v7 plugin below.
const expoWithoutReactHooks = expoFlat.map((config) => {
  if (!config.plugins || !config.plugins["react-hooks"]) return config;
  const { "react-hooks": _expoReactHooks, ...plugins } = config.plugins;
  const rules = Object.fromEntries(
    Object.entries(config.rules ?? {}).filter(
      ([rule]) => !rule.startsWith("react-hooks/"),
    ),
  );
  return { ...config, plugins, rules };
});

module.exports = [
  {
    ignores: [
      ".expo/**",
      "android/**",
      "ios/**",
      "dist/**",
      "coverage/**",
      "expo-env.d.ts",
    ],
  },
  ...expoWithoutReactHooks,
  // Must be `configs.flat.*` — the top-level `configs.recommended` is still the legacy
  // eslintrc shape (plugins as an array) and ESLint 9 rejects it outright.
  // `recommended` (not `recommended-latest`) — the latter adds void-use-memo.
  reactHooks.configs.flat.recommended,
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      "prettier/prettier": "warn",
      // These exist in @typescript-eslint 8 (they did not in the 6.x line this config was
      // written against). Kept off deliberately — turning them on is its own cleanup.
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
    },
  },
];
