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
              Think of your most reliable friend. The one who showed up at 2am, who never once let you
              down. You don&apos;t save them for emergencies — you call them first, because they&apos;ve earned it.
              Demonstrated reliability becomes the reason to rely on them more.
            </p>
            <p>
              Trust works the same way. In every flood, every crisis, every moment where the structures fall
              away, people show up for each other without being asked. Trust proves itself, every time.
            </p>
            <p>
              And yet we treat it as a last resort. We reach for it only after the contract, the rating, the
              background check, the platform guarantee have all been exhausted. We&apos;ve seen what trust can do,
              and we still won&apos;t call it first.
            </p>
            <p>
              Karmyq is built on the logic we already apply to our best friends. Trust has earned the right
              to be used freely. We want to help communities build enough of it — before the crisis — so that
              when things fall apart, it&apos;s the first call, not the last.
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
              A century ago, sociologists noticed something happening to modern societies. As cities grew and
              institutions expanded, people stopped relying on each other and started relying on systems. The
              personal gave way to the procedural. Relationships were replaced, slowly, by contracts. Neighbors
              became strangers who happened to share a wall.
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
              trusting loses the capacity for it — as surely as a muscle that is never used.
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
              When trust between strangers is scarce, we don&apos;t abandon it — we ration it. And rationed trust
              flows to the familiar. Accent. Postcode. University. Skin. These become the signals that open
              doors — not because they reliably predict trustworthiness, but because they approximate it
              cheaply. In a world where we can&apos;t afford to find out who someone actually is, we use shorthand.
            </p>
            <p>The shorthand is inherited. It is not neutral.</p>
            <p>
              A world that runs on false trust signals selects for people who are good at{' '}
              <em>performing</em> trustworthiness rather than practicing it. It is, by design, exploitable.
              And the cruelest part: those who exploit it rarely feel they are doing anything wrong. The system
              taught them the signals. They learned to perform them. This is rational behavior inside an
              irrational structure.
            </p>
            <p>
              Karmyq ties standing to acts, not identity. What you&apos;ve done inside a community is what the
              community knows about you. The platform cannot eliminate the biases people bring to their
              choices — no platform can — but it can refuse to amplify them.
            </p>
          </div>
        </AnimateOnScroll>

        {/* 4 — Short-termism */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            Short-termism won. The bill is arriving.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-6">
            <p>
              We should be honest about this. Exploitation is not irrational — it optimizes for the wrong
              horizon. Colonialism extracted real wealth. Industrial monocultures fed billions. The structures
              that dismantled slower, more sustainable cultures <em>worked</em>, in the near term. The peoples
              and ecosystems they consumed had spent generations building something more durable. They lost
              anyway.
            </p>
            <p>
              The same arithmetic gave us mutually assured destruction. Climate change. The quiet collapse of
              social trust in communities that once held each other.
            </p>
          </div>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.15}>
          <blockquote className="pull-quote mb-10">
            &ldquo;The simplification that got us here won&apos;t get us there. We traded the rich complexity of
            human cooperation for something that scales — and lost the soul of community in the process.&rdquo;
          </blockquote>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.2}>
          <div className="space-y-5 body-large mb-16">
            <p>
              Ecologists call it a tragedy of the commons: when individual short-term interest and collective
              long-term survival point in opposite directions, individuals win and collectives pay. We have
              run this experiment at planetary scale. The results are in.
            </p>
            <p>
              <strong>The bill is always paid late, and by people who did not write the cheque.</strong>
            </p>
            <p>
              Collaboration has always been slower. It requires investment before return, trust before
              certainty, the willingness to believe that the person across from you is worth the risk.
              Karmyq is a bet on the longer game — the only game, historically, that anyone has ever won
              for long.
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

        {/* 7 — Trust has been taken from us */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            Trust has been taken from us.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-16">
            <p>
              When you help someone through a platform, who knows? The platform does. It records the
              transaction, updates a score, stores the signal. The act of trust — the thing that should
              reverberate through your community — gets absorbed into a database that belongs to a
              corporation. You helped. But the community doesn&apos;t know.
            </p>
            <p>
              In a functioning village, generosity was never private. When you helped a neighbor, others
              witnessed it. The act traveled through conversation, through presence, through what
              anthropologists describe as the round-robin of social life — repaid not once but repeatedly,
              because everyone knew, and knowing changed how they treated you. Reputation wasn&apos;t a number.
              It was ambient knowledge, alive in the community. Helping Alice meant Bob trusted you more,
              even without ever seeing it happen. Good deeds echoed.
            </p>
            <p>
              Modern platforms broke that echo. They captured the trust relationship and put it in escrow —
              holding it on behalf of people who could have held it themselves. They gave you a star rating
              instead of a reputation. When you leave the platform, the stars vanish. The relationship was
              never yours.
            </p>
            <p>
              Karmyq is designed to return the echo. Acts of helping inside a community become visible —
              not as scores, but as the kind of textured, ambient knowledge that villages ran on for
              millennia. Deliberately not reducible to a single number, because a single number can be
              gamed and a genuine reputation cannot. The community knows who shows up. That knowing —
              distributed, living, resistant to extraction — is the infrastructure.
            </p>
            <p>
              And the measure of success is not how much you use this platform. It is how little you
              eventually need to. A ride coordinated here today should, over time, become a phone call
              between people who trust each other. The platform is scaffolding — meant to be outgrown.
              That is the opposite of what platforms are built to do.
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
