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
        title: 'One feed, ordered by what needs you',
        body: 'Dashboard Home is a single feed. The decisions you owe rise to the top; the requests you can fill follow, ranked by your skills, trust path, and urgency.',
      },
      {
        title: 'Needs your response',
        body: 'A band at the very top surfaces the responses you owe right now — an offer to accept or decline, your own offer to withdraw, a reserved request to confirm, or a finished exchange to mark done. It disappears when you are all caught up.',
      },
      {
        title: 'Requests you can fill',
        body: 'Each card shows the requester, your trust path and their Karma, and an explainable match score like "42% · 2nd-degree trust" — never a bare number. Tap Offer to Help to send your offer; track it in the Helping tab.',
      },
      {
        title: "You're caught up",
        body: 'When there are no open requests you can fill, the feed says so and points you to your communities — instead of padding the list.',
      },
      {
        title: 'The same feed inside a community',
        body: "A community's Home tab shows the very same cards, scoped to that community. There's no \"needs your response\" band there (decisions are personal). Above the asks, the warm hero carries a \"this week in the neighbourhood\" pulse, and the occasional story of a neighbour's first exchange appears below.",
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
      {
        title: 'Finding your way around',
        body: "A community opens on warm Home — its hero, the weekly pulse, and the open asks. People shows who's here and the trust between you; How we're connected is the trust graph; Stewardship is where shared decisions, splits, merges, and (for admins) the management tools live.",
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
