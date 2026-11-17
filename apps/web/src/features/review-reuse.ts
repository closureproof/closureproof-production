import type { EngineDraft } from '@closureproof/assessment-engine/review-contracts';
import type { ClosureJudgement } from './review-judgement';

export interface ReviewSources {
  enabled: boolean;
  basis: string;
  locator: string;
  evidenceIds: string[];
  fieldIds?: string[];
  sourceFieldIds?: string[];
}
export const emptyReviewSources = (): ReviewSources => ({ enabled: false, basis: '', locator: '', evidenceIds: [] });

// Reuse explicit reviewer answers only. No interpretation of AI text, checklist
// statuses, population counts or a completed retest as proof of effectiveness.
export function reuseReviewInputs(draft: EngineDraft, judgement: ClosureJudgement, sources: ReviewSources, modules: string[], currentEvidenceIds: string[], scope?: {confirmed:boolean;exclusions:Record<string,string>}) {
  const entries = { ...draft.entries };
  const reused: Record<string, string> = {};
  const inheritedSources: string[] = [];
  if (!sources.enabled) return { draft, reused, inheritedSources };
  const evidenceIds = sources.evidenceIds.filter(id => currentEvidenceIds.includes(id));
  function reuse(id: string, value: string, from: string, basis = sources.basis) {
    entries[id] = { value, basis, locator: sources.locator, evidenceIds };
    reused[id] = from;
  }
  reuse('scope', judgement.scope_status === 'Sufficient for this finding' ? 'true' : '', 'Scope and evidence assessment');
  reuse('evidence', judgement.scope_status === 'Sufficient for this finding' ? 'true' : '', 'Scope and evidence assessment');
  reuse('cause', judgement.cause_status === 'Supported' ? 'true' : '', 'Root cause and corrective-action assessment');
  if (judgement.exceptions_status === 'None identified') reuse('exceptions', 'true', 'No exceptions identified');
  for (const module of ['operation', 'retest']) {
    if (!modules.includes(module)) {
      const reason=scope?.exclusions[module];
      if(scope?.confirmed&&reason&&reason.trim().length>=10)reuse(module+'_required','false','Confirmed review scope exclusion',reason);
      continue;
    }
    const decision = judgement[(module + '_requirement') as keyof ClosureJudgement];
    const reason = judgement[(module + '_requirement_reason') as keyof ClosureJudgement];
    reuse(module + '_required', decision === 'Required' ? 'true' : decision === 'Not required' ? 'false' : '', module === 'operation' ? 'Operating-history decision' : 'Retest decision', decision === 'Not required' && typeof reason === 'string' ? reason : sources.basis);
  }
  if (modules.includes('operation')) {
    for (const [id, key] of [['operation_start', 'operating_from'], ['operation_end', 'operating_to'], ['required_cycles', 'expected_cycles'], ['observed_cycles', 'observed_cycles']] as const) {
      reuse(id, judgement.operation_requirement === 'Required' ? judgement[key] || '' : '', 'Operating-history review', judgement.operating_judgement || sources.basis);
    }
  }
  if (modules.includes('retest') && judgement.retest_requirement === 'Required' && ['Planned', 'Not performed'].includes(judgement.retest_status || '')) {
    reuse('retest', 'pending', 'Outstanding independent retest', judgement.retest_pending_actions || sources.basis);
  }
  for (const [id, entry] of Object.entries(entries)) {
    if (!reused[id] && entry.value && !entry.basis && !entry.locator && !entry.evidenceIds.length) {
      entries[id] = { ...entry, basis:sources.basis, locator:sources.locator, evidenceIds };
      inheritedSources.push(id);
    }
  }
  return { draft: { ...draft, entries }, reused, inheritedSources };
}

export function restoreEditableEngineDraft(draft: EngineDraft, sources?: ReviewSources): EngineDraft {
  if (!sources?.enabled) return draft;
  const entries = { ...draft.entries };
  for (const id of sources.fieldIds || []) delete entries[id];
  for (const id of sources.sourceFieldIds || []) if(entries[id])entries[id]={...entries[id],basis:'',locator:'',evidenceIds:[]};
  return { ...draft, entries };
}

export function combinedReviewConclusion(...values: (string | undefined)[]) {
  return [...new Set(values.map(value => value?.trim()).filter(Boolean))].join('\n\n');
}
