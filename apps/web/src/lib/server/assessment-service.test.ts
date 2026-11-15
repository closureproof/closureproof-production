vi.mock('../review-completion-policy',()=>({REVIEW_COMPLETION_CHECKS_SUSPENDED:false}));
import {assessmentMethod} from '@closureproof/assessment-engine/protocol-catalogue';
import { beforeEach, expect, it, vi } from 'vitest';
import { awsIamCandidate, emptyEngineDraft, type EngineDraft } from '@closureproof/assessment-engine/aws-iam';
const { rpc }=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('./document-analysis',()=>({analysisAdmin:()=>({rpc}),AnalysisError:class extends Error{constructor(message:string,public status=400){super(message);}}}));
import { completeAssessment, previewAssessment } from './assessment-service';
const id='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222';
const checks=[{check_id:'iso-ACC-08',result:'pass',applicability:'yes',implementation_status:'implemented',reason:'The reviewed checklist evidence supports this requirement.',evidence_ids:[eid],source_location:'Section 1'}];
let basis:Record<string,unknown>;
function draft():EngineDraft {const draft=emptyEngineDraft();for(const key of ['scope','implemented','cause','evidence','coverage','exceptions','operation_required','retest_required'])draft.entries[key]={value:['operation_required','retest_required'].includes(key)?'false':'true',basis:'The reviewer checked the current original evidence.',locator:'Section 2',evidenceIds:[eid]};return draft;}
beforeEach(()=>{
 basis={finding:{id,revision:2,lifecycle:'under_review',protocol:{code:'aws-iam',checks:[{id:'iso-ACC-08',label:'Service accounts'}]},details:{}},evidence:[{id:eid,version:1,sha256:'a'.repeat(64),supersedes_id:null,disposition:'accepted'}]};
 rpc.mockReset();rpc.mockImplementation(async(name:string)=>({data:name==='cpp_protocol_engine_version'?'1.0-ten-protocols':name==='cpp_engine_context'?structuredClone(basis):name==='cpp_complete_engine_review'?'saved-assessment':null,error:null}));
});
it('evaluates only explicit confirmed inputs and keeps the candidate status',async()=>{
 const result=await previewAssessment({findingId:id,revision:2,reviewer:'Reviewer Casey',draft:draft(),checks});
 expect(result.validationStatus).toBe('candidate');expect(result.evaluation.recommendation).toBe('closure_ready');expect(result.input.facts.scope.state).toBe('confirmed');
 expect(result).not.toHaveProperty('basis');expect(rpc).toHaveBeenCalledWith('cpp_register_engine_protocol',expect.objectContaining({p_definition:assessmentMethod('aws-iam')!.protocol}));
});
it('rejects missing sources and stale finding revisions',async()=>{
 const data=draft();data.entries.scope.evidenceIds=[];
 await expect(previewAssessment({findingId:id,revision:2,reviewer:'Reviewer Casey',draft:data,checks})).rejects.toThrow('source');
 await expect(previewAssessment({findingId:id,revision:1,reviewer:'Reviewer Casey',draft:draft(),checks})).rejects.toThrow('changed');
});
it('recomputes completion and rejects tampered preview hashes',async()=>{
 const data=draft();const preview=await previewAssessment({findingId:id,revision:2,reviewer:'Reviewer Casey',draft:data,checks});
 const request={findingId:id,revision:2,requestId:'33333333-3333-4333-8333-333333333333',supersedes:null,review:{reviewer:'Reviewer Casey',checks,closure_judgement:{operation_requirement:'Not required',retest_requirement:'Not required',scope_status:'Sufficient for this finding',cause_status:'Supported',exceptions_status:'None identified'},recommendation:'Closure ready',engine_request:{draft:data,evaluationHash:'b'.repeat(64),disposition:'accept',overrideReason:'',overrideEvidenceIds:[]}}};
 await expect(completeAssessment(request)).rejects.toThrow('basis changed');
 request.review.engine_request.evaluationHash=preview.evaluationHash;
 expect(await completeAssessment(request)).toEqual({assessmentId:'saved-assessment'});
 expect(rpc).toHaveBeenCalledWith('cpp_complete_engine_review',expect.objectContaining({p_snapshot:expect.objectContaining({validationStatus:'candidate',disposition:'accept'})}));
});
it('rejects evidence changes between preview and completion and validates overrides',async()=>{
 const data=draft();const preview=await previewAssessment({findingId:id,revision:2,reviewer:'Reviewer Casey',draft:data,checks});
 const request={findingId:id,revision:2,requestId:'33333333-3333-4333-8333-333333333333',supersedes:null,review:{reviewer:'Reviewer Casey',checks,closure_judgement:{operation_requirement:'Not required',retest_requirement:'Not required',scope_status:'Sufficient for this finding',cause_status:'Supported',exceptions_status:'None identified'},recommendation:'Not closure ready',engine_request:{draft:data,evaluationHash:preview.evaluationHash,disposition:'override',overrideReason:'short',overrideEvidenceIds:[] as string[]}}};
 await expect(completeAssessment(request)).rejects.toThrow('override reason');
 request.review.engine_request.overrideReason='Further remediation is needed based on the submitted test.';request.review.engine_request.overrideEvidenceIds=[eid];
 expect(await completeAssessment(request)).toEqual({assessmentId:'saved-assessment'});
 (basis.evidence as {version:number}[])[0].version=2;
 await expect(completeAssessment(request)).rejects.toThrow('basis changed');
});
it('uses a durable prior result before reevaluating an already completed request',async()=>{
 rpc.mockResolvedValueOnce({data:'earlier-assessment',error:null});
 expect(await completeAssessment({findingId:id,revision:2,requestId:'33333333-3333-4333-8333-333333333333',supersedes:null,review:{}})).toEqual({assessmentId:'earlier-assessment'});
 expect(rpc).toHaveBeenCalledTimes(1);
});

it('does not treat an unresolved requirement decision as an approved waiver',async()=>{
 const data=draft();const preview=await previewAssessment({findingId:id,revision:2,reviewer:'Reviewer Casey',draft:data,checks});
 await expect(completeAssessment({findingId:id,revision:2,requestId:'33333333-3333-4333-8333-333333333333',supersedes:null,review:{reviewer:'Reviewer Casey',recommendation:'Closure ready',checks,closure_judgement:{operation_requirement:'Not yet established',retest_requirement:'Not required'},engine_request:{draft:data,evaluationHash:preview.evaluationHash,disposition:'accept',overrideReason:'',overrideEvidenceIds:[]}}})).rejects.toThrow('requirement disagrees');
});
