'use client';
import {useState} from 'react';
import {ArrowUpRight,Menu,X} from 'lucide-react';
import {Link} from '../lib/navigation';
import {Brand,buttonClass} from './ui';
export function PublicHeader({about=false}:{about?:boolean}){
 const [open,setOpen]=useState(false);const home=about?'/':'';
 const links=<><a href={home+'#platform'}>Platform</a><Link to="/request-demo">How it works</Link><a href={home+'#integrations'}>Integrations</a><Link to="/about" aria-current={about?'page':undefined} className={about?'font-semibold text-accent':undefined}>About</Link></>;
 return <header className="relative z-20 mx-auto max-w-6xl px-5 sm:px-8"><nav aria-label="Main navigation" className="flex h-22 items-center justify-between gap-4"><Brand/><div className="hidden items-center gap-8 text-sm font-medium text-muted lg:flex">{links}</div><div className="flex items-center gap-3"><div className="hidden sm:block"><Link to="/request-demo" className={buttonClass}>Request demo<ArrowUpRight size={16} aria-hidden="true"/></Link></div><button type="button" className="rounded-lg p-2 lg:hidden" aria-label="Toggle menu" aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>setOpen(!open)}>{open?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button></div></nav>{open&&<nav id="mobile-navigation" aria-label="Mobile navigation" onClick={()=>setOpen(false)} className="absolute inset-x-5 top-22 flex flex-col gap-5 rounded-2xl border border-line bg-white p-6 text-sm shadow-xl lg:hidden">{links}<Link to="/request-demo" className={buttonClass}>Request demo</Link></nav>}</header>;
}
