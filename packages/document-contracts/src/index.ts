import {normaliseDate} from './dates';
export {normaliseDate} from './dates';
import { z } from 'zod';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const DOCUMENT_LIMIT = 25 * 1024 * 1024;
export const EXTRACTION_VERSION = '1.0-openai-native';
export const findingKeys = ['title','description','control_reference','severity','owner','account_reference','affected_systems','resources','approved_baseline','root_cause','corrective_action','recurrence_prevention','implementation_date','deadline'] as const;
export const sourceSchema = z.object({ quote: z.string().min(1).max(1500), locator: z.string().min(1).max(300), page: z.number().int().positive().nullable() });
export const fieldsSchema = z.object(Object.fromEntries(findingKeys.map(key => [key, z.string().max(key === 'description' ? 10000 : 5000).nullable()])) as Record<typeof findingKeys[number], z.ZodNullable<z.ZodString>>);
export const extractionSchema = z.object({
  coverage: z.enum(['readable_text','partial','unreadable']),
  limitations: z.array(z.string().max(500)).max(12),
  findings: z.array(z.object({ fields: fieldsSchema, sources: z.array(z.object({ field: z.enum(findingKeys), ...sourceSchema.shape })).max(30) })).max(20),
  facts: z.array(z.object({ label: z.string().min(1).max(150), value: z.string().min(1).max(2000), ...sourceSchema.shape })),
});
export type ExtractionResult = z.infer<typeof extractionSchema>;
export type DraftFinding = ExtractionResult['findings'][number];
export type SourceReference = z.infer<typeof sourceSchema>;
export const confirmationSchema = z.object({ fact_index: z.number().int().min(0), decision: z.enum(['confirmed','corrected','rejected']), value: z.string().max(2000), actor: z.string().trim().min(2).max(200), reason: z.string().trim().max(2000), source_checked: z.boolean() }).superRefine((c,ctx)=>{
  if(c.decision!=='rejected'&&(!c.source_checked||!c.value.trim()))ctx.addIssue({code:'custom',message:'Open the original source, check the reference and confirm its interpretation.'});
  if(c.decision!=='confirmed'&&c.reason.length<10)ctx.addIssue({code:'custom',message:'Explain the correction or rejection (at least 10 characters).'});
});
export type FactConfirmation = z.infer<typeof confirmationSchema> & { id: string; run_id: string; created_at: string };
export interface AnalysisRun { submission_reference?:string|null; id: string; mode:'report'|'evidence'; finding_id:string|null; finding_revision:number|null; evidence_id:string|null; evidence_version:number|null; filename:string; mime:string; byte_size:number; sha256:string|null; storage_path:string; status:'pending'|'processing'|'ready'|'failed'; attempt:number; model:string; result:ExtractionResult|null; error:string|null; created_at:string; confirmations?:FactConfirmation[]; submissions?:{draft_index:number;finding_id:string}[] }
export interface ConfirmedFactSnapshot { confirmation_id:string; run_id:string; evidence_id:string; evidence_version:number; evidence_sha256:string; filename:string; model:string; extraction_version:string; fact_index:number; label:string; proposed_value:string; value:string; quote:string; locator:string; page:number|null; decision:string; actor:string; reason:string; confirmed_at:string }
export interface ReportSource { run_id:string; draft_index:number; filename:string; sha256:string; confirmed_by:string; confirmed_at:string; sources:DraftFinding['sources'] }
export function documentMime(filename:string) { const ext=filename.split('.').pop()?.toLowerCase(); return ext==='pdf'?'application/pdf':ext==='docx'?DOCX_MIME:null; }
export function checkExtraction(value:unknown, mode:'report'|'evidence', mime:string):ExtractionResult {
  const result=extractionSchema.parse(value);
  if(mode==='report'&&result.facts.length||mode==='evidence'&&result.findings.length)throw Error('The document analysis returned the wrong output type.');
  if(result.coverage==='unreadable'&&(result.facts.length||result.findings.length))throw Error('Unreadable content cannot produce usable suggestions.');
  for(const draft of result.findings){
    for(const key of ['deadline','implementation_date'] as const)if(draft.fields[key])draft.fields[key]=normaliseDate(draft.fields[key]);
    for(const key of findingKeys){if(draft.fields[key]!==null&&!draft.sources.some(source=>source.field===key))throw Error(`Missing source reference for ${key}.`);}
    if(!draft.fields.title&&!draft.fields.description)throw Error('A draft finding needs at least a cited title or description.');
  }
  const sources=[...result.facts,...result.findings.flatMap(f=>f.sources)];
  if(mime===DOCX_MIME&&sources.some(source=>source.page!==null))throw Error('DOCX references must use sections or paragraphs, not page numbers.');
  return result;
}
