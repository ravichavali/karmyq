import type { Metadata } from 'next';
import PageShell, { EssayColumn } from '../../components/landing/PageShell';
import { Blocks } from '../../components/landing/Blocks';
import { LaneCard } from '../../components/landing/primitives';
import { HEADING_1_CLASS, HEADING_2_CLASS, QUOTE_CLASS } from '../../components/landing/styles';
import JoinForm from '../../components/landing/JoinForm';
import { buildRouteMetadata } from '../../lib/landingRoutes';
import { joinContent } from '../../lib/landingContent';

export const metadata: Metadata = buildRouteMetadata('join');

export default function JoinPage() {
  return (
    <PageShell>
      <EssayColumn>
        <h1 className={`${HEADING_1_CLASS} mb-6`}>{joinContent.heading}</h1>

        <Blocks blocks={joinContent.intro} />

        <div className={QUOTE_CLASS}>
          {joinContent.tagline.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        <h2 className={`${HEADING_2_CLASS} mt-12 mb-4`}>{joinContent.howToJoinHeading}</h2>
        <p className="text-lg leading-relaxed text-karmyq-brown-700 mb-8">
          {joinContent.howToJoinBody}
        </p>

        <JoinForm />

        <h2 className={`${HEADING_2_CLASS} mt-16 mb-4`}>{joinContent.lanesHeading}</h2>
        {joinContent.lanes.map((lane) => (
          <LaneCard key={lane.audience} lane={lane} />
        ))}

        <p className="text-lg leading-relaxed text-karmyq-brown-700 mt-10">
          {joinContent.support.before}
          <a
            href={joinContent.support.linkHref}
            className="text-karmyq-green-700 underline hover:text-karmyq-brown-900"
          >
            {joinContent.support.linkLabel}
          </a>
          {joinContent.support.after}
        </p>
      </EssayColumn>
    </PageShell>
  );
}
