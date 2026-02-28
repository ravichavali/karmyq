import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DocsSidebar from '@/components/docs/DocsSidebar';
import MobileDocNav from '@/components/docs/MobileDocNav';
import buildData from '@/data/docs/build.json';

function BuildStamp() {
  const date = new Date(buildData.commitDate);
  const formatted = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <div className="flex items-center gap-2 text-xs text-karmyq-brown-400 mb-6 pb-4 border-b border-karmyq-brown-100">
      <span>Docs</span>
      <span>·</span>
      <span className="font-mono">{buildData.commitSha}</span>
      <span>·</span>
      <span>Updated {formatted}</span>
      <span>·</span>
      <span>{buildData.adrCount} ADRs</span>
    </div>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="min-h-screen pt-20 md:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">
            <DocsSidebar />
            <main className="flex-1 min-w-0">
              <MobileDocNav />
              <BuildStamp />
              {children}
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
