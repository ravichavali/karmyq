import { Fragment, ReactNode } from 'react';
import type { Block, Inline } from '../../lib/landingContent';
import { HEADING_1_CLASS, HEADING_2_CLASS, QUOTE_CLASS } from './styles';

/** Render inline runs (plain / italic emphasis / bold) inside a paragraph. */
export function renderInline(runs: Inline[]): ReactNode {
  return runs.map((run, i) => {
    if (typeof run === 'string') return <Fragment key={i}>{run}</Fragment>;
    if ('em' in run)
      return (
        <em key={i} className="italic text-karmyq-brown-900">
          {run.em}
        </em>
      );
    return (
      <strong key={i} className="font-medium text-karmyq-brown-900">
        {run.strong}
      </strong>
    );
  });
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'h1':
      return <h1 className={`${HEADING_1_CLASS} mb-8`}>{block.text}</h1>;
    case 'h2':
      return <h2 className={`${HEADING_2_CLASS} mt-12 mb-4`}>{block.text}</h2>;
    case 'lead':
      return (
        <p className="font-serif text-xl md:text-2xl italic font-light text-karmyq-green-700 leading-relaxed mb-8">
          {block.text}
        </p>
      );
    case 'p':
      return (
        <p className="text-lg leading-relaxed text-karmyq-brown-700 mb-5">
          {renderInline(block.runs)}
        </p>
      );
    case 'star':
      return (
        <p className="font-serif text-xl md:text-2xl italic text-karmyq-green-700 leading-snug my-10">
          {block.text}
        </p>
      );
    case 'quote':
      return <p className={QUOTE_CLASS}>{block.text}</p>;
    case 'context':
      return (
        <div className="border-l-4 border-karmyq-green-400 bg-karmyq-green-50/80 pl-6 py-4 pr-6 my-8">
          <p className="text-base font-light leading-relaxed text-karmyq-brown-700">{block.text}</p>
        </div>
      );
    default: {
      // Exhaustiveness guard — every Block kind must be handled above.
      const _never: never = block;
      void _never;
      return null;
    }
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </>
  );
}
