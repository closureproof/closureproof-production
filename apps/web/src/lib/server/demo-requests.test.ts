import {afterEach,beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {saveDemoRequest,notifyDemoAdmin,demoRequestSchema} from './demo-requests';
afterEach(()=>vi.unstubAllEnvs());
const request={requestId:'11111111-1111-4111-8111-111111111111',name:'Taylor',email:'taylor@example.test',companyName:'Example',contactPerson:'Contact Person',contactEmail:'',contactPhone:''};
const lead={id:request.requestId,name:request.name,email:request.email,company_name:'Example',contact_person:'Contact Person',created_at:'2026-11-13T12:00:00Z'};
const rpc=vi.fn();const admin={rpc}as any;
beforeEach(()=>{rpc.mockReset();vi.stubEnv('RESEND_API_KEY','test-only');vi.stubEnv('DEMO_NOTIFICATION_FROM','ClosureProof <demo@example.test>');vi.stubEnv('DEMO_ADMIN_EMAIL','admin@example.test');});
it('saves before notifying and sends only the server-configured recipient',async()=>{
 rpc.mockImplementation(async(name:string)=>({data:name==='demo_save_request'?request.requestId:name==='demo_claim_notification'?lead:true,error:null}));const send=vi.fn().mockImplementation(async()=>{expect(rpc.mock.calls[0][0]).toBe('demo_save_request');return new Response('{"id":"mail-1"}',{status:200});});
 expect(await saveDemoRequest(request,admin,send)).toEqual({accepted:true});const body=JSON.parse(send.mock.calls[0][1].body);expect(body.to).toEqual(['admin@example.test']);expect(body.reply_to).toBe('taylor@example.test');expect(body.text).toContain('Company: Example');expect(send.mock.calls[0][1].headers['Idempotency-Key']).toContain(request.requestId);expect(rpc.mock.calls.at(-1)![1].p_message).toBe('mail-1');
});
it('retains success after saving when mail delivery fails',async()=>{
 rpc.mockImplementation(async(name:string)=>({data:name==='demo_save_request'?request.requestId:name==='demo_claim_notification'?lead:true,error:null}));expect(await saveDemoRequest(request,admin,vi.fn().mockRejectedValue(Error('timeout')))).toEqual({accepted:true});expect(rpc.mock.calls.at(-1)![1]).toMatchObject({p_message:null,p_error:expect.stringContaining('enquiry remains saved')});
});
it('never attempts mail when saving fails',async()=>{rpc.mockResolvedValue({data:null,error:{code:'42P01'}});const send=vi.fn();await expect(saveDemoRequest(request,admin,send)).rejects.toThrow('could not save');expect(send).not.toHaveBeenCalled();});
it('leaves notification pending if mail is unconfigured',async()=>{vi.stubEnv('RESEND_API_KEY','');rpc.mockResolvedValue({data:request.requestId,error:null});expect(await saveDemoRequest(request,admin,vi.fn())).toEqual({accepted:true});expect(rpc).toHaveBeenCalledTimes(1);});
it('does not resend a claimed or already-sent notification',async()=>{rpc.mockResolvedValue({data:null,error:null});const send=vi.fn();expect(await notifyDemoAdmin(request.requestId,admin,send)).toBe('unchanged');expect(send).not.toHaveBeenCalled();});
it('validates contact values and refuses injected fields',()=>{expect(demoRequestSchema.safeParse({...request,email:'invalid'}).success).toBe(false);expect(demoRequestSchema.safeParse({...request,to:'attacker@example.test'}).success).toBe(false);});
it('does not undo saved enquiry if notification bookkeeping fails',async()=>{rpc.mockImplementation(async(name:string)=>{if(name==='demo_save_request')return {data:request.requestId,error:null};throw Error('Database unavailable');});expect(await saveDemoRequest(request,admin,vi.fn())).toEqual({accepted:true});});
