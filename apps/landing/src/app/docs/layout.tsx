import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DocsSidebar from '@/components/docs/DocsSidebar';
import MobileDocNav from '@/components/docs/MobileDocNav';

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
              {children}
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
