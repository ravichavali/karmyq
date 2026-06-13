/**
 * Public-site copy contract for karmyq.org (Sprint 95).
 *
 * The v5 HTML files are the content/organization source of truth; this module
 * holds that copy verbatim as pure, typed data so:
 *   - the landing Jest harness can assert the IA + forbidden-copy guarantees
 *     without a React/jsdom stack, and
 *   - the route pages render from a single source instead of duplicating prose.
 *
 * Visual styling stays in the existing Tailwind/Fraunces design system (this is
 * an information-architecture sprint, not a redesign) — these blocks describe
 * structure and emphasis, not CSS.
 */

// ── Block model ────────────────────────────────────────────────────────────

/** Inline run inside a paragraph: plain text, italic emphasis, or bold. */
export type Inline = string | { em: string } | { strong: string };

/**
 * A vertical content block. `star` is isolated emphasis (a standalone green
 * essay line), deliberately distinct from a body `p` so it is never rendered
 * or treated as an ordinary paragraph.
 */
export type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'lead'; text: string }
  | { kind: 'p'; runs: Inline[] }
  | { kind: 'star'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'context'; text: string };

// Block builders — keep the content below readable.
const h1 = (text: string): Block => ({ kind: 'h1', text });
const h2 = (text: string): Block => ({ kind: 'h2', text });
const lead = (text: string): Block => ({ kind: 'lead', text });
const p = (...runs: Inline[]): Block => ({ kind: 'p', runs });
const star = (text: string): Block => ({ kind: 'star', text });
const quote = (text: string): Block => ({ kind: 'quote', text });
const context = (text: string): Block => ({ kind: 'context', text });

export function inlineToText(runs: Inline[]): string {
  return runs
    .map((r) => (typeof r === 'string' ? r : 'em' in r ? r.em : r.strong))
    .join('');
}

export function blockToText(b: Block): string {
  return b.kind === 'p' ? inlineToText(b.runs) : b.text;
}

export function blocksToText(blocks: Block[]): string {
  return blocks.map(blockToText).join('\n');
}

// ── Shared link type ───────────────────────────────────────────────────────

export interface LinkRef {
  label: string;
  href: string;
}

// ── Home (route: /) — the story and nothing else ───────────────────────────

export interface FounderNote {
  eyebrow: string;
  location: string;
  paragraphs: string[];
  attribution: string;
}

export interface HomeContent {
  hero: Block[];
  heroCtas: LinkRef[];
  thinkingLabel: string;
  thinking: Block[];
  thinkingCtas: LinkRef[];
  whyLabel: string;
  founderNote: FounderNote;
  /** The quiet thesis the story has earned — a star line closing the founder note. */
  closingLine: string;
  standTogether: string[];
}

