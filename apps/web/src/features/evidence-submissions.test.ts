import {expect,it} from 'vitest';
import {evidenceSubmissions,submissionClosureReady} from './evidence-submissions';
import type {ManualFinding} from '../lib/manual-api';
function finding(id:string,reportId?:string):ManualFinding{return {id,title:'Finding '+id,createdAt:'2026-11-01T10:00:00Z',evidenceCount:1,...(reportId?{source_report:{run_id:reportId,filename:'audit.pdf'}}:{})} as ManualFinding;}
it('groups findings by persisted report ID and keeps every evidence relationship',()=>{const a=finding('a','report-1');const b=finding('b','report-1');b.evidenceCount=2;const [group]=evidenceSubmissions([a,b]);expect(group.id).toBe('report-1');expect(group.name).toBe('audit.pdf');expect(group.evidenceCount).toBe(3);expect(group.findings.map(f=>f.id)).toEqual(['a','b']);});
it('keeps reports with identical filenames separate and manual submissions independent',()=>{const groups=evidenceSubmissions([finding('a','report-1'),finding('b','report-2'),finding('c'),finding('d')]);expect(groups).toHaveLength(4);expect(groups.find(g=>g.id==='c')).toMatchObject({name:'Finding c',report:false,key:'finding:c'});});
it('includes findings awaiting evidence and uses the earliest finding submission date',()=>{const a=finding('a','report-1');a.evidenceCount=0;const b=finding('b','report-1');b.createdAt='2026-10-01T10:00:00Z';const [group]=evidenceSubmissions([a,b]);expect(group.findings).toHaveLength(2);expect(group.evidenceCount).toBe(1);expect(group.firstSubmitted).toBe(b.createdAt);});
it('includes retained legacy evidence in the submission file count',()=>{const a=finding('a');a.legacyEvidence=[{id:'legacy',filename:'earlier.txt',sha256:null,created_at:'2026-10-01T10:00:00Z'}];expect(evidenceSubmissions([a])[0].evidenceCount).toBe(2);});

it('uses the saved display reference without replacing internal grouping IDs',()=>{const a=finding('a','report-1');a.submissionReference='CP-SUB-2026-000001';expect(evidenceSubmissions([a])[0]).toMatchObject({key:'report:report-1',id:'report-1',reference:'CP-SUB-2026-000001'});});

it('report readiness requires all findings to have current completed closure-ready assessments',()=>{
 const a=finding('a','report-1');const b=finding('b','report-1');
 for(const item of [a,b]){item.revision=2;item.cycleNumber=1;item.lifecycle='review_completed';item.currentReview={status:'completed',stale:false,findingRevision:2,cycleNumber:1,recommendation:'Closure ready'} as ManualFinding['currentReview'];}
 expect(submissionClosureReady([a,b])).toBe(true);
 b.currentReview={...b.currentReview!,recommendation:'Not closure ready'};expect(submissionClosureReady([a,b])).toBe(false);
 b.currentReview={...b.currentReview!,recommendation:'Closure ready',stale:true};expect(submissionClosureReady([a,b])).toBe(false);
 b.currentReview=null;expect(submissionClosureReady([a,b])).toBe(false);
 expect(submissionClosureReady([])).toBe(false);
 b.currentReview={...a.currentReview!,cycleNumber:0};expect(submissionClosureReady([a,b])).toBe(false);
 b.currentReview={...a.currentReview!};b.lifecycle='changes_requested';expect(submissionClosureReady([a,b])).toBe(false);
});
