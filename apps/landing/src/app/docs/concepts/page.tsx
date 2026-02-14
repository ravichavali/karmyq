import Link from 'next/link';
import conceptsData from '@/data/docs/concepts.json';

const statusColors: Record<string, string> = {
  accepted: 'bg-green-100 text-green-700',
  implemented: 'bg-blue-100 text-blue-700',
  proposed: 'bg-yellow-100 text-yellow-700',
  superseded: 'bg-gray-100 text-gray-500',
  deprecated: 'bg-red-100 text-red-600',
};

export default function ConceptsPage() {
  const { concepts } = conceptsData;

  const grouped = {
    accepted: concepts.filter((c) => c.status === 'accepted'),
    implemented: concepts.filter((c) => c.status === 'implemented'),
    proposed: concepts.filter((c) => c.status === 'proposed'),
    other: concepts.filter(
      (c) => !['accepted', 'implemented', 'proposed'].includes(c.status)
    ),
  };

  return (
    <div>
      <h1 className="heading-2 mb-2">Concepts & Decisions</h1>
      <p className="body-large mb-8">
        Architecture Decision Records (ADRs) document the key design choices behind Karmyq.
      </p>

      {/* Status summary */}
      <div className="flex flex-wrap gap-3 mb-8">
        {Object.entries(grouped).map(
          ([status, items]) =>
            items.length > 0 && (
              <span
                key={status}
                className={`text-sm px-3 py-1 rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}
              >
                {items.length} {status}
              </span>
            )
        )}
      </div>

      {/* All ADRs */}
      <div className="space-y-3">
        {concepts.map((concept) => (
          <Link
            key={concept.slug}
            href={`/docs/concepts/${concept.slug}`}
            className="block card !p-4 group"
          >
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-karmyq-green-600 bg-karmyq-green-50 px-2 py-0.5 rounded shrink-0 mt-0.5">
                ADR-{concept.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-karmyq-brown-800 group-hover:text-karmyq-green-600 transition-colors">
                  {concept.title}
                </p>
                {concept.description && (
                  <p className="text-xs text-karmyq-brown-500 mt-1 line-clamp-2">
                    {concept.description}
                  </p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  statusColors[concept.status] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {concept.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
