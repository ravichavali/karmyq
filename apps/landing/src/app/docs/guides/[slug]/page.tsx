import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import MarkdownContent from '@/components/docs/MarkdownContent';

interface GuideDoc {
  slug: string;
  title: string;
  description: string;
  content: string;
}

const GUIDES_DIR = path.join(process.cwd(), 'src', 'data', 'docs', 'guides');

function getGuideDoc(slug: string): GuideDoc | null {
  try {
    const filePath = path.join(GUIDES_DIR, `${slug}.json`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  const slugs = [
    'getting-started',
    'making-requests',
    'fulfilling-requests',
    'community-admin',
    'understanding-karma',
  ];
  return slugs.map((slug) => ({ slug }));
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getGuideDoc(slug);
  if (!doc) notFound();

  return (
    <div>
      <Link
        href="/docs/guides/getting-started"
        className="text-sm text-karmyq-brown-500 hover:text-karmyq-green-600 transition-colors mb-4 inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        User Guides
      </Link>

      <h1 className="heading-2 mb-2">{doc.title}</h1>
      <p className="text-karmyq-brown-600 mb-6">{doc.description}</p>

      <MarkdownContent content={doc.content} />
    </div>
  );
}
