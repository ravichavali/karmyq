'use client';

import AnimateOnScroll from '../AnimateOnScroll';

export default function HowItWorks() {
  return (
    <section id="product" className="section-padding bg-karmyq-cream">
      <div className="container-narrow">

        {/* What Karmyq actually is */}
        <AnimateOnScroll>
          <p className="text-karmyq-green-600 font-medium text-xs tracking-widest uppercase mb-4">
            How it works
          </p>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <h2 className="heading-2 text-karmyq-brown-900 mb-8">
            What Karmyq actually is.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.2}>
          <p className="body-large mb-16">
            A toolkit. An open-source platform that lets communities design their own cooperation systems —
            not one model handed down, but infrastructure flexible enough to hold mutual aid, skill sharing,
            tool lending, local services, or any combination a community needs. The platform doesn&apos;t decide
            what your community values. It gives your community the means to decide for itself, and to
            change its mind over time.
          </p>
        </AnimateOnScroll>

        {/* Reputation without the performance */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            Reputation without the performance.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-8">
            <p>
              On Karmyq, your worth is not a public score. There are no leaderboards, no star ratings to
              optimize, no anxiety about your profile falling behind someone else&apos;s. Karma moves like
              ambient knowledge in a village: people remember who shows up, but nobody keeps a public
              spreadsheet on their neighbors.
            </p>
          </div>
        </AnimateOnScroll>

        {/* Feature highlight box */}
        <AnimateOnScroll delay={0.15}>
          <div className="border-l-4 border-karmyq-green-400 bg-karmyq-green-50 p-6 mb-12">
            <h3 className="font-serif text-xl font-semibold text-karmyq-green-700 mb-3">
              You are free to help without being perceived.
            </h3>
            <p className="text-karmyq-brown-700 leading-relaxed">
              Every completed interaction generates standing for both people — the person who helped and the
              person who asked. Communities configure how that standing flows. What they can&apos;t configure:
              standing comes from doing, not from who you are when you arrive. Old interactions fade over
              time using a six-month half-life. What remains is a living picture of who someone is in this
              community, right now — not a permanent record of everything they&apos;ve ever done.
            </p>
          </div>
        </AnimateOnScroll>

        {/* How trust is measured */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            How trust is measured.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-12">
            <p>
              Trust scores combine five signals: the volume of recent interactions, the quality of feedback
              received, the depth of relationships with repeat partners, the breadth of connections across
              different people, and milestone recognition as trust accumulates.
            </p>
            <p>
              <strong>Trust paths.</strong>{' '}
              The platform can show you how you&apos;re connected to any other member — through shared exchanges,
              communities, or invitations — up to four degrees of separation. Not as a number. As a map of
              actual human connection.
            </p>
            <p>
              <strong>Cross-community trust.</strong>{' '}
              When you join a new community where no one knows you yet, a portion of the trust you&apos;ve built
              elsewhere travels with you. You don&apos;t start from zero. You start from something.
            </p>
          </div>
        </AnimateOnScroll>

        {/* The service layer */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            The service layer.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-12">
            <p>
              Communities that choose to can enable a professional services layer — off by default, opted
              into deliberately. Providers must meet a minimum trust score before they can offer services.
              Karmyq never processes payment; it coordinates the connection and nothing more. A single
              identity carries both roles: the neighbor who helped you move last month and the electrician
              you hire this month are the same person, with the same trust history.
            </p>
          </div>
        </AnimateOnScroll>

        {/* How communities govern themselves */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            How communities govern themselves.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large mb-12">
            <p>
              Each community is sovereign — up to 150 members, the threshold at which genuine relationship
              becomes possible and beyond which it frays. It sets its own membership rules, configures how
              trust and karma flow, decides which kinds of help to enable. No platform override. The platform
              holds the infrastructure; the community holds the power.
            </p>
            <p>
              When a community is created, it goes through a short initialization process that sets its
              starting trust character — how it weights deep relationships over broad ones, how open it is
              to people beyond its immediate circle, what its default posture is toward other communities.
              These become the community&apos;s starting parameters. Not fixed permanently — the model evolves
              as the community actually behaves. Communities that cross boundaries frequently find their
              model shifting toward openness. Communities that deepen existing relationships find the
              opposite. The system calibrates toward what is actually true, not what was declared at
              founding.
            </p>
            <p>
              Governance in Karmyq is gated by trust. To be nominated for a governance role, a member must
              first earn a minimum trust score within the community — standing built through actual
              interactions, not assumed at entry. Nominations are made by members and ratified by existing
              role-holders. When contested decisions arise, votes are weighted by trust score — the members
              the community has come to rely on most carry more weight in shaping its direction.
            </p>
            <p>
              No role is permanent. The nomination and ratification process runs in both directions. A member
              whose trust has grown can be elevated. A role-holder whose presence has faded can be replaced.
              Governance reflects who the community currently trusts — not who it trusted at founding.
            </p>
            <p>
              Members are not restricted to one community; standing earned in one can, with that
              community&apos;s consent, travel.
            </p>
          </div>
        </AnimateOnScroll>

        {/* How communities grow and change */}
        <AnimateOnScroll>
          <h2 className="heading-2 text-karmyq-brown-900 mb-6">
            How communities grow and change.
          </h2>
        </AnimateOnScroll>
        <AnimateOnScroll delay={0.1}>
          <div className="space-y-5 body-large">
            <p>
              Communities don&apos;t have to stay the same shape forever.
            </p>
            <p>
              When a community approaches its natural size limit, its members can propose a split. The
              platform reads the existing patterns of interaction and suggests who belongs together —
              those who have helped each other most stay together. The proposed division goes to a vote
              weighted by standing: the members the community trusts most have the most say in how it
              divides. If the vote passes, two daughter communities form — each carrying the full trust
              history of its members, and each starting with a special relationship to the other. Sisters
              remember they share a past.
            </p>
            <p>
              When two communities have built enough trust across their boundary to want to become one,
              they can propose a fusion. Both communities vote independently. If both pass, the merged
              community inherits the full karma history of both parents and carries forward the trust
              relationships built in each. What was built in two places becomes the foundation of one.
            </p>
            <p>
              Neither process is automatic. Communities decide when the time is right. The platform
              provides the mechanics; the community provides the judgment.
            </p>
          </div>
        </AnimateOnScroll>

      </div>
    </section>
  );
}
