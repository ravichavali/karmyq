/**
 * Sprint 136 (#180/#179): the Babel alias plugin is gone. Metro resolves `@/` from tsconfig `paths`
 * (@expo/cli instantiateMetro.js:291), and jest from jest.config.js `moduleNameMapper`. This proves the jest half.
 *
 * `config/api.ts` imports nothing native, so jest's `node` environment loads it without a mock.
 * Identity, not "defined": if the alias resolved to a different file, or to a second copy of the module, the two
 * objects would differ.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const viaAlias = require("@/config/api");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const viaPath = require("../../config/api");

describe("Sprint 136: @/ resolves in jest without babel-plugin-module-resolver", () => {
  it("loads the same module through the alias as through the relative path", () => {
    expect(viaAlias).toBe(viaPath);
  });

  it("the module it loads is config/api (API_CONFIG.AUTH_URL ends in :3001)", () => {
    expect(viaAlias.API_CONFIG.AUTH_URL).toMatch(/:3001$/);
  });

  // tsconfig maps `@/shared/*` to packages/shared, and Metro takes the longest prefix first. jest must agree, or an
  // `@/shared` import type-checks and bundles but fails only under jest.
  it("resolves @/shared/* to packages/shared, as tsconfig paths and Metro do", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("path");
    expect(require.resolve("@/shared/package.json")).toBe(
      join(__dirname, "../../../../packages/shared/package.json"),
    );
  });
});
