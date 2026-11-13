'use client';
import {useEffect,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from '../lib/navigation';
import {documentApi,sourceHref,type PublicAnalysisRun} from '../lib/document-analysis';
import type {ManualFinding} from '../lib/manual-api';
import {ManualFindingCreate} from './ManualReviewPages';
import {Button,Card,Loading,Notice,PageHeader,secondaryClass} from '../components/ui';
export function ReportFindingWorkspace(){
 const {id}=useParams();const [params]=useSearchParams();const navigate=useNavigate();
 const [run,setRun]=useState<PublicAnalysisRun|null>(null);const [error,setError]=useState('');
 const [visited,setVisited]=useState<number[]>([]);const [created,setCreated]=useState<Record<number,{id:string;title:string}>>({});
 const selected=Number(params.get('draft'));const active=params.has('draft')&&Number.isInteger(selected)&&selected>=0?selected:null;
 useEffect(()=>{let cancelled=false;setRun(null);setError('');setVisited([]);setCreated({});if(id)documentApi.get(id).then(result=>{if(cancelled)return;if(result.mode!=='report'||result.status!=='ready'||!result.result)throw Error('This report has no available extracted findings.');setRun(result);}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Report unavailable.');});return()=>{cancelled=true;};},[id]);
 useEffect(()=>{if(active!==null)setVisited(previous=>previous.includes(active)?previous:[...previous,active]);},[active]);
 if(!run)return error?<Notice error>{error}</Notice>:<Loading/>;
 const drafts=run.result!.findings;const base='/app/submission/report/'+run.id;
 const submitted=(index:number)=>created[index]||run.submissions?.find(row=>row.draft_index===index)&&{id:run.submissions.find(row=>row.draft_index===index)!.finding_id,title:drafts[index].fields.title||`Finding ${index+1}`};
 const count=drafts.filter((_,index)=>submitted(index)).length;
 function choose(index:number){setVisited(previous=>previous.includes(index)?previous:[...previous,index]);navigate(base+'?draft='+index);}
 function complete(index:number,finding:ManualFinding){setCreated(previous=>({...previous,[index]:{id:finding.id,title:finding.title}}));}
 const current=active!==null&&active<drafts.length?active:null;const saved=current!==null?submitted(current):undefined;
 const next=drafts.findIndex((_,index)=>index!==current&&!submitted(index));
 return <><PageHeader title="Report findings" description={run.filename}/><div className="mb-6 flex flex-wrap items-center gap-4 text-xs leading-6"><p>{count} of {drafts.length} findings created</p><a className="font-semibold text-accent" href={sourceHref(run.id)} target="_blank" rel="noopener noreferrer">Open original audit report</a></div>
 {current!==null&&<div className="mb-6 space-y-4"><Button secondary type="button" onClick={()=>navigate(base)}>Back to report findings</Button><nav aria-label="Findings in this report" className="flex flex-wrap gap-2">{drafts.map((draft,index)=><Button key={index} secondary type="button" aria-current={index===current?'step':undefined} onClick={()=>choose(index)}>Finding {index+1}{submitted(index)?' · Created':''}</Button>)}</nav><p className="text-xs text-muted">Finding {current+1} of {drafts.length}. Each finding has its own form and evidence list. Unsubmitted entries and selected files are retained while you switch findings here; leaving this report or reloading clears unsent entries.</p></div>}
 {current===null&&<div className="space-y-4">{drafts.map((draft,index)=>{const saved=submitted(index);return <Card key={index}><h2 className="font-display text-lg font-semibold">{draft.fields.title||`Finding ${index+1}`}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{draft.fields.description}</p><div className="mt-4 flex flex-wrap items-center gap-3">{saved?<><span className="text-xs font-semibold">Created</span><Link className={secondaryClass} to={'/app/findings/'+saved.id}>Open finding and evidence</Link></>:<Button type="button" onClick={()=>choose(index)}>Review draft finding {index+1}</Button>}</div></Card>;})}{!drafts.length&&<Card>No findings were extracted from this report.</Card>}</div>}
 {saved&&<Card><p className="mb-2 text-xs font-semibold text-accent">Finding created</p><h2 className="font-display text-xl font-semibold">{saved.title}</h2><p className="mt-3 text-sm leading-6">This finding is saved. You can continue with the other findings from the same report.</p><div className="mt-5 flex flex-wrap gap-3">{next>=0&&<Button type="button" onClick={()=>choose(next)}>Continue with next finding</Button>}<Link className={secondaryClass} to={'/app/findings/'+saved.id}>Open finding and evidence</Link></div></Card>}
 {visited.filter(index=>index<drafts.length&&!submitted(index)).map(index=><div data-report-draft={index} key={run.id+':'+index} hidden={current!==index||!!submitted(index)}><ManualFindingCreate reportDraft={{id:run.id,index}} onSubmitted={finding=>complete(index,finding)}/></div>)}
 </>;
}