export const homeContent: HomeContent = {
  hero: [
    h1('Help build the neighborhood layer the internet forgot.'),
    lead(
      `You have neighbors whose names you don't know. We do too. The instinct to help — to know, to be known — hasn't gone away. It's waiting for better conditions.`
    ),
    p(
      `Karmyq is open-source infrastructure for neighborhoods, mutual aid groups, and local communities to coordinate help, share skills, and build trust — without surveillance, ads, or platform extraction.`
    ),
    context(
      `We want to understand before we build, and prove it before we ask anyone to depend on it. So we're starting with a founding circle — and that circle will be Karmyq's first community. We'll use the platform to organize the people building the platform. If it can't hold us, it isn't ready for anyone else.`
    ),
    quote('Meaning-making, not accounting.'),
  ],
  heroCtas: [
    { label: 'Join the founding circle', href: '/join' },
    { label: 'Read the thinking', href: '#thinking' },
  ],
  thinkingLabel: 'The thinking',
  thinking: [
    h2('Trust when you can afford to.'),
    p(
      `Think of your most reliable friend. The one who shows up at 2am. You didn't get there by saving them for emergencies — you got there by calling on each other for things big and small, until the trust was deep enough to hold the 2am call. Trace any friendship like that backwards and you find the same thing: small mutual dependence, repeated, until it became something you could stake everything on.`
    ),
    p(
      `That logic applies at the community scale, and we've abandoned it. The contracts, ratings, background checks, and platform guarantees we layer over modern life aren't worthless — but they're substitutes, and leaning on them lets the underlying muscle go slack.`
    ),
    star(`Crisis doesn't create trust. It reveals the trust that was already there — or exposes its absence.`),
    p(
      `That's the real risk. Not that people are bad — the evidence runs the other way. It's that trust takes time to build, and we keep waiting until we need it. By then it's too late to start. Karmyq isn't a substitute for institutions, and it isn't a bet that people are angels. It's the practice ground for the relationships you can't summon on demand — built now, while there's no emergency, so they're there when there is.`
    ),

    h2('We didn’t choose distrust. We slipped into it.'),
    p(
      `As cities grew and institutions expanded, people stopped relying on each other and started relying on systems. The personal gave way to the procedural. Neighbors became strangers who happened to share a wall.`
    ),
    p(
      `This wasn't malice. It was convenience, compounded. `,
      { em: 'Just to be safe' },
      `, we stopped letting children walk to school alone. `,
      { em: 'Just to be safe' },
      `, we stopped lending things to people we didn't know well. `,
      { em: 'Just to be safe' },
      `, we stopped assuming good intent from people we hadn't vetted. Each retreat was locally rational. Applied at scale, across generations, they hollowed out the social fabric.`
    ),
    p(
      `Our abundance of safety and comfort quietly destroyed the conditions in which trust grows. We optimized away the friction that makes people need each other. A society that never practices trusting loses the capacity for it.`
    ),
    star('There is no villain in this story. That is what makes it hard to fix.'),

    h2('Who gets believed is not random.'),
    p(
      `Hannah Arendt showed that evil doesn't need monsters. Ordinary people, going along, are enough.`
    ),
    p(
      `We learned that lesson halfway — outward only. Sophisticated about institutions. Suspicious of strangers. The move almost nobody makes is the mirror image: the same ordinary person who can thoughtlessly harm can thoughtlessly help, when conditions allow. The Covid kitchens weren't heroic. They were the default, briefly uncovered.`
    ),
    star(
      `We've learned to see the banality of evil in others. We haven't learned to see the banality of goodness in the same people.`
    ),
    p(
      `Karmyq doesn't ask for heroism. It builds conditions where the goodness already there has somewhere to go. Standing comes from acts, not identity — because acts are the only evidence that matters.`
    ),

    h2('Short-termism won. The bill is coming due.'),
    p(
      `Exploitation was never irrational. It optimized for the wrong horizon. Colonialism extracted real wealth. Industrial monocultures fed billions. The structures that overran slower, more woven ways of living `,
      { em: 'worked' },
      ` — in the near term. What they consumed had taken generations to build and broke in a fraction of the time. It lost anyway.`
    ),
    p(
      `Biology already knows this shape. A body is the proof that cooperation scales: trillions of cells holding specialized, interdependent roles. Cancer is what happens when one line of cells abandons the contract — it simplifies, stops specializing, grows fast, takes everything near it, and wins, locally, right up until it kills the thing that fed it. The pattern that overran the slower world followed the same logic. Simpler. Faster. Blind to the whole it depended on.`
    ),
    p(
      `That is the trade we keep making, now at the scale of a civilization. The cost never disappears. It moves downstream — paid late, by people who never signed the cheque.`
    ),
    p(
      `Cooperation has always been the slower game. It asks for trust before certainty — the willingness to believe the person across from you is worth the risk before they've proven it. Nobody wants to be the only one who is.`
    ),
    star('Karmyq is a bet on the slower game.'),
    p(
      `Not because it always wins — it often hasn't — but because the thing that beat it is coming due, and because cooperation only ever needed one ingredient: people able to see the good in each other before they had to gamble on it.`
    ),

    h2('Communities find their own trust.'),
    p(
      `Bees coordinate at massive scale — on simple tasks. Humans can coordinate on astonishingly complex ones. But we built technology that scales monocultures: one marketplace, one network, one way to interact. What if we built technology that scales diversity instead — a thousand ways of cooperating, each adapted to its community, its culture, its people?`
    ),
    p(
      `More trust is not always better. Every healthy ecosystem has an immune system. Trust extended carelessly is naivety, not generosity.`
    ),
    p(
      `Each community is its own perceptual world — what counts as a real ask, what creates obligation, what kindness looks like. The parameters we provide are a sketch, not a portrait. What a community actually is can only emerge through use.`
    ),
    p(
      `We don't protect communities from every failure. A community that never weathers a difficult interaction never builds the capacity to handle one.`
    ),
    star('We are not building walls. We are building organisms.'),

    h2('The village economy was never purely a gift.'),
    p(
      `The blacksmith got paid. So did the healer. The village didn't run on pure charity — it ran on relationship. Commerce happened inside a web of people who knew each other. That's what we lost. Not the money. The knowing.`
    ),
    p(
      `We've been building toward the gift economy end of that spectrum — and rightly so. But we don't live in a world where everyone can afford to give their time and skill without compensation, and pretending otherwise serves no one. Karmyq reflects the full village: communities that choose to can let trusted members offer paid work through the same trust infrastructure as everything else. Karmyq never touches the money. It is not a marketplace. It is what becomes possible after trust has been established.`
    ),

    h2('Trust wasn’t taken from us. We forgot how.'),
    p(
      `For most of human history, trusting the people nearby was a skill you practiced daily, because nothing else held the community together. Then we built things that could hold it for us: institutions, contracts, platforms, ratings. Each one let us extend a little less of ourselves to the people around us, because the system would vouch for them instead. It was convenient. It also let the muscle go slack. That's the harder thing to admit: the fault was partly ours.`
    ),
    p(
      `When you help someone through a platform, who holds the memory of it? Not your neighbors. The platform does — it records the transaction, updates a score, files the signal in a database it owns. You helped. But your community never finds out, and you never build anything with the person you helped. The relationship that should have thickened between you stays exactly as thin as it started. Platforms are built for volume: many people, many exchanges, every connection kept thin enough to scale. Depth doesn't monetize.`
    ),
    p(
      `A village did the opposite — and we should be honest about how it worked. When you helped a neighbor, others came to know, not because anyone announced it but because life was lived in the open. Reputation wasn't a number; it was ambient, alive, repaid not once but for years. That was the warmth. It also had teeth: the same machinery that rewarded generosity punished difference, remembered every mistake, and gave you nowhere to hide. The village isn't a paradise to restore. It's a mechanism to learn from.`
    ),
    star('Keep the echo. Lose the panopticon.'),
    p(
      `Karmyq is built for exactly that. What you've done is never broadcast to the community — that would be surveillance with better branding. Instead, the pattern of your acts quietly shapes the connections the system makes: which requests reach you, how much trust you carry into a new community, how short the path runs between you and a stranger. And then the system is designed to forget. The details of an interaction expire after a few months, the way human memory does; what persists is the shape of your relationships, not a ledger of them.`
    ),
    p(
      `And success here looks strange for a platform: it's measured by how little you end up needing it. A ride coordinated through Karmyq today should, over months, become a phone call between two people who simply trust each other. The platform lives at the edge of your trust network — among the not-yet-neighbors — and its job is to keep dissolving that edge.`
    ),
    star(`It's scaffolding. The whole point is to be outgrown.`),

    h2('This is a beginning.'),
    p(
      `The ideas here reach back further than this platform. Elinor Ostrom demonstrated that communities can govern shared resources more effectively than markets or states. Robin Dunbar mapped the cognitive limits of genuine relationship. Joseph Henrich showed that culture — the accumulated capacity to cooperate — is humanity's real advantage, and that it is fragile. These are not footnotes. They are load-bearing walls.`
    ),
    p(
      `We have done our best to build on them honestly. But a platform built by a small team, drawing on one tradition, will only become what it needs to be if people from every walk of life bring their own understanding to it, find what we got wrong, and build something better. That openness is not a disclaimer. It is the design.`
    ),
  ],
  thinkingCtas: [
    { label: 'Meet the research foundation', href: '/research' },
    { label: 'See how it works', href: '/how-it-works' },
  ],
  whyLabel: "Why we're building this",
  founderNote: {
    eyebrow: "Founder's note",
    location: 'Foster City, CA',
    paragraphs: [
      `My neighborhood runs on driveway waves. You know the kind — eye contact, a half-lift of the hand, back inside. Polite. Sufficient. Not quite community.`,
      `Then a couple moved in a few doors down. They were the kind of people who stop. Who start conversations. Who remember names. Slowly, without anyone deciding it, something shifted.`,
      `When they went on vacation, they asked if we'd look after their cat. A small thing. But it was the first real ask — the moment a wave becomes something more.`,
      `A few months later, I had to travel for three weeks. My wife would have been alone with our dog — the logistics, the cost, the quiet weight of it. Before I could figure out what to do, our neighbors were there. They stepped in. What could have been expensive and stressful became something that brought us even closer. Proof that we'd built something real, without quite meaning to.`,
      `We didn't use an app. We didn't need one — we'd been lucky enough to find each other.`,
      `But I kept thinking about everyone on my street who hadn't. The neighbors managing alone because no one found the right opening. The professional a few houses down whose skills nobody knows about. The person who moved here a year ago and still doesn't know anyone's name.`,
      `Most neighborhoods aren't waiting for connection. They're waiting for a reason to start.`,
      `That's why we're building Karmyq. Not to replace what happened between us — you can't build that with software. But to create the conditions. To make the first ask a little easier. To give people the infrastructure for the thing that wants to happen anyway.`,
    ],
    attribution: '— Ravi Chavali, founder',
  },
  closingLine: 'Making good easy is the point.',
  standTogether: [
    `The platforms were built to extract. Every signal of health was skin-deep, engineered to harvest. The ground went hard underneath.`,
    'An ecosystem runs the other way: the network serves the people.',
    'That is what Karmyq is for.',
  ],
};

