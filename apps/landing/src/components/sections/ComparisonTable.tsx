'use client';

import AnimateOnScroll from '../AnimateOnScroll';

const Check = () => (
  <svg className="w-5 h-5 text-karmyq-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const Cross = () => (
  <svg className="w-5 h-5 text-karmyq-brown-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Partial = () => (
  <span className="text-karmyq-orange-400 font-medium text-sm">Partial</span>
);

const ROWS = [
  { feature: 'Community-owned governance', nextdoor: false, facebook: false, karmyq: true },
  { feature: 'Multiple cooperation models', nextdoor: false, facebook: false, karmyq: true },
  { feature: 'Privacy-first (no tracking)', nextdoor: false, facebook: false, karmyq: true },
  { feature: 'Open source', nextdoor: false, facebook: false, karmyq: true },
  { feature: 'Reputation that fades', nextdoor: false, facebook: false, karmyq: true },
  { feature: 'Request types (rides, lending, etc.)', nextdoor: 'partial', facebook: false, karmyq: true },
  { feature: 'Neighborhood-scale', nextdoor: true, facebook: 'partial', karmyq: true },
  { feature: 'No ads or data selling', nextdoor: false, facebook: false, karmyq: true },
  { feature: 'Trust scoring', nextdoor: false, facebook: false, karmyq: true },
  { feature: 'Self-hostable', nextdoor: false, facebook: false, karmyq: true },
];

function CellValue({ val }: { val: boolean | string }) {
  if (val === true) return <Check />;
  if (val === 'partial') return <Partial />;
  return <Cross />;
}

export default function ComparisonTable() {
  return (
    <section className="section-padding bg-karmyq-cream">
      <div className="container-wide">
        <AnimateOnScroll>
          <div className="text-center mb-12">
            <p className="text-karmyq-teal-600 font-medium text-sm tracking-widest uppercase mb-4">
              Why Something Different
            </p>
            <h2 className="heading-2 text-karmyq-brown-900 mb-4">
              Not another neighborhood app
            </h2>
            <p className="body-large max-w-2xl mx-auto">
              Existing platforms were built to extract value. Karmyq was built
              to create it.
            </p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.2}>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-karmyq-brown-200">
                  <th className="text-left py-4 px-4 font-medium text-karmyq-brown-500 text-sm w-[40%]">Feature</th>
                  <th className="text-center py-4 px-4 font-medium text-karmyq-brown-500 text-sm w-[20%]">Nextdoor</th>
                  <th className="text-center py-4 px-4 font-medium text-karmyq-brown-500 text-sm w-[20%]">Facebook Groups</th>
                  <th className="text-center py-4 px-4 font-medium text-karmyq-brown-500 text-sm w-[20%]">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-karmyq-green-100 text-karmyq-green-700 font-semibold">
                      Karmyq
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-karmyq-brown-100 hover:bg-karmyq-green-50/30 transition-colors">
                    <td className="py-4 px-4 text-karmyq-brown-800">{row.feature}</td>
                    <td className="py-4 px-4 text-center"><CellValue val={row.nextdoor} /></td>
                    <td className="py-4 px-4 text-center"><CellValue val={row.facebook} /></td>
                    <td className="py-4 px-4 text-center"><CellValue val={row.karmyq} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {ROWS.map((row, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                <p className="font-medium text-karmyq-brown-900 mb-3">{row.feature}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-karmyq-brown-400 text-xs mb-1">Nextdoor</p>
                    <CellValue val={row.nextdoor} />
                  </div>
                  <div>
                    <p className="text-karmyq-brown-400 text-xs mb-1">Facebook</p>
                    <CellValue val={row.facebook} />
                  </div>
                  <div className="bg-karmyq-green-50 rounded-lg py-1">
                    <p className="text-karmyq-green-600 text-xs mb-1 font-medium">Karmyq</p>
                    <CellValue val={row.karmyq} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
