module.exports = {
  extends: ["expo", "prettier"],
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": "warn",
    // Disable rules that don't exist in current @typescript-eslint version
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-wrapper-object-types": "off",
  },
};