export function homeStarLines(): string[] {
  return homeContent.thinking
    .filter((b): b is Extract<Block, { kind: 'star' }> => b.kind === 'star')
    .map((b) => b.text);
}

// ── Principles (route: /principles) ────────────────────────────────────────

export interface Principle {
  name: string;
  body: string;
}

export interface PrinciplesContent {
  heading: string;
  intro: string;
  principles: Principle[];
  closingCta: LinkRef;
}

export const principlesContent: PrinciplesContent = {
  heading: 'Built on values, not valuations.',
  intro:
    `Every technical decision in Karmyq flows from these six principles. They're not marketing — they're architecture. If a feature contradicts one of them, the feature loses.`,
  principles: [
    {
      name: 'Open source',
      body: `Every line of code is public. Fork it, improve it, make it yours. The infrastructure for cooperation should belong to everyone — and the AGPLv3 license keeps it that way. If someone runs Karmyq, their changes stay open too.`,
    },
    {
      name: 'Community sovereignty',
      body: `Each community governs itself — and no role within it is permanent. Your community sets its own rules, trust model, and request types. No platform override. The platform holds the infrastructure; the community holds the power.`,
    },
    {
      name: 'Privacy as default',
      body: `No tracking. No profiling. No ads. Interaction details expire after a few months, the way human memory does; what persists is the shape of relationships, not a ledger of them. Your community's business belongs to your community.`,
    },
    {
      name: 'Meaning-making',
      body: `We don't reduce relationships to transactions. Helping builds meaning — stories, not spreadsheets. Community, not currency. The measure of success is not engagement. It is whether neighbors end up needing the platform less.`,
    },
    {
      name: 'Biomimetic design',
      body: `Living systems scale by connection, not control — the mycorrhizal web beneath a forest, moving nutrients where they're needed. Karmyq is built the same way: invisible infrastructure, visible flourishing. Resilient, adaptive, designed to evolve.`,
    },
    {
      name: 'No extraction',
      body: `We don't extract value from communities. No venture capital growth mandates. No monetization of relationships. Karmyq never touches money. Built to serve, not to scale.`,
    },
  ],
  closingCta: { label: 'See how the principles become mechanics', href: '/how-it-works' },
};

// ── How it works (route: /how-it-works) ────────────────────────────────────

export interface DesignEssay {
  eyebrow: string;
  title: string;
  subtitle: string;
  body: Block[];
}

export interface TimelineItem {
  when: string;
  act: string;
}

export type HowSegment =
  | { type: 'prose'; blocks: Block[] }
  | { type: 'feature'; title: string; body: string }
  | { type: 'essay'; essay: DesignEssay }
  | { type: 'timeline'; label: string; lead: Block[]; items: TimelineItem[] };

export interface HowItWorksContent {
  heading: string;
  segments: HowSegment[];
  closingCta: LinkRef;
  /** Derived list of the design-essay titles, for tests and quick checks. */
  essays: DesignEssay[];
}

