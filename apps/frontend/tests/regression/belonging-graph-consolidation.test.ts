import fs from 'fs'
import path from 'path'

/**
 * Sprint 111 — Belonging Graph consolidation guardrail (ADR-081).
 *
 * One renderer, one wrapper, no dead graph libraries. This locks the cleanup so the retired wrappers,
 * the cytoscape/react-force-graph dependencies, and the dead type shim can never quietly return.
 */

const FRONTEND_ROOT = path.resolve(__dirname, '../../')
const exists = (rel: string) => fs.existsSync(path.join(FRONTEND_ROOT, rel))

describe('retired graph wrappers are gone', () => {
  it.each([
    'src/components/NetworkGraph.tsx',
    'src/components/TrustGraph.tsx',
    'src/components/graphs/CommunityDepthGraph.tsx',
    'src/types/react-cytoscapejs.d.ts',
  ])('%s no longer exists', file => {
    expect(exists(file)).toBe(false)
  })
})

describe('the unified surfaces exist', () => {
  it.each([
    'src/pages/network.tsx',
    'src/components/BelongingGraph.tsx',
    'src/components/BelongingSection.tsx',
    'src/components/BelongingPulse.tsx',
    'src/components/graphs/types.ts',
    'src/components/graphs/normalizeGraphData.ts',
    'src/components/graphs/graphCanvasModel.ts',
    'src/components/graphs/GraphCanvas.tsx',
    'src/components/graphs/TrustGraphHEB.tsx',
  ])('%s exists', file => {
    expect(exists(file)).toBe(true)
  })
})

describe('belonging graph renderer dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(FRONTEND_ROOT, 'package.json'), 'utf8'))
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }

  it.each(['cytoscape', 'react-cytoscapejs', '@types/cytoscape'])(
    '%s remains retired',
    dep => {
      expect(allDeps[dep]).toBeUndefined()
    }
  )

  it('uses react-force-graph-2d as the Phase 1 canvas renderer', () => {
    expect(allDeps['react-force-graph-2d']).toBe('1.29.1')
  })

  it('keeps d3 available for force/layout helpers, but not as the sole renderer', () => {
    expect(allDeps['d3']).toBeDefined()
  })
})

describe('no source imports the retired wrappers', () => {
  const collect = (dir: string, acc: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) collect(full, acc)
      else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full)
    }
    return acc
  }

  it('does not import NetworkGraph, TrustGraph, or CommunityDepthGraph anywhere in src', () => {
    const offenders: string[] = []
    for (const file of collect(path.join(FRONTEND_ROOT, 'src'))) {
      const src = fs.readFileSync(file, 'utf8')
      if (/import[^\n]+['"][^'"]*\/(NetworkGraph|CommunityDepthGraph)['"]/.test(src)) offenders.push(file)
      if (/import[^\n]+['"]@\/components\/TrustGraph['"]/.test(src)) offenders.push(file)
      if (/import[^\n]+['"]\.\.?\/(TrustGraph|NetworkGraph)['"]/.test(src)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})
