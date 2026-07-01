import type { Metadata } from 'next';
import PageShell, { EssayColumn } from '../components/landing/PageShell';
import { Blocks } from '../components/landing/Blocks';
import { PrimaryCta, SecondaryCta, LayerLabel } from '../components/landing/primitives';
import { COLUMN_CLASS } from '../components/landing/styles';
import NetworkVisualization from '../components/NetworkVisualization';
import {
  buildRouteMetadata,
  EXPLORE_LINK,
  JOIN_PLATFORM_LINK,
  FOUNDING_CIRCLE_LINK,
} from '../lib/landingRoutes';
import { homeContent } from '../lib/landingContent';

export const metadata: Metadata = buildRouteMetadata('home');

export default function Home() {
  const { founderNote, standTogether } = homeContent;

  return (
    <PageShell>
      {/* Hero — story opening over the network field */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-karmyq-green-50/80 via-karmyq-warmWhite to-karmyq-teal-50/40">
          <NetworkVisualization />
        </div>
        <div className={`relative z-10 ${COLUMN_CLASS} pt-28 md:pt-36 pb-12`}>
          <Blocks blocks={homeContent.hero} />
          <div className="flex flex-col items-start sm:flex-row sm:items-center gap-5 mt-8">
            <PrimaryCta href={homeContent.heroCtas[0].href}>
              {homeContent.heroCtas[0].label}
            </PrimaryCta>
            <SecondaryCta href={homeContent.heroCtas[1].href}>
              {homeContent.heroCtas[1].label}
            </SecondaryCta>
          </div>
        </div>
      </section>

      <EssayColumn className="pt-0">
        {/* The thinking */}
        <div id="thinking" className="scroll-mt-24">
          <LayerLabel text={homeContent.thinkingLabel} />
        </div>
        <Blocks blocks={homeContent.thinking} />

        <div className="flex flex-col items-start sm:flex-row sm:items-center gap-6 mt-8">
          {homeContent.thinkingCtas.map((cta) => (
            <SecondaryCta key={cta.href} href={cta.href}>
              {cta.label}
            </SecondaryCta>
          ))}
        </div>

        {/* Why we're building this — founder note */}
        <LayerLabel text={homeContent.whyLabel} />
        <div className="my-8 p-8 border border-karmyq-brown-200 rounded-xl bg-white/50">
          <div className="text-[0.65rem] font-medium tracking-[0.2em] uppercase text-karmyq-green-700">
            {founderNote.eyebrow}
          </div>
          <div className="text-xs tracking-wide uppercase text-karmyq-brown-500 mb-4">
            {founderNote.location}
          </div>
          {founderNote.paragraphs.map((para, i) => (
            <p
              key={i}
              className="font-serif text-lg italic leading-relaxed text-karmyq-brown-800 mb-4"
            >
              {para}
            </p>
          ))}
          <span className="block text-sm tracking-wide text-karmyq-brown-500 mt-2">
            {founderNote.attribution}
          </span>
        </div>

        {/* The thesis the story has earned — isolated emphasis, not a paragraph */}
        <p className="font-serif text-xl md:text-2xl italic text-karmyq-green-700 leading-snug text-center my-12">
          {homeContent.closingLine}
        </p>

        {/* Stand together */}
        <div className="my-14 py-10 px-6 border-y-2 border-karmyq-green-500 text-center space-y-3">
          {standTogether.map((line, i) => (
            <p
              key={i}
              className={
                i === standTogether.length - 1
                  ? 'font-serif text-2xl md:text-3xl font-semibold text-karmyq-green-700 leading-snug'
                  : 'font-serif text-2xl md:text-3xl text-karmyq-brown-900 leading-snug'
              }
            >
              {line}
            </p>
          ))}
        </div>

        {/* Three distinct entry paths (Sprint 116): Explore + Join the Platform are the
            primary actions; the Founding Circle is the quieter invitation beneath them. */}
        <div className="flex flex-col items-center gap-4 mt-10">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <PrimaryCta href={EXPLORE_LINK.href}>{EXPLORE_LINK.label}</PrimaryCta>
            <PrimaryCta href={JOIN_PLATFORM_LINK.href}>{JOIN_PLATFORM_LINK.label}</PrimaryCta>
          </div>
          <SecondaryCta href={FOUNDING_CIRCLE_LINK.href}>{FOUNDING_CIRCLE_LINK.label}</SecondaryCta>
        </div>
      </EssayColumn>
    </PageShell>
  );
}
