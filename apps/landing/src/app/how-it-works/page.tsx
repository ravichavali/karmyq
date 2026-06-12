import type { Metadata } from 'next';
import PageShell, { EssayColumn } from '../../components/landing/PageShell';
import { Blocks } from '../../components/landing/Blocks';
import { DesignEssayDetails, LayerLabel, SecondaryCta } from '../../components/landing/primitives';
import { HEADING_1_CLASS } from '../../components/landing/styles';
import { buildRouteMetadata } from '../../lib/landingRoutes';
import { howItWorksContent, type HowSegment } from '../../lib/landingContent';

export const metadata: Metadata = buildRouteMetadata('how-it-works');

function SegmentView({ segment }: { segment: HowSegment }) {
  switch (segment.type) {
    case 'prose':
      return <Blocks blocks={segment.blocks} />;
    case 'feature':
      return (
        <div className="my-8 p-7 bg-karmyq-green-50/80 border-l-4 border-karmyq-green-500 rounded-r-xl">
          <div className="font-serif text-xl font-semibold text-karmyq-green-700 mb-2">
            {segment.title}
          </div>
          <p className="text-base leading-relaxed text-karmyq-brown-700">{segment.body}</p>
        </div>
      );
    case 'essay':
      return <DesignEssayDetails essay={segment.essay} />;
    case 'timeline':
      return (
        <div className="mt-6">
          <LayerLabel text={segment.label} />
          <Blocks blocks={segment.lead} />
          <div className="mt-6 p-6 bg-white/60 border border-karmyq-brown-200 rounded-xl divide-y divide-karmyq-brown-100">
            {segment.items.map((item, i) => (
              <div
                key={item.act}
                className="flex items-start gap-4 py-3"
                style={{ opacity: Math.max(0.18, 1 - i * 0.13) }}
              >
                <span className="mt-2 w-2.5 h-2.5 rounded-full border-2 border-karmyq-green-500 flex-shrink-0" />
                <div>
                  <div className="text-xs tracking-wide uppercase text-karmyq-brown-500">
                    {item.when}
                  </div>
                  <div className="text-base text-karmyq-brown-700">{item.act}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    default: {
      const _never: never = segment;
      void _never;
      return null;
    }
  }
}

export default function HowItWorksPage() {
  return (
    <PageShell>
      <EssayColumn>
        <h1 className={`${HEADING_1_CLASS} mb-2`}>{howItWorksContent.heading}</h1>

        {howItWorksContent.segments.map((segment, i) => (
          <SegmentView key={i} segment={segment} />
        ))}

        <div className="mt-12">
          <SecondaryCta href={howItWorksContent.closingCta.href}>
            {howItWorksContent.closingCta.label}
          </SecondaryCta>
        </div>
      </EssayColumn>
    </PageShell>
  );
}
