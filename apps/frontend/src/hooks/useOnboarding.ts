import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'karmyq_onboarding';

function readSeenMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

interface UseOnboardingOptions {
  /**
   * Sprint 120 PR C (F-1): another first-run overlay owns this visit, so this workflow tour must
   * stay closed — a cleared client used to get the 3-step welcome modal AND a 7-step feed tour
   * stacked before any content was visible. Read ONCE at mount on purpose: when the other overlay
   * is dismissed the flag flips, and re-showing then would just re-create the stack. The tour is
   * not marked seen, so it appears on the next visit.
   */
  suppressed?: boolean;
}

export function useOnboarding(
  workflowId: string,
  options: UseOnboardingOptions = {}
): {
  shouldShow: boolean;
  markSeen: () => void;
} {
  const [shouldShow, setShouldShow] = useState(false);
  const suppressedAtMount = useRef(options.suppressed ?? false);

  useEffect(() => {
    if (suppressedAtMount.current) return;
    const seen = readSeenMap();
    if (!seen[workflowId]) {
      setShouldShow(true);
    }
  }, [workflowId]);

  const markSeen = () => {
    const seen = readSeenMap();
    seen[workflowId] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    setShouldShow(false);
  };

  return { shouldShow, markSeen };
}
