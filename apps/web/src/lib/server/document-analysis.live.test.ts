// Opt-in provider check. Synthetic documents only; no Supabase records/files are created.
import { it,expect,vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { jsPDF } from 'jspdf';
import { zipSync,strToU8 } from 'fflate';
import { DOCX_MIME,type AnalysisRun } from '@closureproof/document-contracts';
vi.mock('server-only',()=>({}));
import { extractWithOpenAI } from './document-analysis';
function liveConfig(){const config=parseEnv(readFileSync('.env.local','utf8'));for(const name of ['AI_EXTRACTION_ENABLED','OPENAI_API_KEY','OPENAI_EXTRACTION_MODEL'])if(process.env[name]===undefined&&config[name])process.env[name]=config[name];}
it.skipIf(process.env.RUN_AI_LIVE_SMOKE!=='1')('reads synthetic PDF and DOCX through the configured OpenAI file-input API',async()=>{
 liveConfig();
 const doc=new jsPDF();doc.text(['Synthetic audit report','Finding: Access reviews omitted five privileged accounts.','Control: A.5.18','Owner: Test IT Operations','No corrective action is recorded in this report.'],15,20);
 const paragraph='Synthetic audit report. Finding: Access reviews omitted five privileged accounts. Control: A.5.18. Owner: Test IT Operations. No corrective action is recorded in this report.';
 const docx=zipSync({'[Content_Types].xml':strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'word/document.xml':strToU8('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+paragraph+'</w:t></w:r></w:p></w:body></w:document>')});
 for(const [filename,mime,bytes] of [['synthetic-audit.pdf','application/pdf',new Uint8Array(doc.output('arraybuffer'))],['synthetic-audit.docx',DOCX_MIME,docx]] as const){
  const output=await extractWithOpenAI(bytes,{filename,mime,mode:'report',model:process.env.OPENAI_EXTRACTION_MODEL||'gpt-4.1-mini'} as AnalysisRun,async(...args)=>{const response=await fetch(...args);if(response.ok){const success=await response.clone().json();const text=(success.output||[]).flatMap((x:{content?:{type:string;text?:string}[]})=>x.content||[]).filter((x:{type:string})=>x.type==='output_text').map((x:{text:string})=>x.text).join('');try{const parsed=JSON.parse(text);console.log('Synthetic extraction summary:',JSON.stringify({coverage:parsed.coverage,findings:parsed.findings?.map((f:{fields:Record<string,unknown>;sources:unknown[]})=>({title:f.fields.title,description:f.fields.description,owner:f.fields.owner,sources:f.sources?.length})),limitations:parsed.limitations}));}catch{/* Actual parsing errors remain test failures. */}}if(!response.ok){const data=await response.clone().json().catch(()=>({}));console.log('Synthetic provider request rejected:',JSON.stringify({status:response.status,code:data.error?.code,type:data.error?.type,param:data.error?.param}));if(response.status===400&&data.error?.code==='invalid_json_schema'||data.error?.code==='model_not_found')console.log('Provider diagnostic:',String(data.error.message).slice(0,500));}return response;});
  expect(output.result.findings.length).toBe(1);expect(output.result.findings[0].fields.description?.toLowerCase()).toContain('privileged');expect(output.result.findings[0].fields.owner).toBe('Test IT Operations');
  expect(output.result.findings[0].sources.length).toBeGreaterThan(0);if(mime===DOCX_MIME)expect(output.result.findings[0].sources.every(s=>s.page===null)).toBe(true);
  console.log(filename+': one draft finding extracted with source references. No live workspace writes.');
 }
},180000);

it.skipIf(process.env.RUN_AI_LIVE_SMOKE!=='1')('extracts evidence facts from a synthetic PDF without a readiness decision',async()=>{
 liveConfig();const pdf=new jsPDF();pdf.text(['Synthetic evidence record','Expected population: 126 accounts.','Reviewed population: 121 accounts.','Two exceptions remain unresolved.'],15,20);
 const output=await extractWithOpenAI(new Uint8Array(pdf.output('arraybuffer')),{filename:'synthetic-evidence.pdf',mime:'application/pdf',mode:'evidence',model:process.env.OPENAI_EXTRACTION_MODEL||'gpt-4.1-mini'} as AnalysisRun);
 expect(output.result.findings).toHaveLength(0);expect(output.result.facts.some(f=>f.value.includes('121'))).toBe(true);expect(output.result.facts.every(f=>f.quote&&f.locator)).toBe(true);
 expect(output.result).not.toHaveProperty('recommendation');console.log('Synthetic evidence facts extracted with references; no readiness decision and no live workspace writes.');
},120000);
