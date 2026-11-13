'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReportSource } from '@closureproof/document-contracts';
import { manualApi, type ManualEvidence } from '../../lib/manual-api';
import { documentApi } from '../../lib/document-analysis';
import { Button, Notice } from '../ui';

interface PreviewFile {blob:Blob;sha256?:string}
export function AuditReportPreview({source,onClose}:{source:ReportSource;onClose:()=>void}){
 const load=useCallback(async(signal:AbortSignal)=>{const result=await documentApi.source(source.run_id);const response=await fetch(result.url,{signal,cache:'no-store'});if(!response.ok)throw Error('The original file could not be loaded. Please retry.');return {blob:await response.blob(),sha256:result.sha256};},[source.run_id]);
 return <DocumentPreview filename={source.filename} title="Original audit report" load={load} onClose={onClose}/>;
}
export function EvidencePreview({findingId,evidence,onClose}:{findingId:string;evidence:ManualEvidence;onClose:()=>void}){
 const load=useCallback(async()=>{
  if(['image/png','image/jpeg'].includes(evidence.mime)){const url=await manualApi.inspectImage(findingId,evidence.id);try{return {blob:await(await fetch(url)).blob()};}finally{URL.revokeObjectURL(url);}}
  return manualApi.evidenceFile(findingId,evidence.id,'inspect');
 },[findingId,evidence.id,evidence.mime]);
 return <DocumentPreview filename={evidence.filename} mime={evidence.mime} title="Submitted evidence" onDownload={()=>manualApi.download(findingId,evidence.id)} load={load} onClose={onClose}/>;
}
function DocumentPreview({filename,title,mime='',load,onClose,onDownload}:{filename:string;title:string;mime?:string;load:(signal:AbortSignal)=>Promise<PreviewFile>;onClose:()=>void;onDownload?:()=>Promise<void>}){
 const [url,setUrl]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [attempt,setAttempt]=useState(0);
 const close=useRef<HTMLButtonElement>(null);const frame=useRef<HTMLIFrameElement>(null);const docxBytes=useRef<ArrayBuffer|null>(null);
 const [text,setText]=useState('');
 const isDocx=filename.toLowerCase().endsWith('.docx');
 const isPdf=filename.toLowerCase().endsWith('.pdf');
 const isImage=['image/png','image/jpeg'].includes(mime);
 const isText=['text/plain','text/csv','application/json'].includes(mime)||/\.(txt|csv|json)$/i.test(filename);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',escape);return()=>{window.removeEventListener('keydown',escape);previous?.focus();};},[onClose]);
 useEffect(()=>{const controller=new AbortController();let objectUrl='';let active=true;setLoading(true);setError('');setUrl('');docxBytes.current=null;
  void(async()=>{try{const result=await load(controller.signal);const bytes=await result.blob.arrayBuffer();if(bytes.byteLength>25*1024*1024)throw Error('This file exceeds the preview size limit.');const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');if(result.sha256&&digest!==result.sha256)throw Error('The original file could not be verified. Please retry.');if(!active)return;objectUrl=URL.createObjectURL(new Blob([bytes],{type:isDocx?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':isPdf?'application/pdf':isImage?'image/png':'application/octet-stream'}));docxBytes.current=isDocx?bytes:null;setUrl(objectUrl);if(isText)setText(new TextDecoder().decode(bytes).slice(0,100000));if(!isDocx)setLoading(false);}catch(e){if(active){setLoading(false);setError(e instanceof Error?e.message:'The original file could not be loaded.');}}})();
  return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[load,isDocx,isPdf,isImage,isText,attempt]);
 async function renderWord(){if(!docxBytes.current||!frame.current?.contentDocument)return;const document=frame.current.contentDocument;try{const {renderAsync}=await import('docx-preview');const content=document.createElement('div');const styles=document.createElement('div');document.body.replaceChildren(styles,content);await renderAsync(docxBytes.current,content,styles,{ignoreWidth:true,ignoreHeight:true,ignoreFonts:true,renderAltChunks:false,renderComments:false,useBase64URL:true});if(frame.current?.contentDocument===document)setLoading(false);}catch{if(frame.current?.contentDocument===document){setError('The Word report could not be displayed. Retry or download the original.');setLoading(false);}}}
 return createPortal(<aside data-report-preview aria-label={title+' preview'} className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-white shadow-xl xl:w-[45vw] xl:max-w-3xl">
  <header className="flex items-start justify-between gap-3 border-b border-line p-4"><div className="min-w-0"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 break-words text-xs leading-5 text-muted">{filename}</p></div><button ref={close} type="button" onClick={onClose} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent">Close preview</button></header>
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3"><p className="text-xs text-muted">Your review entries stay in place.</p>{url&&(onDownload?<Button secondary size="compact" type="button" onClick={()=>{void onDownload().catch(e=>setError(e instanceof Error?e.message:'Download failed.'));}}>Download original</Button>:<a href={url} download={filename} className="text-xs font-semibold text-accent">Download original</a>)}</div>
  {loading&&<p role="status" className="p-4 text-xs">Loading document…</p>}
  {error&&<div className="space-y-3 p-4"><Notice error>{error}</Notice><Button secondary type="button" onClick={()=>setAttempt(value=>value+1)}>Retry preview</Button></div>}
  {url&&!error&&(isDocx?<iframe ref={frame} key={url} title={title+' document'} sandbox="allow-same-origin" onLoad={()=>{void renderWord();}} srcDoc={'<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data: blob:; style-src &#39;unsafe-inline&#39;; font-src data: blob:; base-uri &#39;none&#39;; form-action &#39;none&#39;"><style>body{margin:0;background:#f3f6fa;font-family:Arial,sans-serif}.docx-wrapper{padding:12px!important;background:#f3f6fa!important}.docx-wrapper section.docx{width:100%!important;min-width:0!important;min-height:calc(100vh - 48px)!important;background:white!important;box-shadow:none!important;padding:24px!important;box-sizing:border-box;overflow-wrap:anywhere}img,table{max-width:100%}</style></head><body></body></html>'} className="min-h-0 flex-1 border-0"/>:isPdf?<iframe title={title+' document'} src={url+'#view=FitH'} className="min-h-0 flex-1 border-0"/>:isImage?<div className="min-h-0 flex-1 overflow-auto bg-soft p-4"><img src={url} alt={filename} className="mx-auto max-w-full object-contain"/></div>:isText?<div className="min-h-0 flex-1 overflow-auto p-4"><pre className="whitespace-pre-wrap break-words text-xs leading-6">{text}</pre><p className="mt-4 text-xs text-muted">Text preview · up to 100,000 characters. Download the original for the complete file.</p></div>:<p className="p-4 text-xs leading-6">Preview is not available for this file type. Use Download original to inspect it.</p>)}
 </aside>,document.body);
}
