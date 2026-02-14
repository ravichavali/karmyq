import Link from 'next/link';
import apiData from '@/data/docs/api.json';

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  PATCH: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function ApiReferencePage() {
  const totalEndpoints = apiData.groups.reduce((sum, g) => sum + g.endpoints.length, 0);

  return (
    <div>
      <h1 className="heading-2 mb-2">API Reference</h1>
      <p className="body-large mb-8">
        {totalEndpoints} endpoints across {apiData.groups.length} services.
      </p>

      <div className="space-y-8">
        {apiData.groups.map((group) => (
          <div key={group.service}>
            <div className="flex items-center gap-3 mb-4">
              <Link
                href={`/docs/services/${group.service}`}
                className="text-xl font-serif font-semibold text-karmyq-brown-800 hover:text-karmyq-green-600 transition-colors"
              >
                {group.service.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Link>
              {group.port && (
                <span className="text-xs font-mono text-karmyq-brown-400">:{group.port}</span>
              )}
              <span className="text-xs text-karmyq-brown-400">
                {group.endpoints.length} endpoint{group.endpoints.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {group.endpoints.map((ep, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-karmyq-brown-100"
                >
                  <span
                    className={`text-xs font-mono font-bold px-2 py-1 rounded shrink-0 ${
                      methodColors[ep.method] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <div className="min-w-0">
                    <code className="text-sm font-mono text-karmyq-brown-800 break-all">
                      {ep.path}
                    </code>
                    {ep.description && (
                      <p className="text-xs text-karmyq-brown-500 mt-1">{ep.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
