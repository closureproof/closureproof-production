import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
window.scrollTo = vi.fn();

beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ''); });

vi.mock('./lib/navigation', async () => { const router = await import('react-router'); return { Link: router.Link, NavLink: router.NavLink, useNavigate: router.useNavigate, useParams: router.useParams, useSearchParams: router.useSearchParams }; });
