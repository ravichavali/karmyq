import type { Metadata } from 'next';
import PageShell, { EssayColumn } from '../../components/landing/PageShell';
import { PrincipleCard, SecondaryCta } from '../../components/landing/primitives';
import { HEADING_1_CLASS } from '../../components/landing/styles';
import { buildRouteMetadata } from '../../lib/landingRoutes';
import { principlesContent } from '../../lib/landingContent';

export const metadata: Metadata = buildRouteMetadata('principles');

export default function PrinciplesPage() {
  return (
    <PageShell>
      <EssayColumn>
        <h1 className={`${HEADING_1_CLASS} mb-6`}>{principlesContent.heading}</h1>
        <p className="text-lg leading-relaxed text-karmyq-brown-700 mb-4">{principlesContent.intro}</p>

        {principlesContent.principles.map((principle) => (
          <PrincipleCard key={principle.name} principle={principle} />
        ))}

        <div className="mt-12">
          <SecondaryCta href={principlesContent.closingCta.href}>
            {principlesContent.closingCta.label}
          </SecondaryCta>
        </div>
      </EssayColumn>
    </PageShell>
  );
}
