import { useState } from 'react';
import { WorkflowDef } from '@/lib/onboarding/workflows';

interface OnboardingOverlayProps {
  workflow: WorkflowDef;
  onDismiss: () => void;
}

export default function OnboardingOverlay({ workflow, onDismiss }: OnboardingOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = workflow.steps;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={workflow.workflowTitle}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">{workflow.workflowTitle}</h2>
          <span className="text-sm text-text-muted">
            {stepIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Step content */}
        <div className="mb-6">
          <h3 className="text-base font-medium text-text mb-2">{step.title}</h3>
          <p className="text-sm text-text-muted leading-relaxed">{step.body}</p>
        </div>

        {/* Step indicator dots */}
        <div className="flex gap-1.5 justify-center mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === stepIndex ? 'bg-primary' : 'bg-surface-raised'}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onDismiss}
            className="text-sm text-text-muted hover:text-text transition-colors"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex(i => i - 1)}
                className="px-4 py-2 text-sm rounded-lg border border-border text-text hover:bg-surface-raised transition-colors"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                onClick={() => setStepIndex(i => i + 1)}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
