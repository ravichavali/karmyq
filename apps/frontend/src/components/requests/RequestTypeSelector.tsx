/**
 * Request Type Selector Component
 * Allows users to choose which type of request to create
 */

import React from 'react'

export type RequestType = 'generic' | 'ride' | 'service' | 'event' | 'borrow'

interface RequestTypeOption {
  value: RequestType
  label: string
  description: string
  example: string
  icon: string
  color: string
  mostUsed?: boolean
}

export const REQUEST_TYPES: RequestTypeOption[] = [
  {
    value: 'generic',
    label: 'General Help',
    description: 'Any help that doesn\'t fit other categories',
    example: 'e.g., moving furniture, advice, quick tasks',
    icon: '🤝',
    color: 'bg-gray-100 border-gray-300 hover:border-gray-500',
    mostUsed: true
  },
  {
    value: 'ride',
    label: 'Ride Share',
    description: 'Need a ride to a specific destination',
    example: 'e.g., ride to airport, grocery store pickup',
    icon: '🚗',
    color: 'bg-blue-50 border-blue-300 hover:border-blue-500'
  },
  {
    value: 'service',
    label: 'Service Request',
    description: 'Professional services, repairs, tutoring',
    example: 'e.g., plumbing, teaching, tech help',
    icon: '🔧',
    color: 'bg-green-50 border-green-300 hover:border-green-500'
  },
  {
    value: 'event',
    label: 'Event Help',
    description: 'Volunteers for community events',
    example: 'e.g., food drive, cleanup day, fundraiser',
    icon: '🎉',
    color: 'bg-purple-50 border-purple-300 hover:border-purple-500'
  },
  {
    value: 'borrow',
    label: 'Borrow Item',
    description: 'Temporarily borrow tools or equipment',
    example: 'e.g., ladder, power drill, camping gear',
    icon: '📦',
    color: 'bg-orange-50 border-orange-300 hover:border-orange-500'
  }
]

interface RequestTypeSelectorProps {
  selectedType: RequestType | null
  onSelectType: (type: RequestType) => void
  showExamples?: boolean
}

export default function RequestTypeSelector({ selectedType, onSelectType, showExamples = false }: RequestTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">What type of help do you need?</h2>
        <p className="text-sm text-gray-600">Choose the category that best fits your request</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REQUEST_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onSelectType(type.value)}
            className={`
              relative p-6 border-2 rounded-lg text-left transition-all
              ${selectedType === type.value
                ? 'ring-2 ring-blue-500 border-blue-500 shadow-md'
                : type.color
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          >
            {/* Most Used Badge */}
            {type.mostUsed && (
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Most used
                </span>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <span className="text-3xl flex-shrink-0">{type.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {type.label}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  {type.description}
                </p>
                {showExamples && (
                  <p className="text-xs text-gray-500 italic">
                    {type.example}
                  </p>
                )}
              </div>
            </div>

            {selectedType === type.value && (
              <div className="absolute bottom-3 right-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedType && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-1">Selected: {REQUEST_TYPES.find(t => t.value === selectedType)?.label}</h4>
              <p className="text-sm text-blue-700">Click another type to change, or continue below</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
