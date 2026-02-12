/**
 * Generic Request Form Component
 * For help requests that don't fit specialized types
 */

import React from 'react'

interface GenericRequestFormProps {
  // Generic requests don't have payload, just showing consistency with other forms
  onChange?: (payload: Record<string, never>) => void
}

export default function GenericRequestForm(_props: GenericRequestFormProps) {
  // No useEffect needed - payload is already initialized to {} in the parent component

  return (
    <div className="space-y-6">
      {/* Generic Request Header */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="font-semibold text-text mb-1">🤝 General Help Request</h3>
        <p className="text-sm text-text-muted">
          Request help for anything that doesn't fit other categories
        </p>
      </div>

      {/* Guidance */}
      <div className="bg-primary-light border border-primary-medium rounded-lg p-4">
        <h4 className="font-medium text-primary-dark mb-2">💡 What to Include</h4>
        <p className="text-sm text-primary-dark mb-3">
          Generic requests work best when you provide clear details in the title and description:
        </p>
        <ul className="text-sm text-primary-dark space-y-2">
          <li className="flex items-start space-x-2">
            <span className="flex-shrink-0">✓</span>
            <span><strong>What you need:</strong> Be specific about the type of help</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="flex-shrink-0">✓</span>
            <span><strong>When:</strong> Include timing details (urgent, flexible, etc.)</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="flex-shrink-0">✓</span>
            <span><strong>Where:</strong> Mention location if relevant</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="flex-shrink-0">✓</span>
            <span><strong>How long:</strong> Estimated time commitment</span>
          </li>
        </ul>
      </div>

      {/* Examples */}
      <div>
        <h4 className="font-medium text-text mb-3">📝 Example Requests</h4>
        <div className="space-y-3">
          <div className="border border-border rounded-lg p-3 bg-surface-raised">
            <div className="font-medium text-text mb-1">Help moving boxes to storage unit</div>
            <p className="text-sm text-text-muted">
              Need a strong person to help move 10-15 boxes to a storage unit 2 miles away.
              Should take about 1 hour this Saturday morning.
            </p>
          </div>

          <div className="border border-border rounded-lg p-3 bg-surface-raised">
            <div className="font-medium text-text mb-1">Pet sitting for weekend trip</div>
            <p className="text-sm text-text-muted">
              Going out of town June 15-17 and need someone to feed my cat twice daily and
              scoop the litter box. Very friendly cat, no special needs.
            </p>
          </div>

          <div className="border border-border rounded-lg p-3 bg-surface-raised">
            <div className="font-medium text-text mb-1">Help assembling IKEA furniture</div>
            <p className="text-sm text-text-muted">
              Bought a new desk and bookshelf from IKEA but struggling with assembly.
              Need someone handy with tools to help for 2-3 hours tomorrow afternoon.
            </p>
          </div>
        </div>
      </div>

      {/* Category Suggestions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-900 mb-2">💭 Consider Other Categories</h4>
        <p className="text-sm text-yellow-800 mb-2">
          Your request might fit better in a specialized category:
        </p>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• <strong>Ride:</strong> Need transportation to a specific place?</li>
          <li>• <strong>Service:</strong> Need professional skills (repair, tutoring, etc.)?</li>
          <li>• <strong>Event:</strong> Organizing volunteers for an activity?</li>
          <li>• <strong>Borrow:</strong> Need to temporarily use someone's equipment?</li>
        </ul>
        <p className="text-xs text-yellow-700 mt-2">
          You can go back and change the request type if needed
        </p>
      </div>

      {/* No additional fields needed */}
      <div className="bg-surface border border-border rounded-lg p-4 text-center">
        <p className="text-sm text-text-muted">
          Generic requests only need a <strong>title</strong> and <strong>description</strong>.
          <br />
          Fill those in above to complete your request.
        </p>
      </div>
    </div>
  )
}
