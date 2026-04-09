export interface OnboardingStep {
  title: string;
  body: string;
}

export interface WorkflowDef {
  id: string;
  workflowTitle: string;
  steps: OnboardingStep[];
}

export const WORKFLOWS: Record<string, WorkflowDef> = {
  feed: {
    id: 'feed',
    workflowTitle: 'Your Feed',
    steps: [
      {
        title: 'What is the feed?',
        body: 'The feed shows help requests posted by people in your communities. Posts surface based on urgency, your trust relationships, and community relevance.',
      },
      {
        title: 'Responding to a request',
        body: 'Tap any request to offer help, ask a question, or pass it along. Your response is visible to the requester and tied to your reputation.',
      },
      {
        title: 'Commitments',
        body: "When a requester accepts your offer, it becomes a commitment — trackable for both sides in the Commitments tab.",
      },
    ],
  },
  communities: {
    id: 'communities',
    workflowTitle: 'Communities',
    steps: [
      {
        title: 'What is a community?',
        body: 'Communities are the core unit of Karmyq. Your help requests, reputation, and trust relationships are all rooted in the communities you belong to.',
      },
      {
        title: 'Two types of community',
        body: 'Mutual aid communities connect neighbours to share help and resources. Group communities organise around shared activities — think sports teams, book clubs, or fitness groups.',
      },
      {
        title: 'Joining and creating',
        body: 'Join a public community instantly, or request access to a private one. You can also create your own and invite people you trust.',
      },
    ],
  },
  requests: {
    id: 'requests',
    workflowTitle: 'Help Requests',
    steps: [
      {
        title: 'What is a request?',
        body: 'A request is how you ask your communities for help — a ride, a favour, a skill, or anything else. Requests are visible to community members and matched to people who can help.',
      },
      {
        title: 'Request types',
        body: 'Karmyq supports several request types: general help, rides, services, events, and borrows. Each type has fields tailored to that kind of ask.',
      },
      {
        title: 'Trust and matching',
        body: 'The platform uses your trust relationships to surface the most relevant helpers. Higher trust means faster, more reliable matches.',
      },
    ],
  },
  activities: {
    id: 'activities',
    workflowTitle: 'Activities',
    steps: [
      {
        title: 'What are activities?',
        body: "Activities are scheduled events organised by a group community — a training session, meetup, or recurring event. They appear here for communities you've joined.",
      },
      {
        title: 'Joining an activity',
        body: 'Tap an activity to see the details and join. Capacity is limited, so spots are first-come first-served. Joining earns karma and reinforces your standing in the group.',
      },
    ],
  },
};
