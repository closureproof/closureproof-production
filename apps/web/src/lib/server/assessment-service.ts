import {normaliseDate} from '@closureproof/document-contracts';
import { validateAppliedProposal } from './ai-review-preparation';
import {assessmentMethod,PROTOCOL_ENGINE_VERSION} from '@closureproof/assessment-engine/protocol-catalogue';
import { checklistAnswerSchema } from '@closureproof/assessment-engine/checklist-mapping';
import 'server-only';
import { z } from 'zod';
import { evaluateDraftProtocol, dateSchema, type AssessmentInput } from '@closureproof/assessment-engine';
import { contentHash } from '@closureproof/assessment-engine/publication';
import { engineDraftSchema, recommendationLabels } from '@closureproof/assessment-engine/aws-iam';
import { analysisAdmin, AnalysisError } from './document-analysis';
import type { ReviewInput } from '../manual-api';
import type { RulesSnapshot } from '../rules-assessment';
const uuid = z.string().uuid();
const evaluationRequest = z.object({ findingId: uuid, revision: z.number().int().positive(), reviewer: z.string().trim().min(2).max(200), draft: engineDraftSchema, checks: z.array(checklistAnswerSchema).max(200) }).strict();
const completionRequest = z.object({ findingId: uuid, revision: z.number().int().positive(), review: z.record(z.string(),z.unknown()), requestId: uuid, supersedes: uuid.nullable() }).strict();
async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await analysisAdmin().rpc(name,body);
  if(error) throw new AnalysisError(['42P01','PGRST202','42883'].includes(error.code) ? 'Install 20261111000400_all_protocol_engines.sql after the existing engine migrations in Supabase.' : error.message, error.code === '40001' ? 409 : 400);
  return data as T;
}
interface Context { finding: { id: string; revision: number; lifecycle: string; protocol: { code: string; checks: {id:string;label:string}[]; review_scope?: {modules:string[]} }; details: { deadline?: string } }; evidence: { id: string; version: number; sha256: string; supersedes_id: string | null; disposition: string }[] }
export async function evaluateAssessment(raw: unknown) {
  const request = evaluationRequest.parse(raw);
  if(await rpc<string>('cpp_protocol_engine_version',{})!==PROTOCOL_ENGINE_VERSION)throw new AnalysisError('Install 20261111000400_all_protocol_engines.sql in Supabase before rules-supported evaluation.');
  const basis = await rpc<Context>('cpp_engine_context',{ p_finding: request.findingId });
  if(basis.finding.revision !== request.revision) throw new AnalysisError('The finding changed. Reload before assessment.',409);
  const method=assessmentMethod(basis.finding.protocol.code);
  if(!method)throw new AnalysisError('This category has no rules-supported protocol.');
  if(request.draft.protocolCode && request.draft.protocolCode!==basis.finding.protocol.code)throw new AnalysisError('The saved facts belong to another finding category.');
  if(basis.finding.protocol.code!=='aws-iam' && (!request.draft.protocolCode || request.draft.version!==method.protocol.version))throw new AnalysisError('Start an assessment for the current finding category and protocol version.');
  const assessmentFields=method.fields;const protocol=method.protocol;
  if(['closed','awaiting_final_approval'].includes(basis.finding.lifecycle)) throw new AnalysisError('This finding is not open for assessment.');
  const allowed = new Set<string>(assessmentFields.map(field=>field.id));
  if(Object.keys(request.draft.entries).some(key=>!allowed.has(key))) throw new AnalysisError('Unknown protocol input.');
  const evidence = basis.evidence.filter(item => !basis.evidence.some(next=>next.supersedes_id === item.id) && !['rejected','insufficient'].includes(item.disposition));
  const date = new Date().toISOString().slice(0,10);
  const facts: AssessmentInput['facts'] = {};
  const entries = request.draft.entries;
  const savedDeadline=normaliseDate(basis.finding.details.deadline);
  const dateDecision=request.draft.dateDecisions?.deadline;
  const chosenDeadline=dateDecision?.value||savedDeadline;
  for(const [id,decision]of Object.entries(request.draft.dateDecisions||{})){
    if(!['deadline','operation_start','operation_end','retest_date'].includes(id))throw new AnalysisError('Unknown assessment date decision.');
    if(new Set(decision.candidates.map(candidate=>candidate.value)).size>1&&decision.reason.trim().length<10)throw new AnalysisError('Resolve the different dates in Review dates and explain the selection before evaluating.');
  }
  const findingContext=chosenDeadline?{id:request.findingId,revision:request.revision,deadline:chosenDeadline,sha256:contentHash({details:basis.finding.details,revision:request.revision,decision:dateDecision||null})}:undefined;
  for(const field of assessmentFields) {
    if(field.conditional && entries[field.conditional]?.value === 'false') continue;
    const entry = entries[field.id];
    if(field.id==='deadline'&&findingContext){
      if(dateDecision&&savedDeadline&&chosenDeadline!==savedDeadline&&dateDecision.reason.trim().length<10)throw new AnalysisError('Explain the selected finding deadline in Review dates before evaluating.');
      if(entry?.value&&normaliseDate(entry.value)!==chosenDeadline)throw new AnalysisError('Resolve the different finding deadlines in Review dates before evaluating.');
      facts.deadline={state:'confirmed',value:chosenDeadline!,confirmedBy:request.reviewer,confirmedOn:date,basis:dateDecision?.reason||'Current deadline recorded on the submitted finding.',sources:[{kind:'finding',evidenceId:request.findingId,version:request.revision,sha256:findingContext.sha256,locator:'Finding deadline'+(dateDecision?' - recorded reviewer date decision':'')}]};continue;
    }
    if(!entry || !entry.value || entry.value === 'unknown') { facts[field.id]={ state:'unknown',reason:entry?.basis?.trim() || 'Not established by the reviewer.' }; continue; }
    if(entry.basis.trim().length<10 || entry.locator.trim().length<2 || !entry.evidenceIds.length) throw new AnalysisError(`${field.label}: record a basis, source location and supporting evidence.`);
    if(new Set(entry.evidenceIds).size !== entry.evidenceIds.length || entry.evidenceIds.some(id=>!evidence.some(item=>item.id===id))) throw new AnalysisError(`${field.label}: an evidence reference is unavailable, replaced or insufficient.`,409);
    let value: string | boolean | number = entry.value;
    if(field.type==='boolean') { if(!['true','false'].includes(entry.value)) throw new AnalysisError('Select Yes, No or Not established.'); value=entry.value==='true'; }
    if(field.type==='integer') { if(!/^\d+$/.test(entry.value)||!Number.isSafeInteger(Number(entry.value))||Number(entry.value)>36500) throw new AnalysisError(`${field.label}: enter a whole number from 0 to 36500.`);value=Number(entry.value); }
    if(field.type==='retest' && !['pending','satisfactory','unsatisfactory'].includes(entry.value)) throw new AnalysisError('Select an explicit retest assessment.');
    if(field.type==='date' && !dateSchema.safeParse(entry.value).success) throw new AnalysisError('Enter a valid date.');
    if(field.id==='deadline' && basis.finding.details.deadline && entry.value!==basis.finding.details.deadline) throw new AnalysisError('The confirmed deadline must match the finding deadline. Revise the finding if it changed.');
    facts[field.id]={ state:'confirmed',value,confirmedBy:request.reviewer,confirmedOn:date,basis:entry.basis.trim(),sources:entry.evidenceIds.map(id=>{const item=evidence.find(item=>item.id===id)!;return {evidenceId:id,version:item.version,sha256:item.sha256,locator:entry.locator.trim()};}) };
  }
  const input: AssessmentInput={findingId:request.findingId,findingRevision:request.revision,scopeRevision:request.revision,evaluationDate:date,facts,...(findingContext?{findingContext}:{}),checklist:{definitions:basis.finding.protocol.checks.map(check=>({id:check.id,label:check.label})),answers:request.checks},evidence:evidence.map(item=>({id:item.id,version:item.version,sha256:item.sha256}))};
  const evaluation=evaluateDraftProtocol(protocol,input);
  const protocolHash=contentHash(protocol);
  const evaluationHash=contentHash({basis,input,protocolHash,evaluation});
  await rpc('cpp_register_engine_protocol',{p_definition:protocol,p_hash:protocolHash});
  return { basis, input, evaluation, protocolHash, evaluationHash };
}
export async function previewAssessment(raw: unknown) { const {basis:_,...result}=await evaluateAssessment(raw);return {...result,validationStatus:'candidate' as const}; }
export async function completeAssessment(raw: unknown) {
  const request=completionRequest.parse(raw);
  const review=request.review as unknown as ReviewInput;
  const requestHash=contentHash(request);
  const prior=await rpc<string|null>('cpp_engine_request_result',{p_request:request.requestId,p_hash:requestHash});
  if(prior)return {assessmentId:prior};
  if(!review.engine_request)throw new AnalysisError('Evaluate and accept or override the recommendation before completing.');
  const selection=z.object({draft:engineDraftSchema,evaluationHash:z.string().regex(/^[a-f0-9]{64}$/),disposition:z.enum(['accept','override']),overrideReason:z.string().max(2000),overrideEvidenceIds:z.array(uuid).max(30)}).strict().parse(review.engine_request);
  const {basis,...result}=await evaluateAssessment({findingId:request.findingId,revision:request.revision,reviewer:review.reviewer,draft:selection.draft,checks:review.checks});
  if(result.evaluationHash!==selection.evaluationHash) throw new AnalysisError('The assessment basis changed. Evaluate again before completing.',409);
  const computed=result.evaluation.recommendation;
  if(!computed)throw new AnalysisError('The engine needs more confirmed facts before it can recommend readiness. Complete the facts or use manual assessment.');
  if(selection.disposition!=='accept'&&selection.disposition!=='override')throw new AnalysisError('Accept or override the engine recommendation.');
  if(selection.disposition==='accept' && review.recommendation!==recommendationLabels[computed])throw new AnalysisError('The accepted recommendation must match the engine result.');
  if(selection.disposition==='override' && ((selection.overrideReason||'').trim().length<20 || !selection.overrideEvidenceIds?.length || selection.overrideEvidenceIds.some(id=>!result.input.evidence.some(item=>item.id===id))))throw new AnalysisError('Provide an override reason of at least 20 characters and current supporting evidence.');
  const j=review.closure_judgement;
  const retestDate=normaliseDate(j?.retest_date);const implementationDate=normaliseDate((basis.finding.details as Record<string,unknown>).implementation_date);
  if(retestDate&&implementationDate&&retestDate<implementationDate)throw new AnalysisError('The retest date is before implementation. Resolve the dates before completing.');
  for(const [id,key]of [['operation_start','operating_from'],['operation_end','operating_to'],['retest_date','retest_date']] as const){const selected=selection.draft.dateDecisions?.[id];if(selected&&normaliseDate(j?.[key])!==selected.value)throw new AnalysisError('The selected review date and judgement differ. Resolve Review dates before completing.');}
  for(const [factKey,module] of [['operation_required','operation'],['retest_required','retest']] as const) {
    const value=result.input.facts[factKey];
    const decision=j?.[`${module}_requirement`];
    const included=!basis.finding.protocol.review_scope || basis.finding.protocol.review_scope.modules.includes(module);
    if(value?.state==='confirmed' && ((value.value===true && (!included || decision!=='Required')) || (value.value===false && included && decision!=='Not required')))throw new AnalysisError(`The ${module} requirement disagrees with reviewer judgement. Update the entries and evaluate again.`);
  }
  if(j){
    for(const [key,condition,message] of [
      ['scope',j.scope_status==='Sufficient for this finding','scope assessment'],
      ['cause',j.cause_status==='Supported','root-cause assessment'],
      ['evidence',j.scope_status==='Sufficient for this finding','scope/evidence judgement'],
      ['exceptions',['None identified','Exceptions identified'].includes(j.exceptions_status||'') && !(review.exception_entries||[]).some(entry=>entry.disposition==='open'),'exception treatment'],
    ] as const){const fact=result.input.facts[key];if(fact?.state==='confirmed'&&fact.value===true&&!condition)throw new AnalysisError(`The confirmed ${key} fact disagrees with the ${message}. Review and evaluate again.`);}
    const retest=result.input.facts.retest;
    if(retest?.state==='confirmed'&&retest.value==='satisfactory'&&(j.retest_status!=='Completed'||!retest.sources.some(source=>source.evidenceId===j.retest_evidence_id)))throw new AnalysisError('A satisfactory retest must match the completed retest judgement and its evidence reference.');
    if(retest?.state==='confirmed'&&retest.value==='pending'&&j.retest_status==='Completed')throw new AnalysisError('The pending retest conflicts with the completed retest judgement.');
  }
  if(review.ai_review_proposal){if(review.ai_review_proposal.reviewer.trim()!==review.reviewer.trim())throw new AnalysisError('The reviewer name changed. Apply the prepared draft again with the current reviewer name.');review.ai_review_proposal_snapshot=await validateAppliedProposal(review.ai_review_proposal,request.findingId,request.revision);}else delete review.ai_review_proposal_snapshot;
  const protocol=assessmentMethod(basis.finding.protocol.code)!.protocol;
  const snapshot: RulesSnapshot={...result,protocol:{code:protocol.code,version:protocol.version},protocolDefinition:protocol,validationStatus:'candidate',disposition:selection.disposition,overrideReason:selection.overrideReason||'',overrideEvidenceIds:selection.overrideEvidenceIds||[],recordedRecommendation:review.recommendation!,reviewer:review.reviewer};
  const assessmentId=await rpc<string>('cpp_complete_engine_review',{p_finding:request.findingId,p_revision:request.revision,p_basis:basis,p_review:review,p_snapshot:snapshot,p_request:request.requestId,p_hash:requestHash,p_supersedes:request.supersedes});
  return {assessmentId};
}
