import { expect, it } from 'vitest';
import { newProtocolDraft } from '@closureproof/assessment-engine/protocol-catalogue';
import { combinedReviewConclusion, restoreEditableEngineDraft, reuseReviewInputs, type ReviewSources } from './review-reuse';
const sources:ReviewSources={enabled:true,basis:'Reviewer inspected the approved source records.',locator:'Section 1',evidenceIds:['current','replaced']};
const modules=['scope','cause','exceptions','population','operation','retest'];
it('reuses explicit decisions and exact timing values, with current source references',()=>{
 const j={scope_status:'Sufficient for this finding',cause_status:'Supported',exceptions_status:'None identified',operation_requirement:'Required',operating_from:'2026-10-01',operating_to:'2026-11-01',expected_cycles:'3',observed_cycles:'2',retest_requirement:'Not required',retest_requirement_reason:'The correction is supported without a live retest.'};
 const {draft,reused}=reuseReviewInputs(newProtocolDraft('backup'),j,sources,modules,['current']);
 expect(draft.entries.scope).toMatchObject({value:'true',basis:sources.basis,locator:'Section 1',evidenceIds:['current']});
 expect(draft.entries.operation_start.value).toBe('2026-10-01');expect(draft.entries.required_cycles.value).toBe('3');expect(draft.entries.observed_cycles.value).toBe('2');
 expect(draft.entries.retest_required).toMatchObject({value:'false',basis:j.retest_requirement_reason});expect(reused.scope).toBeTruthy();
 expect(draft.entries.implemented).toBeUndefined();expect(draft.entries.coverage).toBeUndefined();
});
it('does not turn gaps, unknown facts or completed tests into successful engine judgements',()=>{
 const draft=newProtocolDraft('access');draft.entries.scope={value:'true',basis:'An older source-supported answer.',locator:'Old section',evidenceIds:['current']};
 const result=reuseReviewInputs(draft,{scope_status:'Gaps identified',cause_status:'Not yet established',exceptions_status:'Not yet established',retest_requirement:'Required',retest_status:'Completed'},sources,modules,['current']);
 expect(result.draft.entries.scope.value).toBe('');expect(result.draft.entries.evidence.value).toBe('');expect(result.draft.entries.cause.value).toBe('');expect(result.draft.entries.exceptions).toBeUndefined();expect(result.draft.entries.retest).toBeUndefined();
});
it('shares a pending retest without treating it as failed or satisfactory',()=>{
 const {draft}=reuseReviewInputs(newProtocolDraft('access'),{retest_requirement:'Required',retest_status:'Planned',retest_pending_actions:'Arrange independent inspection of the corrected access.'},sources,modules,['current']);
 expect(draft.entries.retest.value).toBe('pending');
});
it('does not supply waived decisions for modules excluded from the pinned scope',()=>{
 const {draft}=reuseReviewInputs(newProtocolDraft('access'),{},sources,['scope','cause','exceptions'],['current']);
 expect(draft.entries.operation_required).toBeUndefined();expect(draft.entries.retest_required).toBeUndefined();
});
it('restores source-backed drafts without retaining stale generated answers',()=>{
 const draft=newProtocolDraft('access');draft.entries.scope={value:'true',basis:sources.basis,locator:'Section 1',evidenceIds:['current']};draft.entries.implemented={...draft.entries.scope};
 const restored=restoreEditableEngineDraft(draft,{...sources,fieldIds:['scope']});expect(restored.entries.scope).toBeUndefined();expect(restored.entries.implemented.value).toBe('true');expect(draft.entries.scope.value).toBe('true');
 const recalculated=reuseReviewInputs(restored,{scope_status:'Not yet established'},sources,modules,['current']);expect(recalculated.draft.entries.scope.value).toBe('');
});
it('keeps manual sources unchanged when sharing is disabled',()=>{
 const draft=newProtocolDraft('mfa');expect(reuseReviewInputs(draft,{}, {...sources,enabled:false},modules,[]).draft).toBe(draft);
});
it('combines distinct earlier narrative answers without discarding them or repeating identical text',()=>{
 expect(combinedReviewConclusion('Evidence establishes the correction.','Evidence establishes the correction.','A limitation remains.')).toBe('Evidence establishes the correction.\n\nA limitation remains.');
});

it('shares sources for additional explicit answers and retains a field-specific source override',()=>{
 const draft=newProtocolDraft('backup');draft.entries.restore_integrity={value:'true',basis:'',locator:'',evidenceIds:[]};draft.entries.recovery_objectives={value:'false',basis:'The observed recovery time exceeded the approved objective.',locator:'Test 2',evidenceIds:['current']};
 const result=reuseReviewInputs(draft,{},sources,modules,['current']);
 expect(result.inheritedSources).toContain('restore_integrity');expect(result.draft.entries.restore_integrity).toMatchObject({value:'true',basis:sources.basis,evidenceIds:['current']});
 expect(result.inheritedSources).not.toContain('recovery_objectives');expect(result.draft.entries.recovery_objectives).toEqual(draft.entries.recovery_objectives);
 const restored=restoreEditableEngineDraft(result.draft,{...sources,fieldIds:Object.keys(result.reused),sourceFieldIds:result.inheritedSources});expect(restored.entries.restore_integrity).toMatchObject({value:'true',basis:'',evidenceIds:[]});
});

it('uses a scope exclusion only after the reviewer explicitly confirms that scope',()=>{
 const scope={confirmed:true,exclusions:{retest:'Retest is outside the expressly confirmed scope of this assessment.'}};
 const result=reuseReviewInputs(newProtocolDraft('access'),{},sources,['scope','cause','exceptions'],['current'],scope);
 expect(result.draft.entries.retest_required).toMatchObject({value:'false',basis:scope.exclusions.retest});
 const unconfirmed=reuseReviewInputs(newProtocolDraft('access'),{},sources,['scope','cause','exceptions'],['current'],{...scope,confirmed:false});expect(unconfirmed.draft.entries.retest_required).toBeUndefined();
});
