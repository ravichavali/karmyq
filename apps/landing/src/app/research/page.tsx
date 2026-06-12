import type { Metadata } from 'next';
import PageShell, { EssayColumn } from '../../components/landing/PageShell';
import { ThinkerCard, SecondaryCta } from '../../components/landing/primitives';
import { HEADING_1_CLASS, HEADING_2_CLASS } from '../../components/landing/styles';
import { buildRouteMetadata } from '../../lib/landingRoutes';
import { researchContent } from '../../lib/landingContent';

export const metadata: Metadata = buildRouteMetadata('research');

export default function ResearchPage() {
  return (
    <PageShell>
      <EssayColumn>
        <h1 className={`${HEADING_1_CLASS} mb-6`}>{researchContent.heading}</h1>
        <p className="text-lg leading-relaxed text-karmyq-brown-700 mb-4">{researchContent.intro}</p>

        {researchContent.thinkers.map((thinker) => (
          <ThinkerCard key={thinker.name} thinker={thinker} />
        ))}

        <h2 className={`${HEADING_2_CLASS} mt-12 mb-4`}>{researchContent.closingHeading}</h2>
        <p className="text-lg leading-relaxed text-karmyq-brown-700 mb-8">
          {researchContent.closingBody}
        </p>

        <SecondaryCta href={researchContent.closingCta.href}>
          {researchContent.closingCta.label}
        </SecondaryCta>
      </EssayColumn>
    </PageShell>
  );
}
