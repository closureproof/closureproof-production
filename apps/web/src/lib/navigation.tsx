"use client";
import NextLink from 'next/link';
import { usePathname, useRouter, useParams as nextParams, useSearchParams as nextSearch } from 'next/navigation';
import type { AnchorHTMLAttributes } from 'react';
export function Link({ to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <NextLink href={to} {...props} />;
}
export function NavLink({ to, end, className, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & { to: string; end?: boolean; className?: string | ((state: { isActive: boolean }) => string) }) {
  const pathname = usePathname();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(to + '/');
  return <NextLink href={to} aria-current={isActive ? 'page' : undefined} className={typeof className === 'function' ? className({ isActive }) : className} {...props} />;
}
export function useNavigate() { const router = useRouter(); return (to: string) => router.push(to); }
export function useParams() { return nextParams<{ id: string }>(); }
export function useSearchParams(): [URLSearchParams, (params: URLSearchParams) => void] {
  const search = nextSearch(); const pathname = usePathname(); const router = useRouter();
  return [new URLSearchParams(search.toString()), params => { const query = params.toString(); router.push(pathname + (query ? '?' + query : ''), { scroll: false }); }];
}
