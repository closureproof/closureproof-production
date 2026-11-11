import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import '../styles/theme.css';
export const metadata: Metadata = {
  title: { default: 'ClosureProof — Audit finding review', template: 'ClosureProof — %s' },
  description: 'Review corrective actions and evidence for ISO 27001 audit findings. Record implementation status, outstanding issues and closure recommendations.',
  icons: { icon: '/brand/closureproof-mark.svg' },
};
export const viewport: Viewport = { themeColor: '#061739' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><a href="#main" className="sr-only z-50 rounded-xl bg-white p-3 focus:not-sr-only focus:fixed">Skip to content</a><Suspense fallback={<main id="main" className="p-8">Loading…</main>}>{children}</Suspense></body></html>;
}
