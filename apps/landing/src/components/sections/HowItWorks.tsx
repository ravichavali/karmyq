'use client';

import AnimateOnScroll from '../AnimateOnScroll';

export default function HowItWorks() {
  return (
    <section id="product" className="section-padding bg-white">
      <div className="container-narrow">

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
              optimise, no anxiety about your profile falling behind someone else&apos;s. Karma moves like
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
          <div className="space-y-5 body-large">
            <p>
              Each community is sovereign — up to 150 members, the threshold at which genuine relationship
              becomes possible and beyond which it frays. It sets its own membership rules, configures how
              trust and karma flow, decides which kinds of help to enable. No platform override. The platform
              holds the infrastructure; the community holds the power.
            </p>
          </div>
        </AnimateOnScroll>

      </div>
    </section>
  );
}
