'use client';

import { useState } from 'react';
import AnimateOnScroll from '../AnimateOnScroll';

interface ThinkerProps {
  name: string;
  work: string;
  children: React.ReactNode;
}

function Thinker({ name, work, children }: ThinkerProps) {
  return (
    <div className="border-l-4 border-karmyq-green-300 pl-6 py-2 my-6 bg-white/60">
      <p className="font-serif text-lg font-semibold text-karmyq-green-700 mb-0.5">{name}</p>
      <p className="text-xs text-karmyq-brown-400 uppercase tracking-wide mb-3">{work}</p>
      <div className="text-karmyq-brown-600 leading-relaxed text-sm space-y-2">{children}</div>
    </div>
  );
}

interface AccordionProps {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function Accordion({ id, eyebrow, title, subtitle, children }: AccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div id={id} className={`rounded-2xl overflow-hidden border ${open ? 'border-karmyq-green-300' : 'border-karmyq-brown-200'} bg-karmyq-cream`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-karmyq-green-50/50 transition-colors"
        aria-expanded={open}
      >
        <div>
          <p className="text-xs font-medium text-karmyq-green-600 uppercase tracking-widest mb-1">
            {eyebrow}
          </p>
          <p className="font-serif text-lg font-medium text-karmyq-brown-900">{title}</p>
          <p className="text-xs text-karmyq-brown-400 mt-0.5">{subtitle}</p>
        </div>
        <span
          className={`text-karmyq-green-500 text-xl flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ↓
        </span>
      </button>

      {open && (
        <div className="px-6 pb-8 pt-2 border-t border-karmyq-brown-200">
          {children}
        </div>
      )}
    </div>
  );
}

export default function DeeperSections() {
  return (
    <section id="deeper" className="section-padding bg-karmyq-brown-50/40">
      <div className="container-narrow">
        <AnimateOnScroll>
          <div className="flex items-center gap-4 mb-14">
            <p className="text-karmyq-brown-400 font-medium text-xs tracking-widest uppercase whitespace-nowrap">
              Go deeper
            </p>
            <div className="flex-1 h-px bg-karmyq-brown-200" />
          </div>
        </AnimateOnScroll>

        <div className="space-y-3">

          {/* 1 — The Problem with Stars */}
          <AnimateOnScroll>
            <Accordion
              id="deeper-reputation"
              eyebrow="Deep dive · Reputation"
              title="The Problem with Stars"
              subtitle="Why we hid the metrics"
            >
              <div className="space-y-5 mt-4 text-sm text-karmyq-brown-700 leading-relaxed">

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  The problem with scores.
                </h3>
                <p>
                  Every platform that has tried to build trust through reputation has converged on the same
                  solution: a number. One to five stars. A score out of a hundred. The number is clean,
                  portable, instantly legible. It is also, almost immediately, the thing people start to game.
                </p>
                <p>
                  This is not a character flaw. It is a predictable response to an incentive structure. When
                  a visible number determines how much opportunity you get, optimizing for the number becomes
                  rational. Drivers learn which behaviors produce five-star ratings. Sellers learn how to
                  solicit reviews. The number, designed to represent trustworthiness, becomes a performance
                  of trustworthiness — and the two quietly diverge.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  What reputation actually is.
                </h3>
                <p>
                  Anthropologists who study small-scale societies describe something they call ambient social
                  knowledge — the distributed, informal understanding that a community holds about its
                  members. Who shows up. Who follows through. Who helps without being asked. Who disappears
                  when things get hard.
                </p>
                <p>
                  This knowledge doesn&apos;t live in any one person&apos;s head. It lives in the community —
                  accumulated through witnessed acts, passed through conversation, updated constantly through
                  ongoing interaction. It is textured and contextual in ways that no number can capture.
                  Robin Dunbar&apos;s research on community size describes why this works at the scale of roughly
                  150 people: within that range, we can maintain genuine knowledge of each other. Above it,
                  we start to rely on proxies. Karmyq&apos;s community size limit is not arbitrary. It is the
                  boundary within which ambient social knowledge remains possible.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  Why you can&apos;t see anyone&apos;s karma.
                </h3>
                <p>
                  In Karmyq, karma is not visible between members. You cannot look up another person&apos;s
                  score. You must opt in even to see your own. This is the most counterintuitive design
                  decision we made, and the one we are most confident about.
                </p>
                <p>
                  A karma score that members can see is a score that members will optimize for. Visible
                  numbers create leaderboards, even when no leaderboard is intended. They shift attention
                  from the act of helping to the reward for helping — and that shift, subtle as it sounds,
                  changes the nature of the act. What exists instead is something closer to how reputation
                  actually works in communities that function: the community has ambient knowledge of who
                  shows up, built through witnessed acts, without anyone holding a public ledger.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  How karma is actually earned.
                </h3>
                <p>
                  Every completed interaction generates karma for both people — the person who helped, and
                  the person who asked. Asking for help is not passive. It is an act of vulnerability that
                  makes the interaction possible. A community where only givers accumulate standing is a
                  community that will run out of people willing to ask.
                </p>
                <p>
                  Communities configure the split between helper and requester, and the size of the pool
                  each interaction draws from. Additional standing accumulates at milestones: a first
                  interaction in a community, a tenth completed exchange, a fiftieth, a hundredth.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  How karma fades.
                </h3>
                <p>
                  Karma records are never deleted. But they contribute less over time, using a six-month
                  half-life. An interaction from three years ago is still in the record — it just carries a
                  fraction of the weight it did when it was recent. This mirrors how human memory and
                  reputation actually work. What remains after the fading is a living picture of who someone
                  is in this community, right now.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  What it all adds up to.
                </h3>
                <p>
                  Karma is not a score. It is a pattern — the accumulated shape of someone&apos;s presence in
                  a community over time. It feeds into a trust score that incorporates five signals: volume
                  of recent interactions, quality of feedback, depth of relationships with repeat partners,
                  breadth of connections, and milestone recognition. The trust score is what other systems
                  in the platform use — to weight the community feed, determine eligibility for the services
                  layer, seed trust when someone joins a new community. But even the trust score is not
                  shown as a number between members. It is infrastructure, not interface.
                </p>
              </div>
            </Accordion>
          </AnimateOnScroll>

          {/* 2 — In Defense of Gossip */}
          <AnimateOnScroll delay={0.05}>
            <Accordion
              id="deeper-gossip"
              eyebrow="Deep dive · Reputation design"
              title="In Defense of Gossip"
              subtitle="Reclaiming the original social network"
            >
              <div className="space-y-5 mt-4 text-sm text-karmyq-brown-700 leading-relaxed">

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  First, reclaim the word.
                </h3>
                <p>
                  Gossip has a reputation problem. In contemporary usage it means malice — the spreading
                  of rumor, the pleasure taken in another&apos;s embarrassment. But this is a narrow and recent
                  meaning. Anthropologists use the word differently, and more usefully: gossip is the
                  informal circulation of social information through a community. Who helped whom. Who
                  didn&apos;t follow through. Who can be relied upon.
                </p>
                <p>
                  Robin Dunbar argues that gossip is the primary mechanism by which humans maintain social
                  relationships at the scale we live at. Physical grooming — the touch and direct contact
                  that primates use to maintain bonds — doesn&apos;t scale beyond small groups. Language does.
                  Gossip, in this sense, is social grooming at scale: the way communities stay current on
                  each other, the way reputation travels, the way trust is built without requiring direct
                  observation of every act.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  Why numbers fail at this.
                </h3>
                <p>
                  The temptation to reduce reputation to a number is understandable. But the act of
                  assigning a number to reputation changes what reputation is. A visible score is a score
                  people optimize for. Sociologists distinguish between <em>particularized trust</em>,
                  which develops through direct relationship, and <em>generalized trust</em>, which extends
                  to strangers. Platforms that use star ratings are trying to manufacture generalized trust
                  through a shortcut. Karmyq is trying to build particularized trust through practice.
                  The opacity is not a workaround. It is the mechanism.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  How reputation actually travels in Karmyq.
                </h3>
                <p>
                  Because karma is not visible as a number, it has to travel the way reputation travels
                  in functioning communities — through interaction, observation, and the ambient knowledge
                  that accumulates when people share a space over time. When an act of helping is
                  completed, it becomes visible as a thread in the social fabric. People who interact
                  with the helper carry forward the knowledge of what they&apos;ve witnessed. Over time, a
                  picture forms — distributed across the community — of who this person is and how they
                  show up.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  Trust paths: the web made visible.
                </h3>
                <p>
                  One thing Karmyq does make visible is connection — not reputation, but relationship.
                  If you&apos;re considering trusting someone you don&apos;t know directly, the platform can show
                  you how you&apos;re connected. Through whom. How many steps. What kind of connection — a
                  completed exchange, a shared community, a mutual introduction. Up to four degrees of
                  separation.{' '}
                  <em>I trust Maria. Maria trusts David. I don&apos;t know David yet, but I know something
                  about him that I wouldn&apos;t know about a stranger.</em>
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  How standing travels between communities.
                </h3>
                <p>
                  When you join a community where no one knows you yet, you don&apos;t start from zero. A
                  portion of the trust you&apos;ve built elsewhere — weighted and capped by what that community
                  decides to accept — travels with you as a floor. Think of it as a letter of introduction.
                  Not full trust. But something — enough to signal that other communities have found you
                  reliable. Each community controls how much of this they&apos;re willing to accept.
                </p>
              </div>
            </Accordion>
          </AnimateOnScroll>

          {/* 3 — The Complete Village */}
          <AnimateOnScroll delay={0.1}>
            <Accordion
              id="deeper-services"
              eyebrow="Deep dive · Service layer"
              title="The Complete Village"
              subtitle="How commerce fits into community"
            >
              <div className="space-y-5 mt-4 text-sm text-karmyq-brown-700 leading-relaxed">

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  The village economy was always complete.
                </h3>
                <p>
                  There is a version of the community platform story that goes like this: money is the
                  problem, markets are the disease, and the cure is a world where everything is freely
                  given. It is a romantic vision. It is also, for most people in most circumstances,
                  impossible to live inside.
                </p>
                <p>
                  The village economies that Karmyq draws on were never purely gift economies. The
                  blacksmith charged for his work. The healer expected payment, in coin or in kind. What
                  made these economies different from what we have now was not the absence of money — it
                  was the presence of relationship. Commerce happened inside a web of mutual knowledge and
                  ongoing obligation. That web is what we&apos;ve lost. Not the commerce — the relationship
                  that contained it. The service layer is not a concession. It is the honest completion
                  of the model.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  The philosophical tension, addressed directly.
                </h3>
                <p>
                  Does enabling paid services inside a trust-based platform corrupt the trust culture
                  it&apos;s trying to build? Research on motivation consistently shows that introducing payment
                  into relationships that were previously gift-based can crowd out the intrinsic motivation
                  that made those relationships function. This is why the service layer is opt-in at the
                  community level. Some communities will choose to keep everything gift-based. Some will
                  want the full village model. The philosophical question is not resolved by us — it is
                  held by each community, and answered through practice.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  One identity. One history.
                </h3>
                <p>
                  When a community enables professional services, members who choose to can activate a
                  provider profile — a professional extension of their existing identity. This is not a
                  second account. It is not a separate persona with a separate reputation. It is an
                  additional layer on the same person, drawing on the same trust history.
                </p>
                <p>
                  The neighbor who helped three people move last year, who lent their van to someone they
                  barely knew, who has been showing up consistently for eight months — that history is the
                  context in which their professional services are offered.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  Karmyq never touches money.
                </h3>
                <p>
                  This is absolute and deliberate. Karmyq does not process payments, hold funds, or take
                  a percentage. The moment money flows through a platform, the platform becomes a financial
                  intermediary with the interests of a financial intermediary. Karmyq&apos;s role is to
                  establish the conditions in which direct dealing is possible — and then step back.
                </p>

                <h3 className="font-serif text-xl font-semibold text-karmyq-brown-900 mt-6 mb-3">
                  The long arc.
                </h3>
                <p>
                  The deepest hope for the service layer is that it eventually makes itself unnecessary.
                  A community member discovers a local electrician through Karmyq. Trust develops. After
                  a year, they don&apos;t need the platform to coordinate anymore. They call directly. That is
                  not a failure. That is what success looks like.
                </p>
              </div>
            </Accordion>
          </AnimateOnScroll>

          {/* 4 — The Research Foundation */}
          <AnimateOnScroll delay={0.15}>
            <Accordion
              id="deeper-research"
              eyebrow="Deep dive · Research"
              title="The Research Foundation"
              subtitle="Who we're standing on"
            >
              <div className="mt-4">
                <p className="text-sm text-karmyq-brown-600 leading-relaxed mb-6">
                  These ideas didn&apos;t begin with us. They began with researchers who spent careers studying
                  how humans actually cooperate — what conditions make it possible, what conditions destroy
                  it, what we lose when it breaks down. Every significant design decision in Karmyq has
                  a thread that runs back to this work. We present it here not as credentials, but because
                  if you pull these ideas out, the platform&apos;s logic collapses.
                </p>

                <Thinker name="Elinor Ostrom" work="Governing the Commons, 1990 · Nobel Prize in Economics, 2009">
                  <p>
                    Ostrom demonstrated something economists had assumed was impossible: that communities
                    could govern shared resources effectively without either privatizing them or turning
                    them over to the state. She looked at communities managing fisheries, forests,
                    irrigation systems, and grazing lands — and found that many had been doing so
                    sustainably for centuries, through self-designed institutional rules, monitored by
                    community members, enforced through graduated sanctions, and adaptable over time.
                    The conditions she identified for successful commons governance are the design
                    principles behind Karmyq&apos;s community configuration model.
                  </p>
                </Thinker>

                <Thinker name="Robin Dunbar" work="Grooming, Gossip, and the Evolution of Language, 1996">
                  <p>
                    Dunbar arrived at 150 through a study of primate neocortex size: the upper limit of
                    stable social relationships where you know who you&apos;re dealing with, have a model of
                    their intentions, and can track your history with them. This number appears with
                    remarkable consistency across human social structures: hunter-gatherer bands,
                    Neolithic villages, military units, the average size of functional church
                    congregations. Karmyq&apos;s 150-member limit is built on this.
                  </p>
                </Thinker>

                <Thinker name="Joseph Henrich" work="The Secret of Our Success, 2015">
                  <p>
                    Henrich&apos;s central argument: the most important thing about humans is not our
                    individual intelligence — it is our capacity for cumulative culture. Cooperation is
                    not innate and automatic. It is culturally transmitted. Communities that practice
                    cooperation develop the norms, institutions, and habits of mind that make further
                    cooperation possible. Communities that stop practicing it lose those things —
                    because the cultural transmission breaks.
                  </p>
                </Thinker>

                <Thinker name="Marcel Mauss" work="The Gift, 1925">
                  <p>
                    Mauss&apos;s central observation: in societies organized around gift exchange, giving is
                    never simply altruistic and receiving is never simply passive. Every gift creates
                    obligation. This web of obligation and reciprocation is, Mauss argued, the foundation
                    of society itself. What gift economies do that markets cannot: they create bonds. A
                    market transaction is completed when payment is made; the relationship ends there. A
                    gift transaction creates an ongoing relationship — a web of mutual obligation that
                    connects people across time.
                  </p>
                </Thinker>

                <Thinker name="Jonathan Haidt" work="The Righteous Mind, 2012">
                  <p>
                    Haidt&apos;s research reveals that humans are primarily social creatures who use reason
                    to navigate social life. The sense of being part of something — of shared purpose and
                    shared norms — is not a luxury add-on to human social life. It is a foundational
                    need. Communities that provide genuine belonging generate loyalty, cooperation, and
                    the willingness to sacrifice for others that purely transactional structures cannot
                    produce.
                  </p>
                </Thinker>

                <Thinker name="Robert Putnam" work="Bowling Alone, 2000">
                  <p>
                    Putnam documented the collapse of social capital across the second half of the
                    twentieth century: membership in civic organizations, trust in neighbors,
                    participation in informal social activities — all declining, steadily, for decades.
                    He distinguished between bonding capital (connecting similar people within groups)
                    and bridging capital (connecting different groups to each other). Karmyq&apos;s
                    architecture reflects this: within communities, depth of relationship; across
                    communities, the trust carry mechanism creates bridging capital.
                  </p>
                </Thinker>

                <Thinker name="Brian Arthur / Santa Fe Institute" work="Complexity Economics">
                  <p>
                    Arthur&apos;s complexity economics frames economies not as machines seeking equilibrium
                    but as living systems in constant evolution — diverse, adaptive, and impossible to
                    fully optimize from above. The insight validates what the platform is trying to do:
                    not design the one correct cooperation model, but create conditions in which many
                    models can emerge, compete, and evolve. Diversity and adaptation, not efficiency
                    and equilibrium, drive long-term resilience.
                  </p>
                </Thinker>

                <Thinker name="Trebor Scholz" work="Platform Cooperativism, 2016">
                  <p>
                    Scholz made the case for technology platforms owned and governed by the people who
                    use them, not by investors seeking extraction. Karmyq is not technically a
                    cooperative, but it shares the foundational commitment: the platform serves its
                    communities, not the other way around. No venture capital mandate. No growth at any
                    cost. The value created by communities stays with communities.
                  </p>
                </Thinker>

                <Thinker name="Rutger Bregman" work="Humankind, 2020">
                  <p>
                    Bregman makes a case from history and psychology that the default human orientation
                    toward strangers is not hostility or indifference but curiosity and goodwill — that
                    the vision of human nature as fundamentally selfish is not a scientific finding but
                    a cultural assumption, and one the evidence consistently contradicts. His argument
                    matters for Karmyq because the platform&apos;s viability depends on it being at least
                    partially true.
                  </p>
                </Thinker>

                <Thinker name="David Graeber" work="Debt: The First 5,000 Years, 2011">
                  <p>
                    Graeber argues that money, in its current form, is not a neutral tool for exchange
                    but a system of debt that has colonized human relationships and displaced the gift
                    economies that once organized social life. His work, alongside Mauss, provides the
                    intellectual grounding for Karmyq&apos;s decision to keep money out of its core
                    mechanics — not because money is evil, but because the platform is trying to rebuild
                    the kind of relationship infrastructure that monetary transaction tends to dissolve.
                  </p>
                </Thinker>

                <p className="text-sm text-karmyq-brown-500 italic mt-8 pt-6 border-t border-karmyq-brown-200">
                  These thinkers don&apos;t agree with each other on everything. We hold these ideas as
                  working hypotheses. If you know something we don&apos;t — a study, a tradition, a community
                  practice that complicates this picture — we want to hear it.
                </p>
              </div>
            </Accordion>
          </AnimateOnScroll>

        </div>
      </div>
    </section>
  );
}
