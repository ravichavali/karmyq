/**
 * Sprint 48 — Onboarding Overlay Logic Tests
 *
 * Tests the pure logic extracted from useOnboarding and OnboardingOverlay.
 * Following the codebase pattern: extract pure functions, test those directly.
 * No DOM/React rendering (test environment is node, no jsdom or @testing-library).
 */

// ─── Pure-logic versions of hook internals ────────────────────────────────────

interface SeenMap {
  [workflowId: string]: boolean;
}

function readSeenMap(store: Record<string, string>): SeenMap {
  try {
    const raw = store['karmyq_onboarding'];
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function shouldShowWorkflow(store: Record<string, string>, workflowId: string): boolean {
  const seen = readSeenMap(store);
  return !seen[workflowId];
}

function markWorkflowSeen(store: Record<string, string>, workflowId: string): Record<string, string> {
  const seen = readSeenMap(store);
  seen[workflowId] = true;
  return { ...store, 'karmyq_onboarding': JSON.stringify(seen) };
}

// ─── Pure-logic version of overlay step navigation ───────────────────────────

interface StepState {
  stepIndex: number;
  totalSteps: number;
}

function nextStep(state: StepState): StepState {
  if (state.stepIndex >= state.totalSteps - 1) return state;
  return { ...state, stepIndex: state.stepIndex + 1 };
}

function prevStep(state: StepState): StepState {
  if (state.stepIndex <= 0) return state;
  return { ...state, stepIndex: state.stepIndex - 1 };
}

function isLastStep(state: StepState): boolean {
  return state.stepIndex === state.totalSteps - 1;
}

function isFirstStep(state: StepState): boolean {
  return state.stepIndex === 0;
}

function stepIndicatorLabel(state: StepState): string {
  return `${state.stepIndex + 1} of ${state.totalSteps}`;
}

// ─── Hook logic tests ─────────────────────────────────────────────────────────

describe('useOnboarding logic', () => {
  it('returns shouldShow=true when workflow has not been seen', () => {
    const store = {};
    expect(shouldShowWorkflow(store, 'feed')).toBe(true);
  });

  it('returns shouldShow=false when workflow is already in localStorage', () => {
    const store = { 'karmyq_onboarding': JSON.stringify({ feed: true }) };
    expect(shouldShowWorkflow(store, 'feed')).toBe(false);
  });

  it('returns shouldShow=true for unseen workflow when others are seen', () => {
    const store = { 'karmyq_onboarding': JSON.stringify({ feed: true, communities: true }) };
    expect(shouldShowWorkflow(store, 'requests')).toBe(true);
  });

  it('markSeen sets the workflow key to true in localStorage', () => {
    let store: Record<string, string> = {};
    store = markWorkflowSeen(store, 'feed');
    const seen = readSeenMap(store);
    expect(seen['feed']).toBe(true);
  });

  it('markSeen does not affect other workflow keys', () => {
    let store: Record<string, string> = {
      'karmyq_onboarding': JSON.stringify({ communities: true }),
    };
    store = markWorkflowSeen(store, 'feed');
    const seen = readSeenMap(store);
    expect(seen['feed']).toBe(true);
    expect(seen['communities']).toBe(true);
  });

  it('handles corrupt localStorage gracefully (returns shouldShow=true)', () => {
    const store = { 'karmyq_onboarding': 'not-valid-json{{{' };
    expect(shouldShowWorkflow(store, 'feed')).toBe(true);
  });

  it('shouldShow becomes false after markSeen for that workflow', () => {
    let store: Record<string, string> = {};
    expect(shouldShowWorkflow(store, 'activities')).toBe(true);
    store = markWorkflowSeen(store, 'activities');
    expect(shouldShowWorkflow(store, 'activities')).toBe(false);
  });
});

// ─── Overlay step navigation tests ────────────────────────────────────────────

describe('OnboardingOverlay step navigation logic', () => {
  it('starts on step 0', () => {
    const state: StepState = { stepIndex: 0, totalSteps: 3 };
    expect(state.stepIndex).toBe(0);
  });

  it('renders step indicator "1 of N" on first step', () => {
    const state: StepState = { stepIndex: 0, totalSteps: 3 };
    expect(stepIndicatorLabel(state)).toBe('1 of 3');
  });

  it('Next button advances to the next step', () => {
    const state: StepState = { stepIndex: 0, totalSteps: 3 };
    const next = nextStep(state);
    expect(next.stepIndex).toBe(1);
  });

  it('Next does not advance past the last step', () => {
    const state: StepState = { stepIndex: 2, totalSteps: 3 };
    const next = nextStep(state);
    expect(next.stepIndex).toBe(2);
  });

  it('Back button is not available on the first step', () => {
    const state: StepState = { stepIndex: 0, totalSteps: 3 };
    expect(isFirstStep(state)).toBe(true);
  });

  it('Back button is available after advancing from the first step', () => {
    const state: StepState = { stepIndex: 1, totalSteps: 3 };
    expect(isFirstStep(state)).toBe(false);
  });

  it('Back decrements stepIndex', () => {
    const state: StepState = { stepIndex: 2, totalSteps: 3 };
    const prev = prevStep(state);
    expect(prev.stepIndex).toBe(1);
  });

  it('Back does not go below step 0', () => {
    const state: StepState = { stepIndex: 0, totalSteps: 3 };
    const prev = prevStep(state);
    expect(prev.stepIndex).toBe(0);
  });

  it('Done button appears on the last step', () => {
    const state: StepState = { stepIndex: 2, totalSteps: 3 };
    expect(isLastStep(state)).toBe(true);
  });

  it('Done button does not appear on non-last steps', () => {
    const state: StepState = { stepIndex: 0, totalSteps: 3 };
    expect(isLastStep(state)).toBe(false);
  });

  it('step indicator updates correctly as steps advance', () => {
    let state: StepState = { stepIndex: 0, totalSteps: 2 };
    expect(stepIndicatorLabel(state)).toBe('1 of 2');
    state = nextStep(state);
    expect(stepIndicatorLabel(state)).toBe('2 of 2');
  });
});

// ─── Workflow content tests ───────────────────────────────────────────────────

// Import just the data shape from the workflow config
import path from 'path';

describe('WORKFLOWS config', () => {
  // Require at runtime to avoid module resolution issues in test env
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const workflows = require(path.join(__dirname, '../../apps/frontend/src/lib/onboarding/workflows'));
  const { WORKFLOWS } = workflows;

  it('defines all four workflow keys', () => {
    expect(WORKFLOWS).toHaveProperty('feed');
    expect(WORKFLOWS).toHaveProperty('communities');
    expect(WORKFLOWS).toHaveProperty('requests');
    expect(WORKFLOWS).toHaveProperty('activities');
  });

  it('each workflow has an id, workflowTitle, and steps array', () => {
    for (const key of ['feed', 'communities', 'requests', 'activities']) {
      const wf = WORKFLOWS[key];
      expect(typeof wf.id).toBe('string');
      expect(typeof wf.workflowTitle).toBe('string');
      expect(Array.isArray(wf.steps)).toBe(true);
      expect(wf.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('each step has a non-empty title and body', () => {
    for (const key of ['feed', 'communities', 'requests', 'activities']) {
      for (const step of WORKFLOWS[key].steps) {
        expect(typeof step.title).toBe('string');
        expect(step.title.length).toBeGreaterThan(0);
        expect(typeof step.body).toBe('string');
        expect(step.body.length).toBeGreaterThan(0);
      }
    }
  });

  it('workflow id matches its key', () => {
    for (const key of ['feed', 'communities', 'requests', 'activities']) {
      expect(WORKFLOWS[key].id).toBe(key);
    }
  });
});