const starsEssay: DesignEssay = {
  eyebrow: 'Design essay · Reputation',
  title: 'The Problem with Stars',
  subtitle: 'Why we hid the metrics',
  body: [
    h2('The problem with scores.'),
    p(
      `Every platform that has tried to build trust through reputation has converged on the same solution: a number. One to five stars. A score out of a hundred. The number is clean, portable, instantly legible. It is also, almost immediately, the thing people start to game.`
    ),
    p(
      `This is not a character flaw. It is a predictable response to an incentive structure. When a visible number determines how much opportunity you get, optimizing for the number becomes rational. Drivers learn which behaviors produce five-star ratings. Sellers learn how to solicit reviews. The number, designed to represent trustworthiness, becomes a performance of trustworthiness — and the two quietly diverge.`
    ),
    h2('In defense of gossip.'),
    p(
      `Gossip has a reputation problem. In contemporary usage it means malice. But anthropologists use the word differently, and more usefully: gossip is the informal circulation of social information through a community. Who helped whom. Who follows through. Who can be relied upon.`
    ),
    p(
      `Robin Dunbar argues that gossip is the primary mechanism by which humans maintain relationships at the scale we live at. Physical grooming — the touch primates use to maintain bonds — doesn't scale beyond small groups. Language does. Gossip is social grooming at scale: the way communities stay current on each other, the way trust is built without requiring direct observation of every act. This is not a flaw of village life. It is the feature that made village life function.`
    ),
    p(
      `The knowledge it produces doesn't live in any one person's head. It lives in the community — distributed, textured, contextual in ways no number can capture. Within roughly 150 people, we can hold genuine knowledge of each other. Above that, we reach for proxies. Karmyq's size limit is not arbitrary. It is the boundary within which ambient social knowledge remains possible.`
    ),
    h2(`Why you can't see anyone's karma.`),
    p(
      `In Karmyq, karma is not visible between members. You cannot look up another person's score. You must opt in even to see your own. This is the most counterintuitive design decision we made, and the one we are most confident about.`
    ),
    p(
      `A karma score that members can see is a score that members will optimize for. Visible numbers create leaderboards, even when no leaderboard is intended. They shift attention from the act of helping to the reward for helping — and that shift changes the nature of the act. Sociologists distinguish between `,
      { em: 'particularized trust' },
      `, which develops through direct relationship, and `,
      { em: 'generalized trust' },
      `, which extends to strangers. Star ratings try to manufacture generalized trust through a shortcut. Karmyq builds particularized trust through practice. The opacity is not a workaround. It is the mechanism.`
    ),
    h2('How karma is earned, and how it fades.'),
    p(
      `Every completed interaction generates karma for both people — the person who helped, and the person who asked. Asking for help is not passive. It is an act of vulnerability that makes the interaction possible. A community where only givers accumulate standing is a community that will run out of people willing to ask.`
    ),
    p(
      `Karma records are never deleted, but they contribute less over time, using a six-month half-life. An interaction from three years ago is still in the record — it just carries a fraction of the weight it did when it was recent. What remains after the fading is a living picture of who someone is in this community, right now.`
    ),
    h2('How reputation travels without broadcast.'),
    p(
      `Because karma is not visible as a number — and acts are never broadcast — reputation travels the way it does in any real community: through direct experience and its quiet consequences. The people you've helped know what they witnessed. The system knows the pattern. And the pattern shapes what happens next: whose requests reach you, how much trust you carry into a new community, how short the path runs between you and a stranger. No one is watching. But everything you do still matters.`
    ),
    p(
      `What the platform does make visible is connection — not reputation, but relationship. Trust paths show how you're connected to someone you don't know directly: through whom, in how many steps, by what kind of tie. `,
      { em: `I trust Maria. Maria trusts David. I don't know David yet, but I know something about him I wouldn't know about a stranger.` }
    ),
    p(
      `And when you join a community where no one knows you, you don't start from zero. A portion of the trust you've built elsewhere — weighted and capped by what the new community accepts — travels with you. A letter of introduction, not a free pass.`
    ),
    h2('Accuracy over direction.'),
    p(
      `None of this is static. The system is designed to calibrate toward what is actually true — not to push trust higher as a goal, but to reflect what a community's behavior actually shows over time. Trust that is earned looks different from trust that is performed. The system, over time, learns the difference.`
    ),
  ],
};

const villageEssay: DesignEssay = {
  eyebrow: 'Design essay · Service layer',
  title: 'The Complete Village',
  subtitle: 'How commerce fits into community',
  body: [
    h2('The village economy was always complete.'),
    p(
      `There is a version of the community platform story that goes like this: money is the problem, markets are the disease, and the cure is a world where everything is freely given. It is a romantic vision. It is also, for most people in most circumstances, impossible to live inside.`
    ),
    p(
      `The village economies that Karmyq draws on were never purely gift economies. The blacksmith charged for his work. The healer expected payment, in coin or in kind. What made these economies different from what we have now was not the absence of money — it was the presence of relationship. Commerce happened inside a web of mutual knowledge and ongoing obligation. That web is what we've lost. Not the commerce — the relationship that contained it. The service layer is not a concession. It is the honest completion of the model.`
    ),
    h2('The tension, addressed directly.'),
    p(
      `Does enabling paid services inside a trust-based platform corrupt the trust culture it's trying to build? Research on motivation consistently shows that introducing payment into relationships that were previously gift-based can crowd out the intrinsic motivation that made those relationships function. This is why the service layer is opt-in at the community level. Some communities will keep everything gift-based. Some will want the full village model. The question is not resolved by us — it is held by each community, and answered through practice.`
    ),
    h2('One identity. One history.'),
    p(
      `When a community enables professional services, members who choose to can activate a provider profile — a professional extension of their existing identity. Not a second account. Not a separate persona with a separate reputation. An additional layer on the same person, drawing on the same trust history.`
    ),
    p(
      `The neighbor who helped three people move last year, who lent their van to someone they barely knew, who has been showing up consistently for eight months — that history is the context in which their professional services are offered. When you hire someone through Karmyq, you're extending trust into a web of actual human knowledge — not into a void filled by a star rating.`
    ),
    h2('What communities configure.'),
    p(
      `Professional services are off by default. Communities that enable the layer control whether to allow it at all, which service types are permitted, and the minimum trust standing a member must hold before offering services. You cannot arrive and immediately offer paid work. You have to earn standing first. The service layer is not a shortcut to reputation. It is a reward for having built one.`
    ),
    h2('Karmyq never touches money.'),
    p(
      `This is absolute and deliberate. Karmyq does not process payments, hold funds, or take a percentage. The moment money flows through a platform, the platform becomes a financial intermediary with the interests of a financial intermediary. Karmyq's role is to establish the conditions in which direct dealing is possible — and then step back.`
    ),
    h2('The long arc.'),
    p(
      `The deepest hope for the service layer is that it eventually makes itself unnecessary. A community member discovers a local electrician through Karmyq. Trust develops. After a year, they call directly. That is not a failure. That is what success looks like. The measure of the service layer is not how many transactions flow through it. It is how many relationships it starts that eventually no longer need it.`
    ),
  ],
};

