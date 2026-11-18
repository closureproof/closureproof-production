import type { Metadata } from 'next';
import { AboutPage } from '../../screens/AboutPage';
export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn how ClosureProof connects audit findings, remediation evidence and structured review to support closure-readiness recommendations.',
};
export default function Page() {
  return <AboutPage />;
}
