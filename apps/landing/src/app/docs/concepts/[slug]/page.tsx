import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import MarkdownContent from '@/components/docs/MarkdownContent';
import conceptsData from '@/data/docs/concepts.json';

interface AdrDoc {
  slug: string;
  number: string;
  title: string;
  status: string;
  description: string;
  content: string;
  filename: string;
}

interface ConceptDoc {
  slug: string;
  title: string;
  description: string;
  content: string;
}

type DocPage = AdrDoc | ConceptDoc;

function isAdr(doc: DocPage): doc is AdrDoc {
  return 'number' in doc && 'status' in doc;
}

const DOCS_DIR = path.join(process.cwd(), 'src', 'data', 'docs', 'concepts');

function getDoc(slug: string): DocPage | null {
  try {
    const filePath = path.join(DOCS_DIR, `${slug}.json`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  // ADR slugs from concepts.json index
  const adrSlugs = conceptsData.concepts.map((c) => ({ slug: c.slug }));

  // Non-ADR concept page slugs from the concepts/ directory
  const conceptSlugs = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('adr-'))
    .map((f) => ({ slug: f.replace('.json', '') }));

  return [...adrSlugs, ...conceptSlugs];
}

const statusColors: Record<string, string> = {
  accepted: 'bg-green-100 text-green-700',
  implemented: 'bg-blue-100 text-blue-700',
  proposed: 'bg-yellow-100 text-yellow-700',
  superseded: 'bg-gray-100 text-gray-500',
};

export default async function ConceptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
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
        Back
      </Link>

      {isAdr(doc) && (
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-mono text-karmyq-green-600 bg-karmyq-green-50 px-2 py-0.5 rounded">
            ADR-{doc.number}
          </span>
          <span className={`text-sm px-2 py-0.5 rounded-full ${statusColors[doc.status] || 'bg-gray-100 text-gray-600'}`}>
            {doc.status}
          </span>
        </div>
      )}

      <h1 className="heading-2 mb-6">{doc.title}</h1>

      <MarkdownContent content={doc.content} />
    </div>
  );
}
