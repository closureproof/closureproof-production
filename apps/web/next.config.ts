import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
// Explicit public-value compatibility for existing deployment configuration.
const nextConfig: NextConfig = {
  transpilePackages: ['@closureproof/document-contracts', '@closureproof/assessment-engine'],
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      ...['login', 'signup', 'reset-password', 'update-password'].map((path) => ({
        source: `/${path}`,
        destination: '/app',
        permanent: false,
      })),
      { source: '/app/review-queue', destination: '/app/reviews', permanent: false },
    ];
  },
};
export default nextConfig;
