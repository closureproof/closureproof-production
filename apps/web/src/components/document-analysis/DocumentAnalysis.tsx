'use client';
import { AuditReportPreview } from './AuditReportPreview';
import { latestEvidenceAnalyses } from '../../features/evidence-analysis-selection';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowRight, Check, FileText, Pencil, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { DOCUMENT_LIMIT, documentMime, type SourceReference, type ReportSource } from '@closureproof/document-contracts';
import { documentApi, sourceHref, type PublicAnalysisRun } from '../../lib/document-analysis';
import type { ManualFinding } from '../../lib/manual-api';
import { Link } from '../../lib/navigation';
import { Badge, Button, Card, Field, Notice, secondaryClass } from '../ui';
const errorText=(e:unknown)=>e instanceof Error?e.message:'The document request could not be completed.';
export function SourceQuote({source}:{source:SourceReference}){return <div className="mt-3 space-y-2 rounded-xl bg-soft/50 p-3 text-xs leading-6"><p className="break-words font-semibold">{source.page?`Page ${source.page} · `:''}{source.locator}</p><blockquote className="break-words whitespace-pre-wrap border-l-2 border-accent/40 pl-3">{source.quote}</blockquote></div>;}
export function AnalysisState({run,onRefresh,onProcess,busy}:{run:PublicAnalysisRun;onRefresh:()=>void;onProcess:()=>void;busy:boolean}){return <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><Badge>{run.status}</Badge><span className="break-all text-xs">{run.filename}</span><a className="text-xs font-semibold text-accent" href={sourceHref(run.id)} target="_blank" rel="noopener noreferrer">Open original document</a></div>{run.error&&<Notice error>{run.error}</Notice>}{run.status!=='ready'&&<div className="flex flex-wrap gap-3"><Button type="button" secondary disabled={busy} onClick={onProcess}>{busy?'Analysing document…':run.status==='pending'?'Analyse document':run.status==='failed'?'Retry analysis':'Resume interrupted analysis'}</Button><Button type="button" secondary disabled={busy} onClick={onRefresh}>Refresh analysis status</Button></div>}{run.status==='processing'&&!busy&&<p className="text-xs leading-6 text-muted">Another request may still be processing. Refresh first. An interrupted attempt can be resumed after its lease expires; the provider may charge for retries.</p>}{run.result&&<><p className="text-xs">Document coverage: {run.result.coverage.replaceAll('_',' ')}</p>{run.result.limitations.length>0&&<Notice>{run.result.limitations.map((note,i)=><p key={i}>{note}</p>)}</Notice>}</>}</div>;}
function ReportExtractionResult({run,busy,onProcess,onRefresh}:{run:PublicAnalysisRun;busy:boolean;onProcess:()=>void;onRefresh:()=>void}){
 return <div className="space-y-4"><AnalysisState run={run} busy={busy} onProcess={onProcess} onRefresh={onRefresh}/>{run.result&&<Link className="inline-block text-xs font-semibold text-accent" to={'/app/submission/report/'+run.id}>View all findings from this report</Link>}{run.status==='ready'&&run.result?.findings.length===0&&<p className="text-xs leading-6">No supported audit findings were extracted. You can enter a finding manually.</p>}{run.result?.findings.map((draft,index)=>{const submission=run.submissions?.find(item=>item.draft_index===index);return <div key={index} className="rounded-xl bg-canvas p-4"><h4 className="text-sm font-semibold">{draft.fields.title||`Draft finding ${index+1}`}</h4><p className="mt-2 whitespace-pre-wrap text-xs leading-6">{draft.fields.description}</p><div className="mt-3">{submission?<Link className={secondaryClass} to={'/app/findings/'+submission.finding_id}>Open submitted finding</Link>:<Link className={secondaryClass} to={`/app/submission/report/${run.id}?draft=${index}`}>Review draft finding <ArrowRight size={14}/></Link>}</div></div>;})}</div>;
}
export function AuditReportIntake({onOpenChange}:{onOpenChange?:(open:boolean)=>void}){
 const [open,setOpen]=useState(false);const [run,setRun]=useState<PublicAnalysisRun|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [file,setFile]=useState<File|null>(null);const input=useRef<HTMLInputElement>(null);const requestId=useRef(crypto.randomUUID());
 async function refresh(id:string){try{setRun(await documentApi.get(id));}catch(e){setError(errorText(e));}}
 async function retryAnalysis(id:string){setBusy(true);setError('');try{setRun(await documentApi.process(id));}catch(e){setError(errorText(e));await refresh(id);}finally{setBusy(false);}}
 async function upload(){if(!file)return;setBusy(true);setError('');try{if(!documentMime(file.name)||!file.size||file.size>DOCUMENT_LIMIT)throw Error('Choose a non-empty PDF or DOCX up to 25 MB.');const current=await documentApi.report(file,requestId.current);setRun(current);requestId.current=crypto.randomUUID();setFile(null);try{setRun(await documentApi.process(current.id));}catch(e){setError(errorText(e));await refresh(current.id);}}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 function toggle(){const next=!open;setOpen(next);onOpenChange?.(next);}
 return <Card className="mb-6 max-w-4xl">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><FileText size={20}/>Start from an audit report</h2><p className="mt-2 text-xs leading-6 text-muted">Upload a PDF or DOCX, then review the extracted findings before submitting them.</p></div>
   <Button type="button" secondary disabled={busy} aria-expanded={open} onClick={toggle}>{open?'Enter a finding manually':'Upload audit report'}</Button>
  </div>
  {open&&<div className="mt-5 space-y-5">
   {file&&<section aria-label="Selected audit report" className="flex items-start gap-3 rounded-xl border border-accent/20 bg-soft/50 p-4">
    <span className="rounded-lg bg-white p-2 text-accent"><FileText size={22} aria-hidden="true"/></span>
    <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Selected report</p><p className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{file.name}</p><p className="mt-1 text-xs text-muted">{file.name.split('.').pop()?.toUpperCase()} · {(file.size/1024/1024).toFixed(2)} MB</p></div>
    <Button type="button" size="compact" secondary disabled={busy} aria-label="Remove selected audit report" onClick={()=>{setFile(null);setError('');requestId.current=crypto.randomUUID();}}><X size={14} aria-hidden="true"/>Remove</Button>
   </section>}
   {run&&<section aria-label="Current report extraction" className="space-y-4 rounded-xl border border-line p-4"><ReportExtractionResult run={run} busy={busy} onProcess={()=>{void retryAnalysis(run.id);}} onRefresh={()=>{void refresh(run.id);}}/></section>}
   <div aria-label="Audit report upload controls" className="flex flex-col items-stretch gap-3 rounded-xl border-2 border-dashed border-accent/30 p-4 sm:flex-row sm:items-center">
    <Upload size={22} aria-hidden="true"/><p className="min-w-0 flex-1 text-xs leading-6">Choose a PDF or DOCX audit report<span className="block text-muted">25 MB maximum</span></p>
    <Button type="button" secondary disabled={busy} onClick={()=>input.current?.click()}>Browse audit report</Button>
    <input ref={input} aria-label="Audit report file" type="file" accept=".pdf,.docx" className="sr-only" disabled={busy} onChange={event=>{setFile(event.target.files?.[0]||null);setRun(null);setError('');requestId.current=crypto.randomUUID();event.target.value='';}}/>
   </div>
   <Button type="button" disabled={busy||!file} onClick={()=>{void upload();}}>{busy?'Preparing draft findings…':'Extract draft findings'}</Button>
   {error&&<Notice error>{error}</Notice>}
  </div>}
 </Card>;
}
type FactEdit = { value: string; removed: boolean; editing: boolean };
export interface EvidenceAnalysisHandle { saveFacts: (reviewer: string, onlyKeys?: string[]) => Promise<string[]>; saveEdits: (reviewer:string)=>Promise<void> }
function FactCard({run,index,edit,onChange,disabled,referenceOnly=false,included=true}:{run:PublicAnalysisRun;index:number;edit?:FactEdit;onChange:(edit:FactEdit)=>void;disabled:boolean;referenceOnly?:boolean;included?:boolean}){
 const fact=run.result!.facts[index];const previous=run.confirmations?.find(c=>c.fact_index===index);
 const value=edit?.value??previous?.value??fact.value;const removed=edit?.removed??previous?.decision==='rejected';
 const [input,setInput]=useState(value);const [error,setError]=useState('');
 function startEditing(){setInput(value);setError('');onChange({value,removed,editing:true});}
 function saveEdit(){if(!input.trim()){setError('Enter a fact, or remove it from the review.');return;}onChange({value:input.trim(),removed:false,editing:false});setError('');}
 return <div className="space-y-2 rounded-lg border border-line p-3" role="group" aria-label={`Extracted fact ${index+1}`}>
  <div className="flex flex-wrap items-start justify-between gap-3"><h4 className="text-sm font-semibold">{fact.label}</h4><Badge>{referenceOnly?'Reference only':removed?'Removed':!included?'Available':value!==fact.value?'Edited':'Included'}</Badge></div>
  {edit?.editing?<><Field label={`Fact ${index+1}: extracted value`}><textarea maxLength={2000} value={input} disabled={disabled} onChange={e=>setInput(e.target.value)}/></Field><div className="flex flex-wrap items-center gap-2"><Button type="button" size="compact" secondary disabled={disabled} onClick={saveEdit}><Check size={14} aria-hidden="true"/>Save edit</Button><Button type="button" size="compact" secondary disabled={disabled} onClick={()=>{onChange({value,removed,editing:false});setError('');}}><X size={14} aria-hidden="true"/>Cancel edit</Button></div></>:<><p className="break-words whitespace-pre-wrap text-xs leading-6">{value}</p><div className="flex flex-wrap items-center gap-2">{!removed&&<Button type="button" size="compact" secondary disabled={disabled} onClick={startEditing}><Pencil size={14} aria-hidden="true"/>Edit</Button>}<Button type="button" size="compact" secondary tone={removed?'neutral':'danger'} disabled={disabled} onClick={()=>onChange({value,removed:!removed,editing:false})}>{removed?<RotateCcw size={14} aria-hidden="true"/>:<Trash2 size={14} aria-hidden="true"/>}{removed?'Restore':'Remove'}</Button></div></>}
  <details><summary className="cursor-pointer text-xs font-semibold text-accent">Source details</summary><SourceQuote source={fact}/><p className="mt-3 whitespace-pre-wrap text-xs leading-6">Original extraction: {fact.value}</p>{previous&&<p className="mt-2 text-xs leading-6">Last saved by {previous.actor} · {new Date(previous.created_at).toLocaleString('en-GB')}<br/>{previous.value}</p>}</details>
  {error&&<Notice error>{error}</Notice>}
 </div>;
}
export const EvidenceAnalysis=forwardRef<EvidenceAnalysisHandle,{finding:ManualFinding;selected:string[];onChange:Dispatch<SetStateAction<string[]>>;disabled?:boolean;includedKeys?:string[]}>(function EvidenceAnalysis({finding,selected,onChange,disabled=false,includedKeys},ref){
 const [open,setOpen]=useState(false);const [runs,setRuns]=useState<PublicAnalysisRun[]>([]);const [evidence,setEvidence]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [edits,setEdits]=useState<Record<string,FactEdit>>({});const requestId=useRef(crypto.randomUUID());
 const initialLoad=useRef<Promise<PublicAnalysisRun[]>|null>(null);
 const eligible=finding.evidence?.filter(e=>documentMime(e.filename)&&!finding.evidence?.some(next=>next.supersedesId===e.id))||[];
 const currentIds=new Set(latestEvidenceAnalyses(runs,finding).map(run=>run.id));
 const isCurrent=(run:PublicAnalysisRun)=>currentIds.has(run.id);
 const latestAttempts=new Map<string,PublicAnalysisRun>();
 for(const run of [...runs].sort((a,b)=>b.created_at.localeCompare(a.created_at))){
  if(run.finding_revision!==finding.revision||!eligible.some(file=>file.id===run.evidence_id&&file.version===run.evidence_version&&file.sha256===run.sha256))continue;
  if(!latestAttempts.has(run.evidence_id!))latestAttempts.set(run.evidence_id!,run);
 }
 const load=async()=>{const response=await documentApi.list(finding.id);const details=await Promise.all(response.runs.map(r=>documentApi.get(r.id)));setRuns(details);return details;};
 useEffect(()=>{let active=true;initialLoad.current=documentApi.list(finding.id).then(response=>Promise.all(response.runs.map(r=>documentApi.get(r.id)))).then(details=>{if(active){setRuns(details);setError('');}return details;}).catch(e=>{if(active)setError(errorText(e));return [];});return()=>{active=false;};},[finding.id,finding.revision]);
 async function saveFacts(reviewer:string,onlyKeys?:string[],editsOnly=false){
  if(busy)throw Error('Wait for document analysis to finish before saving the review.');
  const initial=await initialLoad.current;
  // Optional document analysis must never prevent a manual review when unavailable.
  if(!runs.length&&!initial?.length&&!selected.length&&!Object.keys(edits).length)return [];
  const details=await load();const current=latestEvidenceAnalyses(details,finding);
  if(Object.entries(edits).some(([key,edit])=>edit.editing&&current.some(run=>key.startsWith(run.id+':'))))throw Error('Save or cancel the open fact edit before saving the review.');
  if(onlyKeys?.some(key=>!current.some(run=>run.result?.facts.some((_,index)=>key===run.id+':'+index))))throw Error('The prepared review cites an earlier extraction. Prepare a new review draft against the latest evidence analysis.');
  const included=current.flatMap(run=>(run.result?.facts||[]).map((fact,index)=>{const key=run.id+':'+index;const previous=run.confirmations?.find(c=>c.fact_index===index);return {run,fact,index,key,previous,value:edits[key]?.value??previous?.value??fact.value,removed:edits[key]?.removed??previous?.decision==='rejected'};})).filter(fact=>(!onlyKeys||onlyKeys.includes(fact.key))&&(!editsOnly||!!edits[fact.key]));
  if(!editsOnly&&included.filter(fact=>!fact.removed).length>20)throw Error('Prepare a review from evidence to automatically select its supporting facts before saving.');
  if(included.length&&reviewer.trim().length<2)throw Error('Enter the reviewer name before saving extracted facts.');
  const ids:string[]=[];
  for(const {run,fact,index,key,previous,value,removed} of included){
   if(removed&&!previous&&!edits[key])continue;
   const decision=removed?'rejected':value===fact.value?'confirmed':'corrected';
   const matches=previous&&previous.decision===decision&&previous.value===value&&previous.actor===reviewer.trim();
   const record=matches?previous:await documentApi.confirm(run.id,{fact_index:index,decision,value,actor:reviewer.trim(),reason:removed?'Removed from the review by the reviewer.':decision==='corrected'?'Extracted text edited by the reviewer.':'',source_checked:!removed});
   if(!removed)ids.push(record.id);
  }
  if(!editsOnly)onChange(ids);await load();return ids;
 }
 useImperativeHandle(ref,()=>({saveFacts,saveEdits:async reviewer=>{await saveFacts(reviewer,undefined,true);}}));
 async function retryAnalysis(id:string){setBusy(true);setError('');try{await documentApi.process(id);await load();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function analyse(){if(!evidence)return;setBusy(true);setError('');try{const {run}=await documentApi.evidence(finding.id,finding.revision,evidence,requestId.current);setRuns(list=>[run,...list.filter(r=>r.id!==run.id)]);requestId.current=crypto.randomUUID();await documentApi.process(run.id);await load();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 const staleCount=selected.filter(id=>runs.some(run=>!isCurrent(run)&&run.confirmations?.some(c=>c.id===id))).length;
 const includedCount=runs.filter(isCurrent).reduce((count,run)=>count+(run.result?.facts||[]).filter((_,index)=>(!includedKeys||includedKeys.includes(run.id+':'+index))&&!(edits[run.id+':'+index]?.removed??run.confirmations?.find(c=>c.fact_index===index)?.decision==='rejected')).length,0);
 const locked=disabled||busy||['closed','awaiting_final_approval'].includes(finding.lifecycle);
 function renderRun(run:PublicAnalysisRun){
  const facts=run.result?.facts||[];
  const removed=(index:number)=>edits[run.id+':'+index]?.removed??run.confirmations?.find(c=>c.fact_index===index)?.decision==='rejected';
  const active=(index:number)=>!includedKeys||includedKeys.includes(run.id+':'+index);
  const card=(index:number)=><FactCard key={run.id+':'+index} run={run} index={index} referenceOnly={false} included={active(index)} edit={edits[run.id+':'+index]} onChange={edit=>setEdits(values=>({...values,[run.id+':'+index]:edit}))} disabled={locked}/>;
  const main=facts.map((_,index)=>index).filter(index=>active(index)&&!removed(index));
  const other=facts.map((_,index)=>index).filter(index=>!active(index)&&!removed(index));
  const excluded=facts.map((_,index)=>index).filter(removed);
  return <div key={run.id} className="space-y-3 rounded-xl border border-line p-3">
   <AnalysisState run={run} busy={locked} onProcess={()=>{void retryAnalysis(run.id);}} onRefresh={()=>{void load().catch(e=>setError(errorText(e)));}}/>
   {run.status==='ready'&&!facts.length&&<p className="text-xs">No supported evidence facts were extracted.</p>}
   {main.map(card)}
   {other.length>0&&<details><summary className="cursor-pointer text-xs font-semibold text-accent">Other extracted facts ({other.length})</summary><div className="mt-3 space-y-3">{other.map(card)}</div></details>}
   {excluded.length>0&&<details><summary className="cursor-pointer text-xs font-semibold text-accent">Removed facts ({excluded.length})</summary><div className="mt-3 space-y-3">{excluded.map(card)}</div></details>}
  </div>;
 }

 return <section className="mb-6 rounded-xl border border-line p-4"><Button secondary type="button" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(!open)}>{open?'Hide document analysis':'Analyse submitted documents'}</Button><p className="mt-2 text-xs leading-6 text-muted">Extracted evidence facts are available for your review. Edit incorrect facts or remove irrelevant ones. Check the included facts against their sources. Saving your review stores your edits; Complete Review records your acceptance of the included facts and source references for the assessment.</p>{includedCount>0&&<p className="mt-2 text-xs font-semibold">{includedCount} current extracted {includedCount===1?'fact':'facts'} {includedKeys?'used by this prepared review':'included in this review'}.</p>}{open&&<div className="mt-5 space-y-4">{error&&<Notice error>{error}</Notice>}{eligible.length>0?<><Field label="Evidence document to analyse"><select disabled={locked} value={evidence} onChange={e=>{setEvidence(e.target.value);requestId.current=crypto.randomUUID();}}><option value="">Choose an uploaded PDF or DOCX</option>{eligible.map(e=><option key={e.id} value={e.id}>{e.filename} · v{e.version}</option>)}</select></Field><Button type="button" disabled={locked||!evidence} onClick={()=>{void analyse();}}>{busy?'Analysing document…':'Extract proposed evidence facts'}</Button></>:<p className="text-xs leading-6">No PDF or DOCX evidence is available. Evidence can be added on the finding page; manual review remains available here.</p>}{staleCount>0&&<Notice>Facts from earlier finding revisions will be excluded when this review is saved.</Notice>}{runs.filter(run=>isCurrent(run)||run.status!=='ready'&&latestAttempts.get(run.evidence_id!)?.id===run.id).map(run=>renderRun(run))}</div>}</section>;
});

export function AuditReportSource({source}:{source:ReportSource|undefined}){const [preview,setPreview]=useState(false);const closePreview=useCallback(()=>setPreview(false),[]);if(!source)return null;return <div className="mb-5 rounded-xl border border-line bg-soft/40 p-4 text-xs leading-6"><p className="font-semibold">Source audit report: {source.filename}</p><p>Draft finding confirmed by {source.confirmed_by} · {new Date(source.confirmed_at).toLocaleString('en-GB')}</p><button type="button" className="font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent" onClick={()=>setPreview(true)}>Open original audit report</button><Link className="ml-4 inline-block font-semibold text-accent" to={'/app/submission/report/'+source.run_id}>Back to report findings</Link><p className="mt-2 text-muted">This report identifies the finding. Remediation evidence is submitted separately.</p>{preview&&<AuditReportPreview source={source} onClose={closePreview}/>}</div>;}
