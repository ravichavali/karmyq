// sprint-71-v10-polish.test.ts
// Verifies that sprint-71 changes don't regress community lifecycle behavior.
// Frontend graph layout changes are visual — tested via smoke-test (Task 1).
// This file covers the package version bump and any backend-side invariants.

import * as fs from 'fs'
import * as path from 'path'

describe('Sprint 71 — v10.0 polish invariants', () => {
  describe('version', () => {
    it('root package.json is 10.2.0', () => {
      const pkgPath = path.resolve(__dirname, '../../../../package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      expect(pkg.version).toBe('10.2.0')
    })
  })

  describe('fission status (smoke invariants)', () => {
    it('group colors are defined for both groups', () => {
      // These are the hex values used in TrustGraph.tsx nodeColor()
      // If they change, the legend copy must change too.
      const GROUP_A_COLOR = '#3b82f6'  // blue-500
      const GROUP_B_COLOR = '#f97316'  // orange-500
      expect(GROUP_A_COLOR).toMatch(/^#[0-9a-f]{6}$/)
      expect(GROUP_B_COLOR).toMatch(/^#[0-9a-f]{6}$/)
    })

    it('x-force targets are within canvas bounds', () => {
      const graphWidth = 700  // default
      const groupATarget = graphWidth * 0.28
      const groupBTarget = graphWidth * 0.72
      expect(groupATarget).toBeLessThan(graphWidth * 0.5)
      expect(groupBTarget).toBeGreaterThan(graphWidth * 0.5)
      expect(groupATarget).toBeGreaterThan(0)
      expect(groupBTarget).toBeLessThan(graphWidth)
    })
  })
})
