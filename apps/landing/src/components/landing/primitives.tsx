import { ReactNode } from 'react';
import type { DesignEssay, Principle, Thinker, Lane } from '../../lib/landingContent';
import { Blocks } from './Blocks';
import { PRIMARY_CTA_CLASS, SECONDARY_CTA_CLASS } from './styles';

/** Inline secondary CTA — quiet underlined link with a trailing arrow. */
export function SecondaryCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={SECONDARY_CTA_CLASS}>
      {children} <span aria-hidden="true">→</span>
    </a>
  );
}

/** Solid pill CTA — the primary founding-circle action. */
export function PrimaryCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={PRIMARY_CTA_CLASS}>
      {children}
    </a>
  );
}

/** Section divider label with a trailing rule, e.g. "The thinking". */
export function LayerLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-4 my-14">
      <span className="text-xs font-medium tracking-[0.25em] uppercase text-karmyq-brown-500 whitespace-nowrap">
        {text}
      </span>
      <span className="flex-1 h-px bg-karmyq-brown-200" aria-hidden="true" />
    </div>
  );
}

/**
 * Collapsible design essay (native <details> so it works without JS in the
 * static export). Eyebrow + title + subtitle in the summary; essay body inside.
 */
export function DesignEssayDetails({ essay }: { essay: DesignEssay }) {
  return (
    <details className="group my-10 border border-karmyq-brown-200 rounded-xl bg-karmyq-cream open:border-karmyq-green-300 transition-colors">
      <summary className="flex items-start justify-between gap-4 cursor-pointer list-none px-6 py-5 hover:bg-karmyq-green-50/60 rounded-xl">
        <span>
          <span className="block text-[0.65rem] font-medium tracking-[0.25em] uppercase text-karmyq-green-700">
            {essay.eyebrow}
          </span>
          <span className="block font-serif text-lg font-medium text-karmyq-brown-900 mt-1">
            {essay.title}
          </span>
          <span className="block text-xs text-karmyq-brown-500 mt-0.5">{essay.subtitle}</span>
        </span>
        <span
          className="text-karmyq-green-700 transition-transform group-open:rotate-180 mt-1"
          aria-hidden="true"
        >
          ↓
        </span>
      </summary>
      <div className="px-6 pb-8 pt-1 border-t border-karmyq-brown-100">
        <Blocks blocks={essay.body} />
      </div>
    </details>
  );
}

/** One of the six platform principles. */
export function PrincipleCard({ principle }: { principle: Principle }) {
  return (
    <div className="my-8 p-7 border border-karmyq-brown-200 rounded-xl bg-white/60">
      <h2 className="font-serif text-2xl font-semibold text-karmyq-green-700 mb-3">
        {principle.name}
      </h2>
      <p className="text-base leading-relaxed text-karmyq-brown-700">{principle.body}</p>
    </div>
  );
}

/** One researcher in the research foundation. */
export function ThinkerCard({ thinker }: { thinker: Thinker }) {
  return (
    <div className="my-8 pl-6 pr-6 py-6 border-l-4 border-karmyq-green-300 bg-white/60 rounded-r-xl">
      <div className="font-serif text-xl font-semibold text-karmyq-green-700">{thinker.name}</div>
      <div className="text-xs tracking-wide uppercase text-karmyq-brown-500 mt-1 mb-3">
        {thinker.work}
      </div>
      <p className="text-base leading-relaxed text-karmyq-brown-700">{thinker.body}</p>
    </div>
  );
}

/** One specialist/builder/organizer lane on the join page. */
export function LaneCard({ lane }: { lane: Lane }) {
  return (
    <div className="my-6 p-7 border border-karmyq-brown-200 rounded-xl bg-karmyq-cream">
      <div className="text-[0.65rem] font-medium tracking-[0.2em] uppercase text-karmyq-green-700 mb-2">
        {lane.audience}
      </div>
      <p className="text-base leading-relaxed text-karmyq-brown-700 mb-4">{lane.body}</p>
      <SecondaryCta href={lane.cta.href}>{lane.cta.label}</SecondaryCta>
    </div>
  );
}
