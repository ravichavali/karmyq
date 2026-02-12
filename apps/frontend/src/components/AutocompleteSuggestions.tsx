/**
 * Autocomplete Suggestions Component
 * Shows contextual suggestions when typing @, #, $, ! shortcuts
 */

import React, { useRef, useEffect } from 'react'

interface Suggestion {
  value: string
  label: string
  description?: string
  icon?: string
}

interface AutocompleteSuggestionsProps {
  suggestions: Suggestion[]
  onSelect: (value: string) => void
  onClose: () => void
  triggerChar: '@' | '#' | '$' | '!' | '..' | '>>' | null
  position?: { top: number; left: number }
}

export default function AutocompleteSuggestions({
  suggestions,
  onSelect,
  onClose,
  triggerChar,
  position
}: AutocompleteSuggestionsProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedIndex(0)
  }, [suggestions])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestions.length) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % suggestions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          onSelect(suggestions[selectedIndex].value)
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [suggestions, selectedIndex, onSelect, onClose])

  if (!suggestions.length) return null

  const getTriggerColor = () => {
    switch (triggerChar) {
      case '@': return 'bg-primary-light border-primary-medium'
      case '#': return 'bg-success-light border-success'
      case '$': return 'bg-yellow-50 border-yellow-200'
      case '!': return 'bg-red-50 border-red-200'
      case '..':
      case '>>': return 'bg-accent-light border-accent'
      default: return 'bg-surface border-border'
    }
  }

  const getTriggerLabel = () => {
    switch (triggerChar) {
      case '@': return 'Locations & Times'
      case '#': return 'Counts'
      case '$': return 'Budget'
      case '!': return 'Urgency'
      case '..': return 'Origin'
      case '>>': return 'Destination'
      default: return 'Suggestions'
    }
  }

  return (
    <div
      ref={listRef}
      className={`absolute z-50 mt-1 w-72 rounded-lg shadow-lg border-2 ${getTriggerColor()} overflow-hidden`}
      style={position}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-surface-raised">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-muted">
            {getTriggerLabel()}
          </span>
          <span className="text-xs text-text-subtle">
            ↑↓ navigate · ↵ select · esc close
          </span>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="max-h-64 overflow-y-auto bg-surface-raised">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.value}
            type="button"
            onClick={() => onSelect(suggestion.value)}
            className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${
              index === selectedIndex
                ? 'bg-primary-light text-primary-dark'
                : 'hover:bg-surface text-text'
            }`}
          >
            {suggestion.icon && (
              <span className="text-lg flex-shrink-0">{suggestion.icon}</span>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{suggestion.label}</div>
              {suggestion.description && (
                <div className="text-xs text-text-muted mt-0.5">
                  {suggestion.description}
                </div>
              )}
            </div>
            {index === selectedIndex && (
              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Footer Hint */}
      <div className="px-3 py-2 bg-surface border-t border-border">
        <p className="text-xs text-text-muted">
          💡 Tip: Keep typing to filter suggestions
        </p>
      </div>
    </div>
  )
}