const rolesEssay: DesignEssay = {
  eyebrow: 'Design essay · Governance & growth',
  title: 'Why No Role Is Permanent',
  subtitle: 'Binding power before it calcifies',
  body: [
    h2('The oldest failure mode.'),
    p(
      `Every cooperative structure in history has faced the same threat — not invasion, not scarcity, but calcification. Power accumulates. Roles harden. The people who once served the group begin to be served by it. By the time anyone names the problem, the people with the power to fix it are the ones benefiting from it.`
    ),
    p(
      `This is not a story about bad people. It is a systems observation: power that cannot be displaced eventually destabilizes whatever holds it. Any structure without binding mechanisms — limits that constrain accumulation before it calcifies — will eventually concentrate power beyond what it can survive.`
    ),
    h2('Binding mechanisms, by design.'),
    p(`Karmyq's architecture is a set of binding mechanisms, deliberately chosen.`),
    p(
      `The community size limit binds growth: at roughly 150 members, genuine mutual knowledge frays, so communities divide rather than swell. The karma half-life binds reputation: standing reflects who you are now, not who you were once. Trust-gated eligibility binds entry to power: you cannot hold a governance role before the community has reason to rely on you. And the impermanence of roles binds power itself: the nomination and ratification process runs in both directions. A member whose trust has grown can be elevated. A role-holder whose presence has faded can be replaced.`
    ),
    p(
      `Elinor Ostrom documented communities that governed shared resources for centuries. The ones that lasted had this in common: rules made by the people bound by them, monitored by the community, adjustable over time. Karmyq's governance is that finding, made into software.`
    ),
    h2('Growth without calcification.'),
    p(
      `Fission is a binding mechanism too — a pressure-relief valve. When a community approaches its natural limit, members can propose a split. The platform reads existing patterns of interaction and suggests who belongs together; the division goes to a vote weighted by standing; if it passes, two daughter communities form, each carrying the full trust history of its members, each holding a special relationship to the other. The community doesn't break. It reproduces.`
    ),
    p(
      `Fusion runs the other way: two communities that have built enough trust across their boundary can choose to become one, each voting independently, the merged community inheriting the karma and trust built in both.`
    ),
    p(`Neither is automatic. The platform provides the mechanics; the community provides the judgment.`),
    h2('What this buys.'),
    p(
      `A structure where power stays in motion. Where standing must be continuously earned. Where growth doesn't mean dilution and size doesn't mean distance. The same forces that hollowed out platforms and institutions — entrenchment, accumulation, the slow drift from serving to extracting — are bound here before they start.`
    ),
    p(
      `No permanent thrones. No frozen hierarchies. Governance reflects who the community currently trusts — not who it trusted at founding.`
    ),
  ],
};

