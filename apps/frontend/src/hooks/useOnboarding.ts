import { useEffect, useState } from 'react';

const STORAGE_KEY = 'karmyq_onboarding';

function readSeenMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useOnboarding(workflowId: string): {
  shouldShow: boolean;
  markSeen: () => void;
} {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
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
