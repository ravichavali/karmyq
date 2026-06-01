import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const NetworkGraph = dynamic(() => import('../NetworkGraph'), { ssr: false });
const CommunityDepthGraph = dynamic(() => import('../graphs/CommunityDepthGraph'), { ssr: false });

type NetworkView = 'people' | 'communities';

interface TrustNetworkWidgetProps {
  currentUserId: string;
}

export default function TrustNetworkWidget({ currentUserId }: TrustNetworkWidgetProps) {
  const [view, setView] = useState<NetworkView>('people');

  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Your Trust Network</h3>
          <p className="text-sm text-slate-400">
            {view === 'people'
              ? "People you've built trust with across your communities"
              : 'How your communities connect through shared trust and fission lineage'}
          </p>
        </div>
        <Link href="/network" className="text-sm text-indigo-400 hover:text-indigo-300">
          View full →
        </Link>
      </div>

      {/* People / Communities toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setView('people')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            view === 'people' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          People
        </button>
        <button
          onClick={() => setView('communities')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            view === 'communities' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Communities
        </button>
      </div>

      {view === 'people' ? (
        <NetworkGraph currentUserId={currentUserId} height={360} />
      ) : (
        <CommunityDepthGraph height={360} />
      )}
    </div>
  );
}