export const howItWorksContent: HowItWorksContent = {
  heading: 'How it works.',
  segments: [
    {
      type: 'prose',
      blocks: [
        h2('What Karmyq actually is.'),
        p(
          `A toolkit. An open-source platform that lets communities design their own cooperation systems — not one model handed down, but infrastructure flexible enough to hold mutual aid, skill sharing, tool lending, local services, or any combination a community needs. The platform doesn't decide what your community values. It gives your community the means to decide for itself, and to change its mind over time.`
        ),
      ],
    },
    {
      type: 'prose',
      blocks: [
        h2('Reputation without the performance.'),
        p(
          `On Karmyq, your worth is not a public score. There are no leaderboards, no star ratings to optimize, no anxiety about your profile falling behind someone else's. Karma moves like ambient knowledge in a village: people remember who shows up, but nobody keeps a public spreadsheet on their neighbors.`
        ),
      ],
    },
    {
      type: 'feature',
      title: 'Being known, not being seen.',
      body: `Let's be honest: it feels good to be seen helping. Platforms know this — every like, every visible score is engineered to give you that hit and keep you chasing it. Karmyq deliberately doesn't. No applause, no public count. What you get instead is slower and harder to fake: over months, the people around you come to know who you are. The hit is pleasure. Being known is joy. We're built for the second.`,
    },
    { type: 'essay', essay: starsEssay },
    {
      type: 'prose',
      blocks: [
        h2('How trust is measured.'),
        p(
          `Trust isn't a score. It's a pattern — how you show up, how reliably, with whom, how broadly. The platform reads the pattern. No one sees a number.`
        ),
        p(
          `Trust paths show you how you're connected to a stranger. Through whom, in how many steps. Not a number. A map of actual human connection.`
        ),
        p(
          `Cross-community trust travels with you. When you join somewhere new, a portion of what you've built elsewhere doesn't disappear. You don't start from zero.`
        ),
      ],
    },
    {
      type: 'prose',
      blocks: [
        h2('The service layer.'),
        p(
          `Communities that choose to can enable a professional services layer — off by default, opted into deliberately. Providers must meet a minimum trust score before they can offer services. Karmyq never processes payment; it coordinates the connection and nothing more. A single identity carries both roles: the neighbor who helped you move last month and the electrician you hire this month are the same person, with the same trust history.`
        ),
      ],
    },
    { type: 'essay', essay: villageEssay },
    {
      type: 'prose',
      blocks: [
        h2('How communities govern themselves.'),
        p(
          `Each community is sovereign — up to 150 members, the threshold at which genuine relationship becomes possible and beyond which it frays. It sets its own membership rules, configures how trust and karma flow, decides which kinds of help to enable. No platform override.`
        ),
        p(
          `When a community is created, it goes through a short initialization process that sets its starting trust character — how it weights deep relationships over broad ones, how open it is to people beyond its immediate circle, what its default posture is toward other communities. These become the community's starting parameters. Not fixed permanently — the model evolves as the community actually behaves. The system calibrates toward what is actually true, not what was declared at founding.`
        ),
        p(
          `Governance is gated by trust. To be nominated for a governance role, a member must first earn standing within the community — built through actual interactions, not assumed at entry. Nominations are made by members and ratified by existing role-holders. When contested decisions arise, votes are weighted by trust — the members the community has come to rely on most carry more weight in shaping its direction.`
        ),
        p(
          `No role is permanent. A member whose trust has grown can be elevated. A role-holder whose presence has faded can be replaced. Governance reflects who the community currently trusts — not who it trusted at founding.`
        ),
      ],
    },
    {
      type: 'prose',
      blocks: [
        h2('How communities grow and change.'),
        p(`Communities don't have to stay the same shape forever.`),
        p(
          `When a community approaches its natural size limit, its members can propose a split. The platform reads the existing patterns of interaction and suggests who belongs together — those who have helped each other most stay together. The proposed division goes to a vote weighted by standing. If it passes, two daughter communities form — each carrying the full trust history of its members, and each starting with a special relationship to the other. Sisters remember they share a past.`
        ),
        p(
          `When two communities have built enough trust across their boundary to want to become one, they can propose a fusion. Both communities vote independently. If both pass, the merged community inherits the full karma history of both parents and carries forward the trust relationships built in each.`
        ),
        p(
          `Neither process is automatic. Communities decide when the time is right. The platform provides the mechanics; the community provides the judgment.`
        ),
      ],
    },
    { type: 'essay', essay: rolesEssay },
    {
      type: 'timeline',
      label: 'Designed to fade',
      lead: [
        h2('Trust is a living thing, not a permanent record.'),
        p(
          `A neighbor who helped you last month matters more than one who helped three years ago. Karmyq works the same way. Old interactions fade, like memories. What remains is a living sense of trust — not an immutable score.`
        ),
      ],
      items: [
        { when: 'Today', act: 'Priya helped Maria move a couch' },
        { when: '2 weeks ago', act: 'Carlos gave Aisha a ride to the airport' },
        { when: '1 month ago', act: "Wei fixed Mohamed's leaky faucet" },
        { when: '3 months ago', act: 'Yuki taught James to make sourdough' },
        { when: '6 months ago', act: 'Sarah organized a neighborhood cleanup' },
        { when: '1 year ago', act: "Amara watched Lena's dog for a week" },
        { when: '2 years ago', act: 'David helped Mei set up her garden' },
      ],
    },
  ],
  closingCta: { label: 'Ready to pressure-test this? Join the founding circle', href: '/join' },
  // Computed once from the same essay objects the segments reference.
  essays: [starsEssay, villageEssay, rolesEssay],
};

// ── Research (route: /research) ────────────────────────────────────────────

export interface Thinker {
  name: string;
  work: string;
  body: string;
}

export interface ResearchContent {
  heading: string;
  intro: string;
  thinkers: Thinker[];
  closingHeading: string;
  closingBody: string;
  closingCta: LinkRef;
}

