import Link from 'next/link';
import servicesData from '@/data/docs/services.json';

const criticalityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  important: 'bg-yellow-100 text-yellow-700',
  optional: 'bg-gray-100 text-gray-600',
};

export default function ServicesPage() {
  const { services } = servicesData;

  return (
    <div>
      <h1 className="heading-2 mb-2">Services</h1>
      <p className="body-large mb-8">
        {services.length} microservices compose the Karmyq platform.
      </p>

      <div className="grid md:grid-cols-2 gap-5">
        {services.map((service) => (
          <Link
            key={service.name}
            href={`/docs/services/${service.name}`}
            className="card group !p-5"
          >
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-lg font-serif font-semibold group-hover:text-karmyq-green-600 transition-colors">
                {service.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </h2>
              <span className="text-xs font-mono text-karmyq-brown-500">:{service.port}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${criticalityColors[service.criticality] || criticalityColors.optional}`}>
                {service.criticality}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-karmyq-green-50 text-karmyq-green-700">
                {service.status}
              </span>
            </div>
            {service.notes && (
              <p className="text-sm text-karmyq-brown-600 line-clamp-2">{service.notes}</p>
            )}
            <div className="mt-3 flex gap-4 text-xs text-karmyq-brown-500">
              <span>{service.apis.length} APIs</span>
              <span>{service.dependencies.length} deps</span>
              <span>{service.infrastructure.length} infra</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
