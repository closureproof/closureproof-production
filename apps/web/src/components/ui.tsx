import { cloneElement, isValidElement, useId, type ReactNode, type ReactElement, type ButtonHTMLAttributes } from 'react';
import { Link } from '../lib/navigation';
import { ArrowUpRight, AlertCircle, Inbox, LoaderCircle } from 'lucide-react';

export const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-charcoal hover:bg-charcoal disabled:opacity-50';
export const secondaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-sm font-semibold transition-colors hover:border-accent hover:text-accent';

export function Button({ secondary, size = 'regular', tone = 'neutral', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean; size?: 'regular' | 'compact'; tone?: 'neutral' | 'danger' }) {
  const compact = `inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${tone === 'danger' ? 'border-rose-200/70 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50' : 'border-line bg-white text-muted hover:border-accent/30 hover:bg-soft hover:text-accent'}`;
  return <button className={`${size === 'compact' ? compact : secondary ? secondaryClass : buttonClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 ${className}`} {...props} />;
}

// Compact vector rendition of the supplied C-and-check logo for navigation.
export function BrandMark({ className = '' }: { className?: string }) {
  return <img src="/brand/closureproof-mark.svg" alt="" width="40" height="40" className={`size-10 shrink-0 ${className}`} />;
}

export function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" aria-label="ClosureProof home" className={`inline-flex items-center gap-2.5 font-display text-xl tracking-tight ${light ? 'text-paper' : 'text-ink'}`}><BrandMark /><span className="font-bold">Closure<span className="font-medium">Proof</span></span></Link>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  const colors: Record<string, string> = { green: 'border-[#53755b]/30 bg-[#53755b]/8 text-[#3e6245]', amber: 'border-[#95662c]/30 bg-[#95662c]/8 text-[#80531b]', red: 'border-rose-200 bg-rose-50 text-rose-800', neutral: 'border-ink/15 bg-ink/3 text-muted' };
  return <span className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] leading-5 align-middle ${colors[tone] || colors.neutral}`}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /><span className="min-w-0 break-words">{children}</span></span>;
}

export function StateBadge({ state }: { state: string }) {
  return <Badge tone={state === 'Closure ready' ? 'green' : state === 'Ready for retest' ? 'amber' : state === 'Not closure ready' ? 'red' : 'neutral'}>{state}</Badge>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-line bg-paper p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function PageHeader({ eyebrow = 'Workspace', title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div className="max-w-3xl"><p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-accent"><span className="h-px w-5 bg-accent" />{eyebrow}</p><h1 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted">{description}</p></div>{action}</div>;
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div role={error ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-4 text-xs leading-relaxed ${error ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-ink/30 bg-soft/60 text-muted'}`}><AlertCircle size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
}

export function Empty({ title = 'Nothing here yet', description, action }: { title?: string; description: string; action?: ReactNode }) {
  return <div className="grid justify-items-center gap-4 py-14 text-center"><Inbox size={26} strokeWidth={1} className="text-muted" /><h2 className="font-display text-2xl font-semibold">{title}</h2><p className="max-w-md text-xs leading-6 text-muted">{description}</p>{action}</div>;
}
export function Loading() { return <div role="status" className="flex items-center gap-3 p-10 font-mono text-xs text-muted"><LoaderCircle className="animate-spin" size={18} />Loading workspace…</div>; }
export function ArrowLink({ to, children }: { to: string; children: ReactNode }) { return <Link to={to} className="inline-flex items-center gap-2 text-xs font-medium text-accent hover:underline">{children}<ArrowUpRight size={16} /></Link>; }
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ 'aria-labelledby'?: string }>, { 'aria-labelledby': labelId }) : children;
  return <label className="grid gap-2 text-sm font-medium"><span id={labelId}>{label}</span>{control}</label>;
}
