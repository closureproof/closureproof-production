import { z } from 'zod';
import type { Evaluation, RuleResult } from './contracts';

export const CHECKLIST_MAPPING_VERSION = '1.0-iso27001-aws-iam';
// Explicit source-task mappings. The finding's pinned scope determines which rows exist.
// These reference supplied checklist tasks; they are not certified control coverage.
export const awsIamChecklistMappings: Record<string, readonly string[]> = {
  'iso-INF-02': ['scope', 'coverage'], 'iso-INF-03': ['scope', 'coverage'],
  'iso-ACC-01': ['implemented', 'evidence'], 'iso-ACC-02': ['scope', 'coverage', 'implemented'],
  'iso-ACC-03': ['implemented', 'evidence'], 'iso-ACC-04': ['implemented', 'evidence'],
  'iso-ACC-05': ['implemented', 'coverage'], 'iso-ACC-08': ['implemented', 'evidence'],
  'iso-ACC-09': ['implemented', 'coverage'], 'iso-ACC-10': ['coverage', 'operation_required'],
  'iso-DOC-12': ['evidence', 'operation_required'], 'iso-POL-03': ['scope', 'evidence'],
  'iso-ODOC-04': ['coverage', 'evidence'], 'iso-POL-05': ['cause'],
  'iso-ODOC-33': ['cause', 'exceptions'], 'iso-PEO-08': ['implemented', 'coverage'],
};
export const checklistAnswerSchema = z.object({
  check_id: z.string().min(1), applicability: z.enum(['yes', 'no', 'under_review']).optional(),
  implementation_status: z.enum(['not_assessed', 'not_implemented', 'partially_implemented', 'implemented', 'not_applicable']).optional(),
  reason: z.string().max(5000), evidence_ids: z.array(z.string().min(1)).max(30), source_location: z.string().max(1000),
  result: z.enum(['pass', 'fail', 'unknown', 'not_applicable']), reason_source: z.string().optional(), previous_evidence_result: z.enum(['pass', 'fail', 'unknown', 'not_applicable']).optional(),
}).strict();
export type ChecklistAnswer = z.infer<typeof checklistAnswerSchema>;
export interface ChecklistDefinition { id: string; label: string }
export interface ChecklistMappingRow {
  checkId: string; label: string; requirementIds: readonly string[]; applicability: string;
  implementationStatus: string; rationale: string; sourceLocation: string; evidenceIds: string[];
  status: RuleResult['status']; reason: string;
}
export interface ChecklistMappingSnapshot { version: string; rows: ChecklistMappingRow[]; rules: RuleResult[] }
export function mapChecklist(definitions: ChecklistDefinition[], answers: ChecklistAnswer[], currentEvidenceIds: string[], mappings: Record<string, readonly string[]> = awsIamChecklistMappings, version = CHECKLIST_MAPPING_VERSION): ChecklistMappingSnapshot {
  const ids = new Set(definitions.map(row=>row.id));
  if (ids.size !== definitions.length || new Set(answers.map(row=>row.check_id)).size !== answers.length || answers.some(row=>!ids.has(row.check_id))) throw Error('Checklist items must match the pinned finding scope without duplicates.');
  const rows = definitions.map(definition => {
    const answer = answers.find(row=>row.check_id===definition.id);
    const requirementIds = mappings[definition.id] || [];
    const base = {checkId:definition.id,label:definition.label,requirementIds,applicability:answer?.applicability||'under_review',implementationStatus:answer?.implementation_status||'not_assessed',rationale:answer?.reason||'',sourceLocation:answer?.source_location||'',evidenceIds:answer?.evidence_ids||[]};
    const outcome = (status:RuleResult['status'],reason:string):ChecklistMappingRow => ({...base,status,reason});
    if (!requirementIds.length) return outcome('unknown','No explicit protocol mapping exists for this scoped item. Review the mapping before recommending closure readiness.');
    if (!answer || answer.reason.trim().length<10) return outcome('unknown','The checklist item needs an explicit assessment and rationale.');
    const expectedResult=answer.implementation_status==='implemented'?'pass':answer.implementation_status==='not_applicable'?'not_applicable':answer.implementation_status==='not_assessed'?'unknown':'fail';
    if(answer.implementation_status && answer.result!==expectedResult)return outcome('unknown','Checklist implementation status and stored observation disagree.');
    if (new Set(answer.evidence_ids).size!==answer.evidence_ids.length || answer.evidence_ids.some(id=>!currentEvidenceIds.includes(id))) return outcome('unknown','A linked evidence reference is unavailable, replaced or insufficient.');
    if (answer.applicability==='no' && answer.implementation_status==='not_applicable') return outcome('excluded','Reviewer explicitly excluded this item with a recorded rationale.');
    if (answer.applicability!=='yes' || !answer.implementation_status || ['not_assessed','not_applicable'].includes(answer.implementation_status)) return outcome('unknown','Applicability or implementation remains unestablished for this scoped requirement.');
    if (['not_implemented','partially_implemented'].includes(answer.implementation_status)) return outcome('unmet','Reviewer recorded a scoped requirement as not implemented or partially implemented.');
    if (!answer.evidence_ids.length || answer.source_location.trim().length<2) return outcome('unknown','Implemented is recorded, but linked current evidence and its source location are missing.');
    return outcome('met','The scoped checklist requirement is recorded as implemented with rationale and current evidence references. Closure-specific judgements remain separate.');
  });
  const rules:RuleResult[] = rows.map(row=>({id:'checklist:'+row.checkId,status:row.status,mandatory:true,reason:row.label+': '+row.reason,factIds:[],missingFacts:row.status==='unknown'?[row.checkId]:[],evidenceIds:row.evidenceIds}));
  if (!rows.length) rules.push({id:'checklist:scope',status:'unknown',mandatory:true,reason:'No checklist requirements are pinned to this finding.',factIds:[],missingFacts:['checklist_scope'],evidenceIds:[]});
  return {version,rows,rules};
}
export function applyChecklistMapping(evaluation: Evaluation, mapping: ChecklistMappingSnapshot): Evaluation {
  const rules=[...evaluation.rules,...mapping.rules];
  const unmet=mapping.rules.some(rule=>rule.status==='unmet');
  const unknown=mapping.rules.some(rule=>rule.status==='unknown');
  const implementationKnown=evaluation.rules.find(rule=>rule.id==='implemented')?.status==='met';
  if (!unmet && !unknown) return {...evaluation,rules};
  const alreadyBlocked=evaluation.recommendation==='not_closure_ready';
  const recommendation=alreadyBlocked||unmet?'not_closure_ready':implementationKnown?'implemented_evidence_incomplete':null;
  const decisionId=alreadyBlocked?evaluation.decisionId:unmet?'checklist-unmet':recommendation?'checklist-incomplete':null;
  return {...evaluation,rules,recommendation,decisionId,matchedDecisionIds:[...(unmet?['checklist-unmet']:['checklist-incomplete']),...evaluation.matchedDecisionIds],decisionReason:(unmet?'A scoped checklist requirement remains unimplemented or partially implemented. ': 'Scoped checklist assessments, mappings or evidence references are incomplete. ')+evaluation.decisionReason,missingFacts:[...new Set([...evaluation.missingFacts,...mapping.rules.flatMap(rule=>rule.missingFacts)])].sort()};
}

// Compatibility for older callers and saved AWS IAM tooling.
export const mapAwsIamChecklist=mapChecklist;
