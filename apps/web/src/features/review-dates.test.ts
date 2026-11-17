import {expect,it} from 'vitest';
import {normaliseDate,checkExtraction} from '@closureproof/document-contracts';
import {reviewDates,populateReviewDates} from './review-dates';
import type {EngineDraft} from '@closureproof/assessment-engine/aws-iam';
const draft=(entries:EngineDraft['entries']={}):EngineDraft=>({version:'0.3.0-checklist-candidate',entries});
const entry=(value:string)=>({value,basis:'Cited document date',locator:'Recovery record, section 2',evidenceIds:['file']});
it.each([['30 November 2026','2026-11-30'],['18 Dec 2026','2026-12-18'],['November 30, 2026','2026-11-30'],['30/11/2026','2026-11-30'],['11/30/2026','2026-11-30'],['2028-02-29','2028-02-29'],['2026-02-29',null],['2026-11-31',null],['03/04/2026',null],['2026-11-30T23:00:00Z',null],['Not established',null]])('normalises %s without guessing ambiguous dates',(value,expected)=>{expect(normaliseDate(value)).toBe(expected);});
it('populates the current deadline without copying implementation into operating history',()=>{
 const result=populateReviewDates(draft(),{},'30 November 2026');expect(result.draft.entries.deadline.value).toBe('2026-11-30');expect(result.draft.entries.operation_start).toBeUndefined();
});
it('keeps differing dates unresolved until a reviewer records a choice and reason',()=>{
 const raw=draft({deadline:entry('2026-12-18')});const result=populateReviewDates(raw,{},'2026-11-30');
 expect(reviewDates(result.draft,{},'2026-11-30')[0]).toMatchObject({conflict:true,resolved:false});
 result.draft.dateDecisions!.deadline.reason='The submission owner confirmed the revised deadline.';
 const resolved=populateReviewDates(result.draft,{},'2026-11-30');expect(resolved.draft.entries.deadline.value).toBe('2026-11-30');expect(resolved.draft.dateDecisions!.deadline.candidates.map(item=>item.value)).toContain('2026-12-18');
});
it('shares one operating date between the judgement and engine',()=>{
 const result=populateReviewDates(draft({operation_start:entry('9 November 2026')}),{operation_requirement:'Required'});expect(result.judgement.operating_from).toBe('2026-11-09');expect(result.draft.entries.operation_start.value).toBe('2026-11-09');
});
it('normalises extracted report dates while preserving the original quotation and input',()=>{
 const fields={title:'Backup finding',description:null,control_reference:null,severity:null,owner:null,account_reference:null,affected_systems:null,resources:null,approved_baseline:null,root_cause:null,corrective_action:null,recurrence_prevention:null,implementation_date:null,deadline:'18 December 2026'};
 const raw={coverage:'readable_text',limitations:[],facts:[],findings:[{fields,sources:[{field:'title',quote:'Backup finding',locator:'Finding 1',page:1},{field:'deadline',quote:'Deadline 18 December 2026',locator:'Finding 1 deadline',page:1}]}]};
 const result=checkExtraction(raw,'report','application/pdf');expect(result.findings[0].fields.deadline).toBe('2026-12-18');expect(result.findings[0].sources[1].quote).toBe('Deadline 18 December 2026');expect(raw.findings[0].fields.deadline).toBe('18 December 2026');
});
