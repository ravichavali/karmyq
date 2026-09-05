The `production-deps` group bumps React Native packages past what Expo SDK 57 pins — `react-native`
0.87.1 vs 0.86.2, plus `react-native-maps`, `safe-area-context`, `reanimated`, `worklets`,
`screens`. Caught by `tests/regression/sprint-122-expo-sdk-alignment.test.ts`, with consequent
`TS2322`/`TS2769` errors in `apps/mobile`.

These packages are version-managed by the Expo SDK and must move as a set when the SDK moves.
`.github/dependabot.yml` has no `ignore` list for them, so the PR regenerates every week and the
gate fails it every week.

When adding that ignore list, **generate it from or verify it against the gate's `SDK_PINNED` map**.
A hand-copied YAML list is a shadow map and will drift.
