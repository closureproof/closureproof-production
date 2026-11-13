import {expect,it} from 'vitest';
import {latestEvidenceAnalyses} from './evidence-analysis-selection';
import type {PublicAnalysisRun} from '../lib/document-analysis';
import type {ManualFinding} from '../lib/manual-api';
const finding={revision:2,evidence:[{id:'file',version:1,sha256:'hash',supersedesId:null}]} as unknown as Pick<ManualFinding,'revision'|'evidence'>;
const run=(id:string,date:string,patch:Partial<PublicAnalysisRun>={}):PublicAnalysisRun=>({id,mode:'evidence',status:'ready',finding_revision:2,evidence_id:'file',evidence_version:1,sha256:'hash',created_at:date,...patch} as PublicAnalysisRun);
it('uses one latest completed analysis rather than counting repeated extraction as more evidence',()=>{
 const old=Array.from({length:6},(_,i)=>run('old-'+i,'2020-01-0'+(i+1)+'T00:00:00Z'));
 const current=run('current','2026-11-12T00:00:00Z');const input=[...old,current];
 expect(latestEvidenceAnalyses(input,finding).map(r=>r.id)).toEqual(['current']);expect(input).toHaveLength(7);
});
it('does not replace a completed analysis with a newer pending or failed attempt',()=>{
 expect(latestEvidenceAnalyses([run('failed','2026-11-12',{status:'failed'}),run('ready','2026-11-11')],finding).map(r=>r.id)).toEqual(['ready']);
});
it('does not use earlier finding revisions, wrong evidence versions or changed checksums',()=>{
 const rows=[run('old-finding','2026-11-12',{finding_revision:1}),run('old-file','2026-11-12',{evidence_version:2}),run('changed-hash','2026-11-12',{sha256:'other'})];
 expect(latestEvidenceAnalyses(rows,finding)).toEqual([]);
});
it('retains separate current analyses for different files while excluding superseded evidence',()=>{
 const f={revision:2,evidence:[...finding.evidence!,{id:'replacement',version:2,sha256:'new',supersedesId:'file'}]} as unknown as Pick<ManualFinding,'revision'|'evidence'>;
 expect(latestEvidenceAnalyses([run('old','2026-11-11'),run('replacement','2026-11-12',{evidence_id:'replacement',evidence_version:2,sha256:'new'})],f).map(r=>r.id)).toEqual(['replacement']);
});
