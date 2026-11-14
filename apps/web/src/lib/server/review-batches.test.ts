import {expect,it} from 'vitest';
import {reviewBatches,mergeReviewBatches} from './review-batches';
import type {ReviewContext} from './ai-review-preparation';
import type {AIReviewOutput,ProposalFact} from '../ai-review-contract';
const fact=(index:number)=>({key:'run:'+index,value:'Evidence value '+index,quote:'q'.repeat(1200),label:'Label',filename:'source.pdf'} as ProposalFact);
const context={finding:{id:'id',revision:1,details:{},protocol:{code:'aws-iam',checks:[]}},facts:Array.from({length:250},(_,index)=>fact(index)),unanalysed:[]} as unknown as ReviewContext;
const output=(value:string,key:string):AIReviewOutput=>({checklist:[],engine:[{field_id:'scope',value,rationale:'The source records establish the assessed scope.',source_refs:[key]}],judgements:[],population:{expected:null,reviewed:null,source_refs:[]},exceptions:[],summary:'The source records describe the assessment evidence.',next_actions:'Inspect the records.',limitations:[],conflicts:[]});
it('partitions processing without dropping, duplicating or changing source facts',()=>{
 const batches=reviewBatches(context);expect(batches.length).toBeGreaterThan(1);expect(batches.flatMap(batch=>batch.facts)).toEqual(context.facts);expect(batches.every(batch=>batch.facts.length<=128)).toBe(true);
});
it('merges references from every batch and leaves conflicting facts unknown',()=>{
 const merged=mergeReviewBatches([output('true','run:0'),output('false','run:1')],context);
 expect(merged.engine[0].value).toBeNull();expect(merged.engine[0].source_refs).toEqual(['run:0','run:1']);expect(merged.conflicts.length).toBeGreaterThan(0);
});
it('keeps agreed answers while retaining all their references',()=>{
 const merged=mergeReviewBatches([output('true','run:0'),output('true','run:1')],context);expect(merged.engine[0].value).toBe('true');expect(merged.engine[0].source_refs).toEqual(['run:0','run:1']);
});
