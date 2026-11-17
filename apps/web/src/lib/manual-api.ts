import type { AppliedReviewProposal, ReviewProposalSnapshot } from './ai-review-contract';
import type { ReviewSources } from '../features/review-reuse';
import type { EngineDraft } from '@closureproof/assessment-engine/review-contracts';
import type { EngineRequest, RulesSnapshot } from './rules-assessment';
import { DOCX_MIME, type ConfirmedFactSnapshot, type ReportSource } from '@closureproof/document-contracts';
import type { AuditEvent, Readiness } from './types';
import { getSupabase, serviceError } from './supabase';
import type { SoaCheck } from '../features/soa-assessment';
import type { ReviewScope, ScopeRequest } from '../features/control-scope';
import type { ClosureJudgement } from '../features/review-judgement';
import { isoProtocolTemplates, presentProtocol, ISO_PROTOCOL_VERSION, type ISOChecklistTask } from '../features/iso27001';
export interface ManualProtocol { review_scope?: ReviewScope; code: string; title: string; category: string; version: string; status: string; checks: { id: string; label: string; guidance: string; mandatory: boolean; evaluationKind: string; mapped_controls?: string[]; sourceTask?: ISOChecklistTask }[] }
export interface FindingInput { finding_reference?:string; submission_reference?:string; source_report?: ReportSource; scope_request?: ScopeRequest; title: string; description: string; owner: string; severity: string; protocol_code: string; account_reference: string; affected_systems: string; resources: string; approved_baseline: string; root_cause: string; recurrence_prevention: string; corrective_action: string; implementation_date: string | null; deadline: string | null; control_reference: string; revision?: number }
export interface EvidenceMetadata { revision: number; evidence_type: string; source_system: string; source_account: string; covered_resources: string; captured_at: string | null; period_start: string | null; period_end: string | null; description: string; submitted_by: string; supersedes_id: string | null }
export interface ManualEvidence { reference?:string; id: string; findingId: string; uploadedBy: string; version: number; supersedesId: string | null; filename: string; mime: string; size: number; sha256: string; createdAt: string; metadata: Omit<EvidenceMetadata, 'revision' | 'supersedes_id'>; disposition: string; review: { reviewer?: string; rationale?: string; history?: unknown[] }; scanStatus: string }
export interface ManualCheck extends SoaCheck { reason_source?: string; check_id: string; reason: string; evidence_ids: string[]; source_location: string }
export interface ExceptionEntry { acceptance_authority?: string; acceptance_date?: string; acceptance_reference?: string; compensating_controls?: string; reference: string; description: string; owner: string; disposition: 'open' | 'resolved' | 'accepted' | 'mitigated'; evidence_reference: string; closure_impact: string }
export interface ReviewInput { ai_review_proposal?:AppliedReviewProposal; ai_review_source_keys?:string[]; ai_review_proposal_snapshot?:ReviewProposalSnapshot; review_shared_sources?: ReviewSources; streamlined_review?: boolean; engine_draft?: EngineDraft; engine_request?: EngineRequest; rules_assessment?: RulesSnapshot; ai_confirmation_ids?: string[]; ai_confirmed_facts?: ConfirmedFactSnapshot[]; review_step?: number; unassessed_checks_reason?: string; scope_confirmed?: boolean; scope_confirmation_notes?: string; reviewer_conclusion?: string; exception_entries?: ExceptionEntry[]; exceptions_assessed?: boolean; supersedes_assessment_id?: string | null; closure_judgement?: ClosureJudgement; revision: number; reviewer: string; independent: boolean; independence_notes: string; checks: ManualCheck[]; population_expected: number | null; population_reviewed: number | null; population_notes: string; exceptions: string; operating_period_notes: string; retest_notes: string; clarification_request: string; recommendation: Readiness | null; recommendation_reason: string; next_status: string; publish: boolean }
export interface ManualReview extends Omit<ReviewInput, 'revision' | 'publish'> { cycleNumber: number; assessmentRevision: number; supersedesId: string | null; id: string; findingId: string; findingRevision: number; createdAt: string; status: string; stale: boolean; authorship: string; evidence_snapshot: ManualEvidence[]; protocol_snapshot: ManualProtocol; finding_snapshot: FindingInput }
export interface LegacyEvidence { id: string; filename: string; storage_path?: string; object_path?: string; sha256: string | null; evidence_version?: number; version?: number; created_at: string }
export interface LegacyReview { id: string; decision?: string; comment?: string; reviewer_id?: string; created_at: string }
export interface ManualFinding extends FindingInput { findingReference?:string; submissionReference?:string; cycleNumber: number; id: string; organisationId: string; createdBy: string; updatedBy: string; revision: number; createdAt: string; lifecycle: string; protocol: ManualProtocol; readiness: Readiness | null; evidenceCount: number; hasStaleReview: boolean; currentReview: ManualReview | null; evidence?: ManualEvidence[]; reviews?: ManualReview[]; legacyEvidence?: LegacyEvidence[]; legacyReviews?: LegacyReview[]; legacy_source?: Record<string, unknown> }
export interface TimelineEvent { id: string; revision: number; title: string; detail: string; timestamp: string }

