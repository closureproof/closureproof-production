import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
// Explicit public-value compatibility for existing deployment configuration.
const nextConfig: NextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    NEXT_PUBLIC_DEMO_REQUEST_URL: process.env.NEXT_PUBLIC_DEMO_REQUEST_URL || process.env.VITE_DEMO_REQUEST_URL || '',
  },
  async redirects() {
    return [
      ...['dashboard.html', 'preview', 'workbench'].flatMap(alias => [
        { source: `/${alias}/reports/:path*`, destination: '/app/findings', permanent: false },
        { source: `/${alias}/:path*`, destination: '/app/:path*', permanent: false },
      ]),
      ...['login', 'signup', 'reset-password', 'update-password'].map(path => ({ source: `/${path}`, destination: '/app', permanent: false })),
      { source: '/app/review-queue', destination: '/app/reviews', permanent: false },
    ];
  },
};
export default nextConfig;
