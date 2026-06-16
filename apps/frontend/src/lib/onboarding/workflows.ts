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
        body: 'Each card shows the requester (the colored circle is their initial — "Asked by …"), your trust path and their Karma, and an explainable match score like "42% · 2nd-degree trust" — never a bare number. Tap anywhere on a card to open its full detail page, which shows the ask and the one action available to you right now — offer to help, or, if you can\'t act on it, why.',
      },
      {
        title: "Offers you're waiting on",
        body: "When you've offered to help on open asks, Home shows them as a small preview — the actual asks, each linking to its detail — so you can pick up where you left off. They're waiting on the requester to respond, not on you; the full list lives in the Helping tab.",
      },
      {
        title: "You're caught up",
        body: "When there are no direct matches for you, the feed shows one honest, calm message — \"You're caught up\" — and points you to your communities, which may still have open asks waiting. It doesn't pretend there's nothing left or push a \"show more\" nudge.",
      },
      {
        title: 'The same feed inside a community',
        body: "A community's Home tab shows the very same cards, scoped to that community — the community's open asks, not a sample of finished exchanges. There's no \"needs your response\" band there (decisions are personal). Above the asks, the warm hero carries a \"this week in the neighbourhood\" pulse, and the occasional story of a neighbour's first exchange appears below.",
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
      {
        title: 'Relationships that fade — and how to keep them',
        body: "Karmyq is designed to forget. On How we're connected, a How memory fades legend explains why some bonds look softer, and a gentle, optional nudge invites you to reconnect with one that's close to being let go — or you can let it fade. Your profile's memory section shows the same in plain words — active bonds you're tending, ones going quiet, and ones nearly forgotten — even when your karma display is off. The What Karmyq Remembers page explains exactly what's kept versus let go. Forgetting the details never touches your karma or trust.",
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