type Row = Record<string, any>;
const displayReviewText = (value: string) => value?.replace(/\bHuman review\b/g, 'Review').replace(/\bhuman review\b/g, 'review').replace(/\bHuman inspection\b/g, 'Review').replace(/\bhuman inspection\b/g, 'review');
const displayActor = (name: string) => name === 'Pilot participant' ? 'Workspace participant' : name;
async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, body);
  if (error) {
    if (['cpp_create_scoped_finding','cpp_amend_review_scope'].includes(name) && error.code === 'PGRST202') throw new Error('Install 20261109000200_control_review_scopes.sql in the Supabase SQL Editor, then retry.');
    if (name === 'cpp_apply_iso27001_checklist' && error.code === 'PGRST202') throw new Error('Install 20261106000300_iso27001_checklists.sql in the Supabase SQL Editor, then retry.');
    throw serviceError(error);
  }
  return data as T;
}
function evidenceFromRow(e: Row): ManualEvidence {
  return { id: e.id, reference:e.evidence_reference, findingId: e.finding_id, uploadedBy: e.uploaded_by, version: e.version, supersedesId: e.supersedes_id, filename: e.filename,
    mime: e.mime, size: Number(e.byte_size), sha256: e.sha256, createdAt: e.created_at, metadata: { ...e.metadata, submitted_by: displayActor(e.metadata.submitted_by) },
    disposition: e.disposition, review: e.judgement || {}, scanStatus: 'Unscanned upload — manual inspection required' };
}
export function reviewFromRow(r: Row, f: Row): ManualReview {
  return { ...r.data, protocol_snapshot: presentProtocol(r.data.protocol_snapshot), cycleNumber: r.cycle_number || 1, assessmentRevision: r.assessment_revision || 1, supersedesId: r.supersedes_id || null, id: r.id, findingId: r.finding_id, findingRevision: r.finding_revision, createdAt: r.created_at,
    authorship: r.data.authorship?.startsWith('Human review recorded in the public pilot.') ? 'Review recorded with the reviewer’s stated name and recommendation.' : displayReviewText(r.data.authorship), reviewer: displayActor(r.reviewer_name), status: r.status, stale: r.finding_revision !== f.revision,
    evidence_snapshot: (r.data.evidence_snapshot || []).map(evidenceFromRow) };
}
function findingFromRow(f: Row, evidence: Row[], reviews: Row[], legacy: Row[] = []): ManualFinding {
  const applicable = reviews.filter(r => r.finding_id === f.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const files = evidence.filter(e => e.finding_id === f.id && e.upload_state === 'ready');
  const current = applicable.find(r => r.finding_revision === f.revision && ['published', 'completed'].includes(r.status));
  return { ...f.details, findingReference:f.finding_reference||f.details.finding_reference, submissionReference:f.submission_reference||f.details.submission_reference, cycleNumber: f.cycle_number || 1, id: f.id, organisationId: f.organisation_id, createdBy: f.created_by, updatedBy: f.updated_by,
    revision: f.revision, createdAt: f.created_at, lifecycle: f.lifecycle, protocol: presentProtocol(f.protocol),
    readiness: current?.data.recommendation || null, evidenceCount: files.length,
    hasStaleReview: applicable.some(r => r.finding_revision !== f.revision), currentReview: current ? reviewFromRow(current, f) : null,
    evidence: files.map(evidenceFromRow), reviews: applicable.map(r => reviewFromRow(r, f)),
    legacyEvidence: legacy.filter(r => r.finding_id === f.id && r.kind === 'evidence').map(r => r.source_record),
    legacyReviews: legacy.filter(r => r.finding_id === f.id && r.kind === 'review').map(r => r.source_record) } as ManualFinding;
}
async function rows(table: string, organisationId?: string): Promise<Row[]> {
  let query = getSupabase().from(table).select('*');
  if (organisationId) query = query.eq('organisation_id', organisationId);
  const { data, error } = await query;
  if (error) throw serviceError(error);
  return data || [];
}
const eventFromRow = (e: Row): AuditEvent => ({ id: e.id, findingId: e.finding_id || '', title: displayReviewText(e.title), detail: e.detail, timestamp: e.created_at, actor: displayActor(e.actor_name), revision: e.revision });
const mimeTypes: Record<string, string> = { docx: DOCX_MIME, pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', csv: 'text/csv', json: 'application/json', txt: 'text/plain' };
export async function validateDemoFile(file: File) {
  const mime = mimeTypes[file.name.split('.').pop()?.toLowerCase() || ''];
  if (!mime) throw new Error('Choose PDF, DOCX, PNG, JPG, CSV, JSON or TXT. Video and executable files are disabled.');
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error('Choose a non-empty file up to 25 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (mime === DOCX_MIME && (bytes[0] !== 80 || bytes[1] !== 75 || bytes[2] !== 3 || bytes[3] !== 4)) throw new Error('The file is not a DOCX package.');
  if (mime === 'application/pdf' && new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('The file is not a PDF.');
  if (mime === 'image/png' && [137, 80, 78, 71, 13, 10, 26, 10].some((n, i) => bytes[i] !== n)) throw new Error('The file is not a PNG image.');
  if (mime === 'image/jpeg' && (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)) throw new Error('The file is not a JPEG image.');
  if (['application/json', 'text/plain', 'text/csv'].includes(mime)) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error('This file contains binary content rather than readable text.');
    if (mime === 'application/json') { try { JSON.parse(text); } catch { throw new Error('The JSON file is invalid.'); } }
  }
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digest = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
  return { mime, bytes, digest };
}
async function finding(id: string): Promise<ManualFinding> {
  const client = getSupabase();
  const { data: f, error } = await client.from('cpp_findings').select('*').eq('id', id).single();
  if (error) throw serviceError(error);
  const [files, reviews, legacy] = await Promise.all([
    client.from('cpp_evidence').select('*').eq('finding_id', id).eq('upload_state', 'ready').order('created_at'),
    client.from('cpp_reviews').select('*').eq('finding_id', id).order('created_at', { ascending: false }),
    client.from('cpp_legacy_records').select('*').eq('finding_id', id),
  ]);
  if (files.error) throw serviceError(files.error); if (reviews.error) throw serviceError(reviews.error); if (legacy.error) throw serviceError(legacy.error);
  return findingFromRow(f, files.data || [], reviews.data || [], legacy.data || []);
}
async function readFile(findingId: string, evidenceId: string, action: 'inspect' | 'download') {
  const { data: file, error } = await getSupabase().from('cpp_evidence').select('*').eq('id', evidenceId).eq('finding_id', findingId).single();
  if (error) throw serviceError(error);
  const access = await rpc<{ path: string; filename: string; mime: string; sha256: string }>('cpp_record_file_access', { p_id: file.id, p_action: action });
  const { data: blob, error: storageError } = await getSupabase().storage.from('closureproof-pilot-evidence').download(access.path);
  if (storageError) throw storageError;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== access.sha256) throw new Error('This file does not match its recorded uploader hash. Download/inspection stopped.');
  return { blob, ...access };
}
export const manualApi = {
  workspace: async (org: string) => {
    const [findings, evidence, reviews, events, legacy] = await Promise.all(['cpp_findings', 'cpp_evidence', 'cpp_reviews', 'cpp_events', 'cpp_legacy_records'].map(t => rows(t, org)));
    return { findings: findings.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(f => findingFromRow(f, evidence, reviews, legacy)), events: events.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(eventFromRow) };
  },
  protocols: async (): Promise<ManualProtocol[]> => isoProtocolTemplates as ManualProtocol[],
  finding,
  create: async (body: FindingInput, org: string, onCreated?: (id:string)=>void) => {
    const { data, error } = await getSupabase().from('cpp_protocols').select('version').eq('code', body.protocol_code).eq('version', ISO_PROTOCOL_VERSION);
    if (error) throw serviceError(error);
    if (!data?.length) throw new Error('Install the ISO 27001 checklist migration (20261106000300_iso27001_checklists.sql) in Supabase before creating a finding.');
    const id=body.scope_request ? await rpc<string>('cpp_create_scoped_finding', { p_org: org, p_details: body, p_scope: body.scope_request }) : await rpc<string>('cpp_create_finding', { p_org: org, p_details: body });
    onCreated?.(id);return finding(id);
  },
  amendScope: async (id: string, revision: number, scope: ScopeRequest, actor: string, reason: string) => { await rpc('cpp_amend_review_scope', { p_id: id, p_revision: revision, p_scope: scope, p_actor: actor, p_reason: reason }); return finding(id); },
  applyChecklist: async (id: string, revision: number, taskIds: string[]) => { await rpc('cpp_apply_iso27001_checklist', { p_id: id, p_revision: revision, p_task_ids: taskIds }); return finding(id); },
  update: async (id: string, body: FindingInput) => { await rpc('cpp_update_finding', { p_id: id, p_revision: body.revision, p_details: body }); return finding(id); },
  upload: async (id: string, file: File, metadata: EvidenceMetadata): Promise<ManualEvidence> => {
    const { mime, bytes, digest } = await validateDemoFile(file);
    const upload = await rpc<{ id: string; path: string }>('cpp_begin_upload', { p_finding: id, p_revision: metadata.revision, p_file: { filename: file.name, mime, size: file.size, sha256: digest }, p_metadata: metadata });
    try {
      const { error } = await getSupabase().storage.from('closureproof-pilot-evidence').upload(upload.path, bytes, { contentType: mime, upsert: false });
      if (error) throw error;
      const completed = await fetch('/api/evidence/complete', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:upload.id,revision:metadata.revision})});
      if (!completed.ok) {const body=await completed.json().catch(()=>null);throw new Error(body?.error||'Evidence validation could not be completed. Please try again.');}
    } catch (error) {
      try { const cleanup = await getSupabase().storage.from('closureproof-pilot-evidence').remove([upload.path]); if (!cleanup.error) await rpc('cpp_cancel_upload', { p_id: upload.id }); } catch { /* Pending private records remain unavailable; no successful upload is claimed. */ }
      throw error;
    }
    const result = await finding(id); return result.evidence!.find(e => e.id === upload.id)!;
  },
  reviewEvidence: async (id: string, evidence: string, body: { revision: number; disposition: string; rationale: string }) => {
    await rpc('cpp_review_evidence', { p_id: evidence, p_revision: body.revision, p_disposition: body.disposition, p_rationale: body.rationale });
    return (await finding(id)).evidence!.find(e => e.id === evidence)!;
  },
  saveReview: async (id: string, body: ReviewInput) => {
    const saved = await rpc<string>('cpp_save_review', { p_finding: id, p_revision: body.revision, p_review: body });
    return (await finding(id)).reviews!.find(r => r.id === saved)!;
  },
  inspectText: async (id: string, evidence: string) => {
    const file = await readFile(id, evidence, 'inspect');
    if (file.mime === 'application/pdf' || file.mime === DOCX_MIME) return { text: '', notice: 'Download the original document for inspection. Active document content is not embedded.' };
    const text = await file.blob.text(); return { text: text.slice(0, 100000), truncated: text.length > 100000, notice: 'Inert text preview of submitted material. No live system verification performed.' };
  },
  inspectImage: async (id: string, evidence: string) => {
    const file = await readFile(id, evidence, 'inspect');
    if (!['image/png', 'image/jpeg'].includes(file.mime)) throw new Error('This file is not an image.');
    const head = new Uint8Array(await file.blob.slice(0, 12).arrayBuffer());
    if (file.mime === 'image/png' && [137,80,78,71,13,10,26,10].some((n,i) => head[i] !== n)) throw new Error('Invalid PNG content.');
    if (file.mime === 'image/jpeg' && (head[0] !== 255 || head[1] !== 216 || head[2] !== 255)) throw new Error('Invalid JPEG content.');
    const bitmap = await createImageBitmap(file.blob);
    try {
      if (bitmap.width * bitmap.height > 20000000) throw new Error('Image exceeds 20 megapixels.');
      const canvas = document.createElement('canvas'); const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image preview failed.')), 'image/png'));
      return URL.createObjectURL(blob);
    } finally { bitmap.close(); }
  },
  download: async (id: string, evidence: string) => {
    const file = await readFile(id, evidence, 'download'); const url = URL.createObjectURL(new Blob([file.blob], { type: 'application/octet-stream' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  evidenceFile: readFile,
  timeline: async (id: string): Promise<TimelineEvent[]> => {
    const { data, error } = await getSupabase().from('cpp_events').select('*').eq('finding_id', id).order('created_at', { ascending: false });
    if (error) throw serviceError(error); return (data || []).map(e => ({ id: e.id, revision: e.revision, title: displayReviewText(e.title), detail: e.detail, timestamp: e.created_at }));
  },
};
