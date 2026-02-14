import Link from 'next/link';
import servicesData from '@/data/docs/services.json';
import conceptsData from '@/data/docs/concepts.json';
import apiData from '@/data/docs/api.json';

export default function DocsOverview() {
  const { services } = servicesData;
  const { concepts } = conceptsData;
  const acceptedConcepts = concepts.filter(
    (c) => c.status === 'accepted' || c.status === 'implemented'
  );
  const totalEndpoints = apiData.groups.reduce((sum, g) => sum + g.endpoints.length, 0);
  const totalEvents = services.reduce(
    (sum, s) => sum + s.events.publishes.length + s.events.subscribes.length,
    0
  );

  return (
    <div>
      <h1 className="heading-2 mb-4">Documentation</h1>
      <p className="body-large mb-10">
        Karmyq is a mutual aid platform built on microservices. Explore the services,
        APIs, and architectural decisions that power community cooperation.
      </p>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: 'Services', value: services.length },
          { label: 'API Endpoints', value: totalEndpoints },
          { label: 'Events', value: totalEvents },
          { label: 'ADRs', value: concepts.length },
        ].map((stat) => (
          <div key={stat.label} className="card text-center !p-5">
            <p className="text-3xl font-bold text-karmyq-green-600">{stat.value}</p>
            <p className="text-sm text-karmyq-brown-600 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Section cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <Link href="/docs/services" className="card group !p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-lg bg-karmyq-green-100 flex items-center justify-center text-karmyq-green-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </span>
            <h2 className="text-xl font-serif font-semibold group-hover:text-karmyq-green-600 transition-colors">
              Services
            </h2>
          </div>
          <p className="text-karmyq-brown-600 text-sm">
            {services.length} microservices powering authentication, requests, reputation, and more.
          </p>
        </Link>

        <Link href="/docs/api" className="card group !p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-lg bg-karmyq-orange-100 flex items-center justify-center text-karmyq-orange-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </span>
            <h2 className="text-xl font-serif font-semibold group-hover:text-karmyq-orange-600 transition-colors">
              API Reference
            </h2>
          </div>
          <p className="text-karmyq-brown-600 text-sm">
            All REST endpoints grouped by service with methods, paths, and descriptions.
          </p>
        </Link>

        <Link href="/docs/architecture" className="card group !p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-lg bg-karmyq-teal-100 flex items-center justify-center text-karmyq-teal-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
            <h2 className="text-xl font-serif font-semibold group-hover:text-karmyq-teal-600 transition-colors">
              Architecture
            </h2>
          </div>
          <p className="text-karmyq-brown-600 text-sm">
            System overview, dependency graph, and infrastructure details.
          </p>
        </Link>

        <Link href="/docs/concepts" className="card group !p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-lg bg-karmyq-brown-100 flex items-center justify-center text-karmyq-brown-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </span>
            <h2 className="text-xl font-serif font-semibold group-hover:text-karmyq-brown-600 transition-colors">
              Concepts & Decisions
            </h2>
          </div>
          <p className="text-karmyq-brown-600 text-sm">
            {acceptedConcepts.length} architecture decision records documenting design choices.
          </p>
        </Link>
      </div>

      {/* Recent concepts */}
      <h2 className="heading-3 mb-4">Key Decisions</h2>
      <div className="space-y-3">
        {acceptedConcepts.slice(0, 8).map((concept) => (
          <Link
            key={concept.slug}
            href={`/docs/concepts/${concept.slug}`}
            className="block card !p-4 group"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-karmyq-green-600 bg-karmyq-green-50 px-2 py-0.5 rounded">
                ADR-{concept.number}
              </span>
              <span className="text-sm font-medium text-karmyq-brown-800 group-hover:text-karmyq-green-600 transition-colors">
                {concept.title}
              </span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                concept.status === 'accepted'
                  ? 'bg-green-100 text-green-700'
                  : concept.status === 'implemented'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {concept.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
