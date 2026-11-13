'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '../lib/navigation';
import { ArrowLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Brand, Button, Card, Field, Notice, secondaryClass } from '../components/ui';
import { submitDemoRequest, type DemoRequest } from '../lib/demo-request';

import { SURVEY_URL } from '../lib/survey';

export function RequestDemoPage() {
  const requestId=useRef<string|null>(null);
  const navigate=useNavigate();
  const redirect=useRef(navigate);
  redirect.current=navigate;
  const confirmation=useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEffect(()=>{
    if(!submitted)return;
    confirmation.current?.focus();
    const timer=window.setTimeout(()=>redirect.current('/'),3000);
    return()=>window.clearTimeout(timer);
  },[submitted]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) || '').trim();
    const request: DemoRequest = { website: value('website'), name: value('name'), email: value('email'), companyName: value('companyName'), contactPerson: value('contactPerson'), contactEmail: value('contactEmail'), contactPhone: value('contactPhone') };
    if (![request.name, request.email, request.companyName, request.contactPerson].every(Boolean)) { setError('Please enter your name, email, company name and contact person.'); return; }
    setBusy(true);
    try { requestId.current ||= crypto.randomUUID(); await submitDemoRequest(request,requestId.current); setSubmitted(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'We couldn’t send your request. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen"><header className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-7 sm:px-8"><Brand /><Link to="/" className="inline-flex items-center gap-2 text-xs text-muted"><ArrowLeft size={15} />Back to home</Link></header><main id="main" className="enter-page mx-auto grid max-w-6xl items-start gap-10 px-5 pt-10 pb-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-20 lg:pt-16"><div className="lg:sticky lg:top-12"><p className="text-xs font-semibold uppercase tracking-widest text-accent">Let’s talk evidence</p><h1 className="mt-5 font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">See a clearer path<br />to audit closure.</h1><p className="mt-6 max-w-md text-base leading-8 text-muted">Tell us a little about your team and who we should contact. Request a demo of ClosureProof’s corrective-action and evidence review workflow.</p><div className="mt-8 space-y-4">{['Trace a finding from corrective action to review.', 'Understand the gaps behind a closure recommendation.', 'Explore evidence records and independent retests.'].map(text => <p key={text} className="flex items-start gap-3 text-sm leading-6"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />{text}</p>)}</div>
        <section aria-labelledby="survey-title" className="mt-8 rounded-2xl border border-line bg-soft p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">Have your say</p>
          <h2 id="survey-title" className="mt-2 font-display text-lg font-semibold">Help shape ClosureProof</h2>
          <p className="mt-3 text-sm leading-7 text-muted">Take part in our optional survey and help us understand what your team needs from ClosureProof.</p>
          <a href={SURVEY_URL} target="_blank" rel="noopener noreferrer" className={`${secondaryClass} mt-4`} aria-label="Take the survey (opens in a new tab)">Take the survey <ArrowUpRight size={16} aria-hidden="true" /></a>
          <p className="mt-3 text-xs text-muted">Optional · Opens in Google Forms in a new tab</p>
        </section>
      </div><Card className="shadow-xl shadow-charcoal/5">{submitted ? <div role="status" className="grid justify-items-start gap-4 py-8"><CheckCircle2 size={32} className="text-accent" /><h2 ref={confirmation} tabIndex={-1} className="font-display text-2xl font-bold focus:outline-none">Request sent</h2><p className="text-sm leading-7 text-muted">Thank you. Your demo request has been received. We’ll contact you to arrange a demo.</p><p className="text-xs text-muted">Returning to the home page in 3 seconds…</p><Link to="/" className="text-sm font-semibold text-accent">Back to home now →</Link></div> : <><h2 className="font-display text-2xl font-bold tracking-tight">Request demo</h2><p className="mt-2 text-sm leading-6 text-muted">No account or password needed.</p><form onSubmit={submit} className="mt-7 grid gap-5"><div aria-hidden="true" className="hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" maxLength={200} /></label></div><Field label="Your name"><input name="name" autoComplete="name" required maxLength={120} placeholder="Full name" /></Field><Field label="Your email"><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" /></Field><Field label="Company name"><input name="companyName" autoComplete="organization" required maxLength={180} placeholder="Company or organisation" /></Field><div className="border-t border-line pt-5"><h3 className="text-sm font-semibold">Who should we contact?</h3><p className="mt-1 text-xs leading-6 text-muted">Enter your own details if you’re the best person to speak with.</p></div><Field label="Contact person’s name"><input name="contactPerson" autoComplete="section-contact name" required maxLength={120} placeholder="Contact person’s full name" /></Field><Field label="Contact person’s email (optional)"><input name="contactEmail" type="email" autoComplete="section-contact email" maxLength={254} placeholder="If different from your email" /></Field><Field label="Contact phone (optional)"><input name="contactPhone" type="tel" autoComplete="section-contact tel" maxLength={40} placeholder="Include country code" /></Field><label className="flex items-start gap-3 text-xs leading-6 text-muted"><input type="checkbox" required className="mt-1 shrink-0" /><span>I agree to be contacted about this demo and have permission to share the contact details above.</span></label>{error && <Notice error>{error}</Notice>}<Button disabled={busy} type="submit">{busy ? 'Sending request…' : 'Request demo'}<ArrowUpRight size={16} /></Button><p className="text-center text-xs leading-6 text-muted">Your details are used to respond to your demo enquiry.</p></form></>}</Card></main></div>;
}
