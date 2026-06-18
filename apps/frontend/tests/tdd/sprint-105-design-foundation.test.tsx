import fs from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'
import EmptyState from '@/components/EmptyState'
import {
  getRequestStatusDisplay,
  getRequestUrgencyDisplay,
} from '@/lib/requestDisplay'

const frontendRoot = path.join(process.cwd())
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8')

describe('Sprint 105 design foundation', () => {
  it('exposes the A-plus measure, radius, and small headline tokens', () => {
    const globals = readSource('src/styles/globals.css')
    const shell = readSource('src/styles/karmyq-shell.css')

    expect(globals).toMatch(/--measure\s*:/)
    expect(globals).toMatch(/--radius-card\s*:/)
    expect(shell).toMatch(/\.kq-headline-sm\b/)
  })

  it('keeps texture default-off or defers it entirely', () => {
    const globals = readSource('src/styles/globals.css')
    const shell = readSource('src/styles/karmyq-shell.css')
    const textureDefined = /--texture\s*:/.test(globals)

    if (!textureDefined) {
      expect(shell).not.toMatch(/kq-(?:texture|motif|leaf)/)
      return
    }

    expect(globals).toMatch(/--texture\s*:\s*none\s*;/)
    expect(shell).toMatch(/kq-(?:finite-state|section-divider|motif|leaf)/)
  })

  it('humanizes request status and urgency with semantic token classes', () => {
    expect(getRequestStatusDisplay('open')).toEqual({
      label: 'Open',
      className: 'text-primary-dark bg-primary-light border-primary-medium',
    })
    expect(getRequestStatusDisplay('dibs_pending').label).toBe('Dibs pending')
    expect(getRequestStatusDisplay('totally_new_state')).toEqual({
      label: 'Totally new state',
      className: 'text-text-muted bg-surface border-border',
    })

    expect(getRequestUrgencyDisplay('critical')).toEqual({
      label: 'Critical',
      className: 'text-error bg-error-light border-error',
    })
    expect(getRequestUrgencyDisplay('medium')).toEqual({
      label: 'Medium',
      className: 'text-warn bg-warn-light border-warn',
    })
    expect(getRequestUrgencyDisplay(null)).toEqual({
      label: 'Normal',
      className: 'text-text-muted bg-surface border-border',
    })
  })

  it('renders EmptyState with warm finite-state semantics and accessible actions', () => {
    render(
      <EmptyState
        icon="check"
        heading="You're caught up"
        body="No direct matches need you right now."
        ctaLabel="Browse communities"
        ctaHref="/communities"
      />,
    )

    expect(screen.getByRole('heading', { name: "You're caught up" })).toBeInTheDocument()
    expect(screen.getByText('No direct matches need you right now.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse communities' })).toHaveAttribute('href', '/communities')
    expect(screen.getByTestId('empty-state')).toHaveClass('kq-finite-state')
    expect(screen.getByText('check')).toHaveAttribute('aria-hidden', 'true')
  })
})
