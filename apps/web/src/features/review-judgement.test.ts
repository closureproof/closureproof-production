import { describe,it,expect } from 'vitest';
import { simplifiedJudgementSections, judgementSections, judgementFields, upgradeJudgement, completedJudgement, progressiveJudgementSections, validateJudgement, SIMPLIFIED_JUDGEMENT_VERSION, JUDGEMENT_VERSION } from './review-judgement';
const retest=simplifiedJudgementSections.find(s=>s.id==='retest')!;
describe('simplified reviewer judgement',()=>{
 it('retains legacy field definitions while removing duplicated inputs from the new form',()=>{
  const newKeys=simplifiedJudgementSections.flatMap(s=>s.fields.map(f=>f.key));
  for(const key of ['recurrence_assessment','exception_register','retest_evidence_result'])expect(newKeys).not.toContain(key);
  expect(judgementSections.flatMap(s=>s.fields.map(f=>f.key))).toContain('exception_register');
 });
 it('keeps previous action and recurrence notes when preparing a revised assessment',()=>{
  const old={version:'1.0-manual',action_cause_assessment:'Immediate action reviewed.',recurrence_assessment:'Ownership prevents recurrence.'};
  const upgraded=upgradeJudgement(old);
  expect(upgraded.action_cause_assessment).toContain(old.action_cause_assessment);
  expect(upgraded.action_cause_assessment).toContain(old.recurrence_assessment);
  expect(old.version).toBe('1.0-manual');
 });
 it('asks for a retest result and independence only for a completed retest',()=>{
  const keys=(status:string)=>judgementFields(retest,{version:SIMPLIFIED_JUDGEMENT_VERSION,retest_status:status}).map(f=>f.key);
  expect(keys('Planned')).toEqual(['retest_status','retest_scope_method','retest_pending_actions']);
  expect(keys('Completed')).toEqual(['retest_status','retester','retest_date','retest_scope_method','retest_result','retest_independence']);
  expect(keys('Not applicable — justification required')).toEqual(['retest_status','retest_not_applicable_reason']);
 });
 it('asks for sampling limitations only for a sample, and closure impact only for individual exceptions',()=>{
  const population=simplifiedJudgementSections.find(s=>s.id==='population')!;const exceptions=simplifiedJudgementSections.find(s=>s.id==='exceptions')!;
  expect(judgementFields(population,{version:SIMPLIFIED_JUDGEMENT_VERSION,coverage_approach:'Sample'}).map(f=>f.key)).toContain('sampling_basis');
  expect(judgementFields(population,{version:SIMPLIFIED_JUDGEMENT_VERSION,coverage_approach:'Full population'}).map(f=>f.key)).not.toContain('sampling_basis');
  expect(judgementFields(exceptions,{version:SIMPLIFIED_JUDGEMENT_VERSION},0)).toHaveLength(0);
  expect(judgementFields(exceptions,{version:SIMPLIFIED_JUDGEMENT_VERSION},1)).toHaveLength(1);
 });
 it('does not retain stale completed-test fields when the reviewer changes the retest decision',()=>{
  const result=completedJudgement({version:JUDGEMENT_VERSION,retest_requirement:'Not required',retest_requirement_reason:'A test is not required for this documentary finding.',retest_status:'Not applicable — justification required',retest_not_applicable_reason:'Documentary finding; technical testing is not relevant.',retester:'Old tester',retest_result:'Old result',retest_evidence_id:'old-id'},[progressiveJudgementSections.find(s=>s.id==='retest')!],0);
  expect(result).not.toHaveProperty('retester');expect(result).not.toHaveProperty('retest_result');expect(result).not.toHaveProperty('retest_evidence_id');
 });
});

it('progressively reveals details and preserves unknown decisions rather than silently waiving a review',()=>{
 const retest=progressiveJudgementSections.find(s=>s.id==='retest')!;
 expect(judgementFields(retest,{version:JUDGEMENT_VERSION}).map(f=>f.key)).toEqual(['retest_requirement']);
 expect(judgementFields(retest,{version:JUDGEMENT_VERSION,retest_requirement:'Not required'}).map(f=>f.key)).toEqual(['retest_requirement','retest_requirement_reason']);
 expect(judgementFields(retest,{version:JUDGEMENT_VERSION,retest_requirement:'Not yet established'}).map(f=>f.key)).toEqual(['retest_requirement','retest_requirement_reason']);
 expect(validateJudgement({version:JUDGEMENT_VERSION,retest_requirement:'Not yet established'},[retest],0)?.message).toContain('Reason for the retest decision');
 const selected={version:JUDGEMENT_VERSION,retest_requirement:'Not yet established',retest_requirement_reason:'The testing scope must be confirmed with the audit team.'};
 expect(validateJudgement(selected,[retest],0)).toBeNull();
 expect(completedJudgement(selected,[retest],0).retest_requirement).toBe('Not yet established');
});
it('does not require invented gap, cause or exception narratives for explicit satisfactory decisions',()=>{
 const j={version:JUDGEMENT_VERSION,scope_status:'Sufficient for this finding',cause_status:'Supported',exceptions_status:'None identified'};
 const sections=progressiveJudgementSections.filter(s=>['scope','cause','exceptions'].includes(s.id));
 expect(validateJudgement(j,sections,0)).toBeNull();
 expect(completedJudgement(j,sections,0)).not.toHaveProperty('evidence_gaps');
});
