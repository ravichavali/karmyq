import fs from 'fs'
import path from 'path'

const FRONTEND_ROOT = path.resolve(__dirname, '../..')

const exists = (relativePath: string) => fs.existsSync(path.join(FRONTEND_ROOT, relativePath))

describe('S114 renderer files', () => {
  it.each([
    'src/components/graphs/BelongingGraphRenderer.tsx',
  ])('%s exists before regression promotion', relativePath => {
    expect(exists(relativePath)).toBe(true)
  })
})

describe('S114 retired renderers', () => {
  it.each([
    'src/components/graphs/TrustGraphHEB.tsx',
    'src/components/graphs/CommunityHubGraph.tsx',
  ])('%s is retired before regression promotion', relativePath => {
    expect(exists(relativePath)).toBe(false)
  })
})