export const researchContent: ResearchContent = {
  heading: 'Load-bearing walls, not footnotes.',
  intro:
    `These ideas didn't begin with us. They began with researchers who spent careers studying how humans actually cooperate — what conditions make it possible, what conditions destroy it, what we lose when it breaks down. Every significant design decision in Karmyq has a thread that runs back to this work. We present it here not as credentials, but because if you pull these ideas out, the platform's logic collapses.`,
  thinkers: [
    {
      name: 'Elinor Ostrom',
      work: 'Governing the Commons, 1990 · Nobel Prize in Economics, 2009',
      body: `Ostrom demonstrated something economists had assumed was impossible: that communities could govern shared resources effectively without either privatizing them or turning them over to the state. She looked at communities managing fisheries, forests, irrigation systems, and grazing lands — and found that many had been doing so sustainably for centuries, through self-designed institutional rules, monitored by community members, enforced through graduated sanctions, and adaptable over time. The conditions she identified for successful commons governance are the design principles behind Karmyq's community configuration model. Community sovereignty is not an ideological preference. It is what the evidence shows works.`,
    },
    {
      name: 'Robin Dunbar',
      work: 'Grooming, Gossip, and the Evolution of Language, 1996',
      body: `Dunbar arrived at 150 through a study of primate neocortex size: the upper limit of stable social relationships where you know who you're dealing with, have a model of their intentions, and can track your history with them. This number appears with remarkable consistency across human social structures: hunter-gatherer bands, Neolithic villages, military units, the average size of functional church congregations. Karmyq's 150-member limit is built on this. Dunbar also described the round-robin of social life: acts of generosity reverberate through small communities because everyone knows everyone else. This is the model for Karmyq's reputation system — not a database, but an echo.`,
    },
    {
      name: 'Joseph Henrich',
      work: 'The Secret of Our Success, 2015',
      body: `Henrich's central argument: the most important thing about humans is not our individual intelligence — it is our capacity for cumulative culture. Cooperation is not innate and automatic. It is culturally transmitted. Communities that practice cooperation develop the norms, institutions, and habits of mind that make further cooperation possible. Communities that stop practicing it lose those things — not because human nature changes, but because the cultural transmission breaks. This is why Karmyq's design emphasizes small experiments over grand designs. The goal is to create conditions in which cooperation can be practiced, and in which that cultural knowledge can accumulate and spread.`,
    },
    {
      name: 'Marcel Mauss',
      work: 'The Gift, 1925',
      body: `Mauss's central observation: in societies organized around gift exchange, giving is never simply altruistic and receiving is never simply passive. Every gift creates obligation. This web of obligation and reciprocation is, Mauss argued, the foundation of society itself. What gift economies do that markets cannot: they create bonds. A market transaction is completed when payment is made; the relationship ends there. A gift creates an ongoing relationship — a web of mutual obligation that connects people across time. Karmyq's karma system is designed to capture this: the sense that helping someone creates a relationship, not just a completed transaction.`,
    },
    {
      name: 'Suzanne Simard',
      work: 'Finding the Mother Tree, 2021',
      body: `Simard's research revealed that forests are not collections of competing individuals but communities connected underground — mycorrhizal networks through which trees share nutrients, send signals, and support their young and their weak. The oldest, most connected trees hold the network together. The forest is a meta-organism that no single tree could be alone. This is the closest thing in nature to what Karmyq is trying to build: invisible infrastructure, visible flourishing. A village is just a small forest. The work is keeping the network alive as the forest grows.`,
    },
    {
      name: 'Jonathan Haidt',
      work: 'The Righteous Mind, 2012',
      body: `Haidt's research reveals that humans are primarily social creatures who use reason to navigate social life. Our moral intuitions precede our reasoning and shape it. The sense of being part of something — of shared purpose and shared norms — is not a luxury add-on to human social life. It is a foundational need. Communities that provide genuine belonging generate loyalty, cooperation, and the willingness to sacrifice for others that purely transactional structures cannot produce.`,
    },
    {
      name: 'Robert Putnam',
      work: 'Bowling Alone, 2000',
      body: `Putnam documented the collapse of social capital across the second half of the twentieth century: membership in civic organizations, trust in neighbors, participation in informal social activities — all declining, steadily, for decades. He distinguished between bonding capital (connecting similar people within groups) and bridging capital (connecting different groups to each other). Karmyq's architecture reflects this. Within communities, the design prioritizes depth of relationship. Across communities, the trust carry mechanism creates bridging capital that lets what works in one community spread to others.`,
    },
    {
      name: 'Brian Arthur / Santa Fe Institute',
      work: 'Complexity Economics',
      body: `Arthur's complexity economics frames economies not as machines seeking equilibrium but as living systems in constant evolution — diverse, adaptive, and impossible to fully optimize from above. The insight validates what the platform is trying to do: not design the one correct cooperation model, but create conditions in which many models can emerge, compete, and evolve. Diversity and adaptation, not efficiency and equilibrium, drive long-term resilience. Karmyq's community sovereignty model is a bet on complexity over uniformity.`,
    },
    {
      name: 'Trebor Scholz',
      work: 'Platform Cooperativism, 2016',
      body: `Scholz made the case for technology platforms owned and governed by the people who use them, not by investors seeking extraction. What if Uber were owned by its drivers? What if Airbnb were governed by its hosts? Karmyq is not technically a cooperative, but it shares the foundational commitment: the platform serves its communities, not the other way around. No venture capital mandate. No growth at any cost. The value created by communities stays with communities.`,
    },
    {
      name: 'Rutger Bregman',
      work: 'Humankind, 2020',
      body: `Bregman makes a case from history and psychology that the default human orientation toward strangers is not hostility or indifference but curiosity and goodwill — that the vision of human nature as fundamentally selfish is not a scientific finding but a cultural assumption, and one the evidence consistently contradicts. His argument matters for Karmyq because the platform's viability depends on it being at least partially true. If people are, at their default, oriented toward connection and mutual aid, and the platform just needs to create conditions for that default to express itself — then it can work.`,
    },
    {
      name: 'David Graeber',
      work: 'Debt: The First 5,000 Years, 2011',
      body: `Graeber argues that money, in its current form, is not a neutral tool for exchange but a system of debt that has colonized human relationships and displaced the gift economies that once organized social life. His work, alongside Mauss, provides the intellectual grounding for Karmyq's decision to keep money out of its core mechanics — not because money is evil, but because the platform is trying to rebuild the kind of relationship infrastructure that monetary transaction tends to dissolve.`,
    },
  ],
  closingHeading: 'Held as hypotheses, not doctrines.',
  closingBody:
    `These thinkers don't agree with each other on everything. Haidt's conservatism about human nature sits uncomfortably next to Bregman's optimism. Putnam's diagnosis is contested in its details. Ostrom's findings have been disputed in specific cases even as they've held in aggregate. We hold these ideas as working hypotheses. If the research evolves, we want to evolve with it. If you know something we don't — a study, a tradition, a community practice that complicates this picture — we want to hear it.`,
  closingCta: { label: 'Researchers: the platform is a living laboratory. Join the circle', href: '/join' },
};

