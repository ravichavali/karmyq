// Flat config (ESLint 9). Replaces .eslintrc.js.
const expoFlat = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");
const prettierPlugin = require("eslint-plugin-prettier");

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
  // eslint-config-expo 57 depends on eslint-plugin-react-hooks ^7 and registers it itself.
  ...expoFlat,
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
