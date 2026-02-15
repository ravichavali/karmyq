import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import MarkdownContent from '@/components/docs/MarkdownContent';
import servicesData from '@/data/docs/services.json';

interface ServiceDoc {
  name: string;
  title: string;
  description: string;
  content: string;
  endpoints: Array<{ method: string; path: string; description: string }>;
}

const DOCS_DIR = path.join(process.cwd(), 'src', 'data', 'docs', 'services');

function getServiceDoc(name: string): ServiceDoc | null {
  try {
    const filePath = path.join(DOCS_DIR, `${name}.json`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return servicesData.services.map((s) => ({ name: s.name }));
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  PATCH: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default async function ServiceDocPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const service = servicesData.services.find((s) => s.name === name);
  if (!service) notFound();

  const doc = getServiceDoc(name);

  return (
    <div>
      <Link
        href="/docs/services"
        className="text-sm text-karmyq-brown-500 hover:text-karmyq-green-600 transition-colors mb-4 inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Services
      </Link>

      <h1 className="heading-2 mb-2">
        {service.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
      </h1>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <span className="text-sm font-mono text-karmyq-brown-500 bg-karmyq-brown-50 px-3 py-1 rounded">
          Port {service.port}
        </span>
        <span className="text-sm px-3 py-1 rounded bg-karmyq-green-50 text-karmyq-green-700">
          {service.status}
        </span>
        <span className="text-sm px-3 py-1 rounded bg-karmyq-brown-50 text-karmyq-brown-600">
          {service.criticality}
        </span>
      </div>

      {/* Quick info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card !p-4">
          <p className="text-2xl font-bold text-karmyq-green-600">{service.apis.length}</p>
          <p className="text-xs text-karmyq-brown-500">API Endpoints</p>
        </div>
        <div className="card !p-4">
          <p className="text-2xl font-bold text-karmyq-green-600">{service.dependencies.length}</p>
          <p className="text-xs text-karmyq-brown-500">Service Deps</p>
        </div>
        <div className="card !p-4">
          <p className="text-2xl font-bold text-karmyq-green-600">{service.infrastructure.length}</p>
          <p className="text-xs text-karmyq-brown-500">Infrastructure</p>
        </div>
        <div className="card !p-4">
          <p className="text-2xl font-bold text-karmyq-green-600">{service.databaseSchemas.length}</p>
          <p className="text-xs text-karmyq-brown-500">DB Schemas</p>
        </div>
      </div>

      {/* API endpoints from registry */}
      {doc && doc.endpoints.length > 0 && (
        <div className="mb-8">
          <h2 className="heading-3 mb-4">API Endpoints</h2>
          <div className="space-y-2">
            {doc.endpoints.map((ep, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-karmyq-brown-100">
                <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${methodColors[ep.method] || 'bg-gray-100 text-gray-700'}`}>
                  {ep.method}
                </span>
                <div>
                  <code className="text-sm font-mono text-karmyq-brown-800">{ep.path}</code>
                  {ep.description && (
                    <p className="text-xs text-karmyq-brown-500 mt-1">{ep.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Infrastructure & dependencies */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {service.infrastructure.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-karmyq-brown-500 mb-2">Infrastructure</h3>
            <div className="flex flex-wrap gap-2">
              {service.infrastructure.map((i) => (
                <span key={i} className="text-sm px-3 py-1 rounded-full bg-karmyq-teal-50 text-karmyq-teal-700">{i}</span>
              ))}
            </div>
          </div>
        )}
        {service.dependencies.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-karmyq-brown-500 mb-2">Service Dependencies</h3>
            <div className="flex flex-wrap gap-2">
              {service.dependencies.map((d) => (
                <Link
                  key={d}
                  href={`/docs/services/${d}`}
                  className="text-sm px-3 py-1 rounded-full bg-karmyq-green-50 text-karmyq-green-700 hover:bg-karmyq-green-100 transition-colors"
                >
                  {d}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Events */}
      {(service.events.publishes.length > 0 || service.events.subscribes.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {service.events.publishes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-karmyq-brown-500 mb-2">Publishes Events</h3>
              <div className="flex flex-wrap gap-2">
                {service.events.publishes.map((e) => (
                  <span key={e} className="text-xs font-mono px-2 py-1 rounded bg-karmyq-orange-50 text-karmyq-orange-700">{e}</span>
                ))}
              </div>
            </div>
          )}
          {service.events.subscribes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-karmyq-brown-500 mb-2">Subscribes To</h3>
              <div className="flex flex-wrap gap-2">
                {service.events.subscribes.map((e) => (
                  <span key={e} className="text-xs font-mono px-2 py-1 rounded bg-karmyq-brown-50 text-karmyq-brown-600">{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full CONTEXT.md content */}
      {doc && (
        <div className="mt-8 border-t border-karmyq-brown-100 pt-8">
          <h2 className="heading-3 mb-4">Full Documentation</h2>
          <MarkdownContent content={doc.content} />
        </div>
      )}
    </div>
  );
}
