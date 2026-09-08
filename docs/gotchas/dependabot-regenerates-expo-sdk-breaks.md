Sprint 128 adds explicit version-update ignores for SDK-managed dependencies. The regression
`tests/regression/sprint-122-expo-sdk-alignment.test.ts` parses the real Dependabot YAML and
requires exact identity equality with its SDK inventory plus Expo-family mobile declarations,
excluding independently versioned packages. Negative fixtures catch missing, extra, renamed and
duplicate entries and absent/incomplete update types. These are version-update ignores; security
advisory updates remain enabled and still require review.

Verified against [Dependabot's ignore-condition implementation](https://github.com/dependabot/dependabot-core/blob/main/common/lib/dependabot/config/ignore_condition.rb):
security-only jobs use explicit ignored version ranges, while update-type exclusions apply to
version jobs. Our entries specify the three update types and no `versions` ranges.

Historical failure: the `production-deps` group bumped React Native packages past what Expo SDK 57 pinned — `react-native`
0.87.1 vs 0.86.2, plus `react-native-maps`, `safe-area-context`, `reanimated`, `worklets`,
`screens`. Caught by `tests/regression/sprint-122-expo-sdk-alignment.test.ts`, with consequent
`TS2322`/`TS2769` errors in `apps/mobile`.

These packages are version-managed by the Expo SDK and must move as a set when the SDK moves.
Without `.github/dependabot.yml`'s SDK ignore list, the PR regenerates every week and the gate
fails it every week.

When adding that ignore list, **generate it from or verify it against the gate's `SDK_PINNED` map**.
A hand-copied YAML list is a shadow map and will drift.