// ── Join (route: /join) ────────────────────────────────────────────────────

export interface Lane {
  audience: string;
  body: string;
  cta: LinkRef;
}

export interface JoinContent {
  heading: string;
  intro: Block[];
  tagline: string[];
  howToJoinHeading: string;
  howToJoinBody: string;
  lanesHeading: string;
  lanes: Lane[];
  support: { before: string; linkLabel: string; linkHref: string; after: string };
}

export const joinContent: JoinContent = {
  heading: 'Join the founding circle.',
  intro: [
    p(
      `We want to understand before we build, and prove it before we ask anyone to depend on it. So we're starting with a founding circle — and that circle will be Karmyq's first community. We'll use the platform to organize the people building the platform. If it can't hold us, it isn't ready for anyone else.`
    ),
    p(
      `This is not a waitlist for an app. It is an invitation to a working conversation: what would make Karmyq safe, useful, and legible enough for real communities to trust?`
    ),
    p(
      `The circle needs people who understand trust, civic systems, services, caregiving, governance, open-source software, design, research, and the messy reality of local life — community organizers, social workers, therapists, educators, local-service providers, civic technologists, open-source builders, researchers. People who have actually had to make trust work in a group.`
    ),
    p(
      `If that sounds like your lens, the ask is simple: pressure-test the idea, name what is missing, and help decide what the platform must become before it asks more communities to depend on it.`
    ),
    p(`This is early, personal, and intentionally small. The goal is not hype. The goal is better judgment.`),
  ],
  tagline: [
    'Come with your expertise. Come with your skepticism.',
    'Come with the part of you that still believes local trust can be rebuilt without turning neighbors into customers.',
  ],
  howToJoinHeading: 'How to join.',
  howToJoinBody:
    `Send a short note with your lens, what you can contribute, and the hardest concern you think the project needs to face.`,
  lanesHeading: 'The circle needs more than software.',
  lanes: [
    {
      audience: 'For specialists',
      body: `Bring lived expertise from care, local services, education, facilitation, therapy, public health, design, or civic systems. Help define what trust needs before the platform scales.`,
      cta: {
        label: 'Write your note',
        href: '#join-form',
      },
    },
    {
      audience: 'For builders',
      body: `Karmyq is open source. Help turn the proof-of-concept into durable commons infrastructure: safer flows, clearer docs, better governance, and fewer sharp edges for communities.`,
      cta: { label: 'View on GitHub', href: 'https://github.com/ravichavali/karmyq' },
    },
    {
      audience: 'For organizers',
      body: `Pressure-test whether this can serve real groups: mutual aid circles, neighborhood associations, cohousing communities, school networks, and local experiments in cooperation.`,
      cta: {
        label: 'Write your note',
        href: '#join-form',
      },
    },
  ],
  support: {
    before: 'You can also support the work directly on ',
    linkLabel: 'OpenCollective',
    linkHref: 'https://opencollective.com/karmyq',
    after: ' — every contribution funds infrastructure, not extraction.',
  },
};

// ── Cross-route helpers ────────────────────────────────────────────────────

/** Titles of the design essays — exactly the merged/renamed set. */
export const ESSAY_TITLES: string[] = howItWorksContent.essays.map((e) => e.title);

/** Every visible string of copy across all five routes, for forbidden scans. */
export function allRouteText(): string {
  const parts: string[] = [];

  // Home
  parts.push(blocksToText(homeContent.hero));
  parts.push(homeContent.thinkingLabel);
  parts.push(blocksToText(homeContent.thinking));
  parts.push(homeContent.whyLabel);
  parts.push(homeContent.heroCtas.map((c) => c.label).join(' '));
  parts.push(homeContent.thinkingCtas.map((c) => c.label).join(' '));
  parts.push(homeContent.founderNote.eyebrow, homeContent.founderNote.location);
  parts.push(...homeContent.founderNote.paragraphs);
  parts.push(homeContent.founderNote.attribution);
  parts.push(homeContent.closingLine);
  parts.push(...homeContent.standTogether);

  // Principles
  parts.push(principlesContent.heading, principlesContent.intro);
  for (const pr of principlesContent.principles) parts.push(pr.name, pr.body);
  parts.push(principlesContent.closingCta.label);

  // How it works
  parts.push(howItWorksContent.heading);
  for (const seg of howItWorksContent.segments) {
    if (seg.type === 'prose') parts.push(blocksToText(seg.blocks));
    else if (seg.type === 'feature') parts.push(seg.title, seg.body);
    else if (seg.type === 'essay')
      parts.push(seg.essay.eyebrow, seg.essay.title, seg.essay.subtitle, blocksToText(seg.essay.body));
    else if (seg.type === 'timeline') {
      parts.push(seg.label, blocksToText(seg.lead));
      for (const it of seg.items) parts.push(it.when, it.act);
    }
  }
  parts.push(howItWorksContent.closingCta.label);

  // Research
  parts.push(researchContent.heading, researchContent.intro);
  for (const t of researchContent.thinkers) parts.push(t.name, t.work, t.body);
  parts.push(researchContent.closingHeading, researchContent.closingBody, researchContent.closingCta.label);

  // Join
  parts.push(joinContent.heading, blocksToText(joinContent.intro));
  parts.push(...joinContent.tagline);
  parts.push(joinContent.howToJoinHeading, joinContent.howToJoinBody, joinContent.lanesHeading);
  for (const lane of joinContent.lanes) parts.push(lane.audience, lane.body, lane.cta.label);
  parts.push(joinContent.support.before, joinContent.support.linkLabel, joinContent.support.after);

  return parts.join('\n');
}
