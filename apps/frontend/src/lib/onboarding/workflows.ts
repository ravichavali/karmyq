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
        title: 'A feed ordered by what fits you',
        body: 'Dashboard Home shows the requests you can fill, ranked by your skills, trust path, and urgency. The decisions you owe live one tap away in the Helping tab — Home stays focused on asks you can pick up.',
      },
      {
        title: 'Needs your response — in the Helping tab',
        body: 'The Helping tab opens with a band of the responses you owe right now — an offer to accept or decline, a suggestion to help (when an admin proposed you as the helper) to accept or decline, a reserved request to confirm, a finished exchange to mark done, and a completed exchange to rate. Both you and the other person rate, and the prompt waits there until you do. It disappears when you are all caught up.',
      },
      {
        title: 'Requests you can fill',
        body: 'Each card shows the requester (the colored circle is their initial — "Asked by …"), your trust path and their Karma, and an explainable match score like "42% · 2nd-degree trust" — never a bare number. Tap anywhere on a card to open its full detail page, which shows the ask and the one action available to you right now — offer to help, or, if you can\'t act on it, why.',
      },
      {
        title: "Offers you're waiting on",
        body: "When you've offered to help on open asks, Home shows them as a small preview — the actual asks, each linking to its detail — so you can pick up where you left off. They're waiting on the requester to respond, not on you; the full list lives in the Helping tab. When an admin suggests you as a helper, Home shows a second preview — accept or decline those in Helping.",
      },
      {
        title: 'Your network, one tap away',
        body: "Home also carries a My Network card — your belonging graph (you and your first-degree connections) is a top-level destination, reachable from the My Network nav link too. Open it to explore three zoom levels of one structure: My Network (you), This Community (everyone here), and Across Communities (how your communities connect).",
      },
      {
        title: "You're caught up",
        body: "When there are no direct matches for you, the feed shows one honest, calm message — \"You're caught up\" — then offers a quieter path to browse your communities, which may still have open asks waiting. It doesn't pretend there's nothing left or push infinite-scroll urgency.",
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
        title: 'Your arrival',
        body: "Your first join lands on a welcome moment showing your first belonging graph — you on the ring of the community you just entered. Arrive through an invitation and you'll also see your invitation bond to the person who brought you in; it becomes trust when you help each other. One button takes you straight to the community's open asks.",
      },
      {
        title: 'Finding your way around',
        body: "A community opens on warm Home — its hero, the weekly pulse, and the open asks. People shows who's here and the trust between you. How we're connected anchors you at the top of the community ring so you can see where you fit; zoom out to Communities to see which of yours are woven together. Stewardship is where shared decisions, splits, merges, and (for admins) the management tools live.",
      },
      {
        title: 'Neighbours who offer services',
        body: "Some communities also surface a Providers section on Home — neighbours who offer services for pay, like rides, trades, or tutoring. It appears only if your community's stewards enabled it, and it lists members who meet the standing your community asks for. Paid services stay separate from karma: helping and hiring are different things here.",
      },
      {
        title: 'Relationships that fade — and how to keep them',
        body: "Karmyq is designed to forget. On How we're connected, a How memory fades legend explains why some bonds look softer, and a gentle, optional notice shows which bonds are close to being let go — helping each other again keeps a bond alive, or you can let it fade. Your profile's memory section shows the same in plain words — active bonds you're tending, ones going quiet, and ones nearly forgotten — even when your karma display is off. The What Karmyq Remembers page explains exactly what's kept versus let go. Forgetting the details never touches your karma or trust.",
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
