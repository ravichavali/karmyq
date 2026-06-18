export interface RequestDisplayToken {
  label: string
  className: string
}

const DEFAULT_DISPLAY: RequestDisplayToken = {
  label: 'Unknown',
  className: 'text-text-muted bg-surface border-border',
}

const STATUS_DISPLAY: Record<string, RequestDisplayToken> = {
  open: {
    label: 'Open',
    className: 'text-primary-dark bg-primary-light border-primary-medium',
  },
  active: {
    label: 'Active',
    className: 'text-primary-dark bg-primary-light border-primary-medium',
  },
  proposed: {
    label: 'Awaiting response',
    className: 'text-accent-dark bg-accent-light border-accent',
  },
  matched: {
    label: 'Matched',
    className: 'text-accent-dark bg-accent-light border-accent',
  },
  dibs_pending: {
    label: 'Dibs pending',
    className: 'text-warn bg-warn-light border-warn',
  },
  completed: {
    label: 'Completed',
    className: 'text-success bg-success-light border-success',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'text-text-muted bg-surface border-border',
  },
  withdrawn: {
    label: 'Withdrawn',
    className: 'text-text-muted bg-surface border-border',
  },
  expired: {
    label: 'Expired',
    className: 'text-text-muted bg-surface border-border',
  },
}

const URGENCY_DISPLAY: Record<string, RequestDisplayToken> = {
  critical: {
    label: 'Critical',
    className: 'text-error bg-error-light border-error',
  },
  urgent: {
    label: 'Urgent',
    className: 'text-error bg-error-light border-error',
  },
  high: {
    label: 'High',
    className: 'text-warn bg-warn-light border-warn',
  },
  medium: {
    label: 'Medium',
    className: 'text-warn bg-warn-light border-warn',
  },
  normal: {
    label: 'Normal',
    className: DEFAULT_DISPLAY.className,
  },
  low: {
    label: 'Low',
    className: DEFAULT_DISPLAY.className,
  },
}

function humanizeToken(value?: string | null): string {
  if (!value) return DEFAULT_DISPLAY.label
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
}

export function getRequestStatusDisplay(status?: string | null): RequestDisplayToken {
  if (!status) return DEFAULT_DISPLAY
  return STATUS_DISPLAY[status] ?? {
    label: humanizeToken(status),
    className: DEFAULT_DISPLAY.className,
  }
}

export function getRequestUrgencyDisplay(urgency?: string | null): RequestDisplayToken {
  if (!urgency) {
    return {
      label: 'Normal',
      className: DEFAULT_DISPLAY.className,
    }
  }
  return URGENCY_DISPLAY[urgency] ?? {
    label: humanizeToken(urgency),
    className: DEFAULT_DISPLAY.className,
  }
}
