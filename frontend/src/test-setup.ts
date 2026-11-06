import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
window.scrollTo = vi.fn();

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', ''); vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', ''); vi.stubEnv('VITE_SUPABASE_ANON_KEY', ''); });
