import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import MarkdownContent from '@/components/docs/MarkdownContent';
import conceptsData from '@/data/docs/concepts.json';

interface ConceptDoc {
  slug: string;
  number: string;
  title: string;
  status: string;
  description: string;
  content: string;
  filename: string;
}

const DOCS_DIR = path.join(process.cwd(), 'src', 'data', 'docs', 'concepts');

function getConceptDoc(slug: string): ConceptDoc | null {
  try {
    const filePath = path.join(DOCS_DIR, `${slug}.json`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return conceptsData.concepts.map((c) => ({ slug: c.slug }));
}

const statusColors: Record<string, string> = {
  accepted: 'bg-green-100 text-green-700',
  implemented: 'bg-blue-100 text-blue-700',
  proposed: 'bg-yellow-100 text-yellow-700',
  superseded: 'bg-gray-100 text-gray-500',
};

export default function ConceptPage({ params }: { params: { slug: string } }) {
  const doc = getConceptDoc(params.slug);
  if (!doc) notFound();

  return (
    <div>
      <Link
        href="/docs/concepts"
        className="text-sm text-karmyq-brown-500 hover:text-karmyq-green-600 transition-colors mb-4 inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Concepts
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-mono text-karmyq-green-600 bg-karmyq-green-50 px-2 py-0.5 rounded">
          ADR-{doc.number}
        </span>
        <span className={`text-sm px-2 py-0.5 rounded-full ${statusColors[doc.status] || 'bg-gray-100 text-gray-600'}`}>
          {doc.status}
        </span>
      </div>

      <h1 className="heading-2 mb-6">{doc.title}</h1>

      <MarkdownContent content={doc.content} />
    </div>
  );
}
