import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const {rpc}=vi.hoisted(()=>({rpc:vi.fn(async()=>({data:'assessment-id',error:null}))}));
vi.mock('./document-analysis',()=>({analysisAdmin:()=>({rpc}),AnalysisError:class extends Error{}}));
import {completeAssessment} from './assessment-service';
it('also bypasses checks on the original engine completion endpoint while suspended',async()=>{
 const input={findingId:'11111111-1111-4111-8111-111111111111',revision:1,requestId:'22222222-2222-4222-8222-222222222222',supersedes:null,review:{recommendation:'Not closure ready',closure_judgement:{retest_requirement:'Not required'},engine_request:{draft:{entries:{retest_required:{value:'true'}}}}}};
 await expect(completeAssessment(input)).resolves.toEqual({assessmentId:'assessment-id'});
 expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('cpp_complete_review_unrestricted',expect.objectContaining({p_review:input.review}));
});
