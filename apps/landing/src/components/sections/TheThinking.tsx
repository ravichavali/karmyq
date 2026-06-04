'use client';

import AnimateOnScroll from '../AnimateOnScroll';

const DEEPER_LINKS = [
  {
    title: 'The Problem with Stars',
    subtitle: 'Why we hid the metrics',
    href: '#deeper-reputation',
  },
  {
    title: 'In Defense of Gossip',
    subtitle: 'Reclaiming the original social network',
    href: '#deeper-gossip',
  },
  {
    title: 'The Complete Village',
    subtitle: 'How commerce fits into community',
    href: '#deeper-services',
  },
  {
    title: 'The Research Foundation',
    subtitle: 'Who we’re standing on',
    href: '#deeper-research',
  },
];

export default function TheThinking() {
  return (
    <section id="thinking" className="section-padding bg-organic-1">
      <div className="container-narrow">
        {/* Section label */}
        <AnimateOnScroll>
          <div className="flex items-center gap-4 mb-14">
            <p className="text-karmyq-green-600 font-medium text-xs tracking-widest uppercase whitespace-nowrap">
              The thinking
            </p>
            <div className="flex-1 h-px bg-karmyq-brown-200" />
          </div>
        </AnimateOnScroll>

        {/* 1 — Trust when you can afford to */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            Trust when you can afford to.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-16">
            <p>
              Think of your most reliable friend. The one who showed up at 2am. You don&apos;t save them
              for emergencies. You call them first, because they&apos;ve earned it.
            </p>
            <p>
              That logic applies at the community scale, and we&apos;ve abandoned it. The contracts,
              ratings, background checks, platform guarantees we layer over modern life are inferior
              substitutes. Trust between people who actually know each other came before all of them,
              and still outperforms them when conditions allow.
            </p>
            <p>
              Crisis doesn&apos;t create trust. It reveals the trust that was already there.
            </p>
            <p>
              Karmyq is built on the logic we apply to our best friends. The point isn&apos;t to prepare
              for the crisis. It&apos;s to stop deferring to inferior systems.
            </p>
          </div>
        </AnimateOnScroll>

        {/* 2 — We didn't choose distrust */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            We didn&apos;t choose distrust. We slipped into it.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-16">
            <p>
              A century ago, sociologists noticed something. As cities grew and institutions expanded,
              people stopped relying on each other and started relying on systems. The personal gave way
              to the procedural. Relationships were replaced, slowly, by contracts. Neighbors became
              strangers who happened to share a wall.
            </p>
            <p>
              This wasn&apos;t malice. It was convenience, compounded. <em>Just to be safe</em>, we stopped letting
              children walk to school alone. <em>Just to be safe</em>, we stopped lending things to people we
              didn&apos;t know well. <em>Just to be safe</em>, we stopped assuming good intent from people we hadn&apos;t
              vetted. Each retreat from vulnerability was locally rational. Applied at scale, across generations,
              they hollowed out the social fabric.
            </p>
            <p>
              Our abundance of safety and comfort quietly destroyed the conditions in which trust grows. We
              optimized away the friction that makes people need each other. A society that never practices
              trusting loses the capacity for it.
            </p>
            <p>There is no villain in this story. That is what makes it hard to fix.</p>
          </div>
        </AnimateOnScroll>

        {/* 3 — Who gets believed */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            Who gets believed is not random.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-16">
            <p>
              Hannah Arendt showed that evil doesn&apos;t need monsters. Ordinary people, going along,
              not asking questions, are enough.
            </p>
            <p>
              We&apos;ve internalized it halfway — applied outward only. Sophisticated about institutions.
              Suspicious of strangers.
            </p>
            <p>
              The harder move — what Arendt actually pointed toward — is inward. <em>I</em> am the
              ordinary person who might be participating in something I haven&apos;t examined.
            </p>
            <p>
              The third move, which almost nobody makes: extend to others the assumption of banal
              goodness. The same person who can thoughtlessly harm can also thoughtlessly help, when
              conditions allow. The Covid kitchens weren&apos;t heroic — they were the ordinary human
              response when the systems that usually mediate it fell away.
            </p>
            <p>
              We&apos;ve learned to see the banality of evil in others. We haven&apos;t learned to see the
              banality of goodness in the same people. That asymmetry is most of what passes for caution
              about strangers.
            </p>
            <p>
              Karmyq is not asking for heroism. It builds conditions in which the banal goodness already
              there has somewhere to go. Standing comes from acts, not identity — because acts are the
              only evidence of the goodness that was always present.
            </p>
          </div>
        </AnimateOnScroll>

        {/* 4 — Short-termism */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            Short-termism won. The bill is coming due.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-6">
            <p>
              Exploitation was never irrational. It optimized for the wrong horizon. Colonialism extracted
              real wealth. Industrial monocultures fed billions. The structures that overran slower, more
              woven ways of living <em>worked</em> — in the near term. What they consumed had taken
              generations to build and broke in a fraction of the time. It lost anyway.
            </p>
            <p>
              The same arithmetic gave us mutually assured destruction, a warming planet, and the quiet
              emptying-out of communities that once held each other.
            </p>
          </div>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.15}>
          <blockquote className="pull-quote mb-10">
            The simplification that got us here won&apos;t get us there. We traded the density of human
            cooperation for something that scales — and left the soul of community somewhere behind us.
          </blockquote>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.2}>
          <div className="space-y-5 body-large mb-16">
            <p>
              Biology already knows this shape. A body is the proof that cooperation scales: trillions of
              cells holding specialized, interdependent roles. Cancer is what happens when one line of cells
              abandons the contract — it simplifies, stops specializing, grows fast, takes everything near
              it, and wins, locally, right up until it kills the thing that fed it. The pattern that overran
              the slower world followed the same logic. Simpler. Faster. Blind to the whole it depended on.
            </p>
            <p>
              That is the trade we keep making, now at the scale of a civilization. The cost never
              disappears. It moves downstream — paid late, by people who never signed the cheque.
            </p>
            <p>
              Cooperation has always been the slower game. It asks for investment before return, trust before
              certainty, the willingness to believe the person across from you is worth the risk — before
              they&apos;ve given you proof. That belief is the hard part. Not because people aren&apos;t good, but
              because no one wants to be the only one who is.
            </p>
            <p>
              Karmyq is a bet on that slower game. Not because it always wins — it often hasn&apos;t — but
              because the thing that beat it is now coming due, and because the one ingredient cooperation
              always needed was people able to see the good in each other before they had to gamble on it.
              We&apos;re not asking anyone to become good. We&apos;re making the goodness already here visible
              enough to trust, close enough to act on, and local enough to begin with your neighbors.
            </p>
          </div>
        </AnimateOnScroll>

        {/* 5 — Communities find their own trust */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            Communities find their own trust.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-16">
            <p>
              Bees coordinate at massive scale — but on simple tasks. Humans, with larger brains and richer
              culture, can coordinate on astonishingly complex ones. But until recently we lacked the
              technological scaffolding to do both: complex cooperation, at community scale. We built technology
              that scales monocultures — one marketplace, one social network, one way to interact. What if
              instead we built technology that scales diversity — infrastructure that supports a thousand
              different ways of cooperating, each adapted to its community, its culture, its people?
            </p>
            <p>
              We are not arguing that more trust is always better. Every healthy ecosystem has its own immune
              system. Trust extended carelessly is not generosity — it is naivety, and communities that
              practice it don&apos;t survive long enough to learn from it.
            </p>
            <p>
              What we are arguing is that the right trust model, for the right community, in the right
              context, is what allows a community to flourish. Karmyq provides the tools for that experiment.
              Communities try things. They configure how trust flows, what acts are honored, how standing is
              earned and lost. A community that contracts inward slowly stops functioning. One that finds its
              right level grows stronger with every interaction.
            </p>
            <p>
              We are not building a utopia. We are building a framework for communities to discover, over
              time, what they are capable of.
            </p>
          </div>
        </AnimateOnScroll>

        {/* 6 — Village economy */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            The village economy was never purely a gift.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-16">
            <p>
              The blacksmith got paid. So did the healer. The village didn&apos;t run on pure charity — it ran
              on relationship. Commerce happened inside a web of people who knew each other. That&apos;s what we
              lost. Not the money. The knowing.
            </p>
            <p>
              We&apos;ve been building toward the gift economy end of that spectrum — and rightly so. Communities
              that can help each other freely, without keeping score, are building something real. But we
              don&apos;t live in a world where everyone can afford to give their time and skill without
              compensation, and pretending otherwise serves no one.
            </p>
            <p>
              Karmyq reflects the full village. Communities that choose to can enable a professional services
              layer — local providers offering paid work through the same trust infrastructure as everything
              else. Karmyq never touches the money; it only coordinates the connection. The payment happens
              directly between people who already know each other. This is not a marketplace. It is what
              becomes possible after trust has been established.
            </p>
          </div>
        </AnimateOnScroll>

        {/* 7 — Trust wasn't taken from us. We forgot how. */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            Trust wasn&apos;t taken from us. We forgot how.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-16">
            <p>
              For most of human history, trusting the people nearby was a skill you practiced daily,
              because nothing else held the community together. Then we built things that could hold it
              for us: institutions, contracts, platforms, ratings. Each one let us extend a little less
              of ourselves to the people around us, because the system would vouch for them instead. It
              was convenient. It also let the muscle go slack. The capacity to read a stranger, take a
              small risk on them, and let it come back — we have less practice with that now. Not because
              anyone took it, but because we stopped needing it day to day. That&apos;s the harder thing
              to admit: the loss was partly ours.
            </p>
            <p>
              When you help someone through a platform, who holds the memory of it? Not your neighbors.
              The platform does — it records the transaction, updates a score, files the signal in a
              database it owns. You helped. But your community never finds out, and you never build
              anything with the person you helped. The relationship that should have thickened between
              you stays exactly as thin as it started. That&apos;s the real cost — not just that the stars
              vanish when you leave, but that the platform sat between you the whole time, making sure a
              transaction never became a tie. Platforms are built for volume: many people, many exchanges,
              every connection kept thin enough to scale. Depth doesn&apos;t monetize.
            </p>
            <p>
              A village did the opposite — and we should be honest about how it worked. When you helped a
              neighbor, others came to know, not because anyone announced it but because life was lived in
              the open. Helping Alice meant Bob trusted you more, even though Bob never saw it happen.
              Reputation wasn&apos;t a number; it was ambient, alive, repaid not once but for years. That
              was the warmth. It also had teeth: the same machinery that rewarded generosity punished
              difference, remembered every mistake, and gave you nowhere to hide. Ambient reputation and a
              social credit score run on the same engine. The village isn&apos;t a paradise to restore.
              It&apos;s a mechanism to learn from — keep the echo, lose the panopticon.
            </p>
            <p>
              Karmyq is built to return the echo without the surveillance. What you&apos;ve done is never
              broadcast to the community — that would be surveillance with better branding. Instead, the
              pattern of your acts quietly shapes the connections the system makes: which requests reach
              you, how much trust you carry into a new community, how short the path runs between you and a
              stranger. And then the system is designed to forget. The details of an interaction expire
              after a few months, the way human memory does; what persists is the shape of your
              relationships, not a ledger of them. No corporation should hold that record in escrow. Your
              community keeps its own rules, its own context, and its own trust model — and the system is
              built so those relationships are not trapped inside the platform. The trust is yours because
              nothing is standing in escrow on your behalf.
            </p>
            <p>
              And success here looks strange for a platform: it&apos;s measured by how little you end up
              needing it. A ride coordinated through Karmyq today should, over months, become a phone call
              between two people who simply trust each other. The platform lives at the edge of your trust
              network — among the not-yet-neighbors — and its job is to keep dissolving that edge,
              graduating relationships out into ordinary life while new strangers arrive to begin the same
              passage. It&apos;s scaffolding. The whole point is to be outgrown. That is the opposite of
              what platforms are built to do.
            </p>
          </div>
        </AnimateOnScroll>

        {/* 8 — This is a beginning */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            This is a beginning.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-16">
            <p>
              The ideas here reach back further than this platform. Elinor Ostrom demonstrated that
              communities can govern shared resources more effectively than markets or states — given the
              right institutional design. Robin Dunbar mapped the cognitive limits of genuine relationship.
              Joseph Henrich showed that culture — the accumulated capacity to cooperate across generations —
              is humanity&apos;s real competitive advantage, and that it is fragile. Marcel Mauss described what
              gift economies do that markets cannot: they create bonds that transactions destroy.
            </p>
            <p>These are not footnotes. They are load-bearing walls.</p>
            <p>
              We have done our best to build on them honestly. But a platform built by a small team,
              drawing on one tradition, will only become what it needs to be if people from every walk of
              life bring their own understanding to it, find what we got wrong, and build something better.
              That openness is not a disclaimer. It is the design.
            </p>
          </div>
        </AnimateOnScroll>

        {/* Go Deeper cluster */}
        <AnimateOnScroll delay={0.15}>
          <div className="mt-4 p-8 border border-karmyq-brown-200 bg-karmyq-cream">
            <p className="text-karmyq-green-600 font-medium text-xs tracking-widest uppercase mb-3">
              Go deeper
            </p>
            <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mb-6">
              The ideas behind the design decisions
            </h3>
            <div className="divide-y divide-karmyq-brown-200">
              {DEEPER_LINKS.map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  className="flex items-center justify-between py-4 text-karmyq-green-700 hover:text-karmyq-brown-900 transition-colors group"
                >
                  <span className="text-sm">
                    <span className="font-medium">{link.title}</span>
                    <span className="text-karmyq-brown-400 ml-2">— {link.subtitle}</span>
                  </span>
                  <span className="text-karmyq-brown-300 group-hover:text-karmyq-brown-700 transition-colors ml-4">
                    →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
