import { ReactNode } from 'react';
import Header from '../Header';
import Footer from '../Footer';
import { COLUMN_CLASS } from './styles';

/**
 * Shared chrome for every public route: the route-aware Header, a warm-white
 * main surface, and the Footer. Routes drop their own column inside.
 */
export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="bg-karmyq-warmWhite">{children}</main>
      <Footer />
    </>
  );
}

/** Narrow essay column, offset below the fixed header. */
export function EssayColumn({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${COLUMN_CLASS} pt-28 md:pt-32 pb-24 ${className}`}>{children}</div>;
}
