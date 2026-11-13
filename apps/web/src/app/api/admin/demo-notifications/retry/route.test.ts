import {afterEach,expect,it,vi} from 'vitest';
const {retry}=vi.hoisted(()=>({retry:vi.fn().mockResolvedValue({processed:0,statuses:[]})}));
vi.mock('../../../../../lib/server/demo-requests',()=>({retryDemoNotifications:retry}));
import {POST} from './route';
afterEach(()=>{vi.unstubAllEnvs();retry.mockClear();});
it('refuses missing, wrong and malformed retry tokens without sending email',async()=>{vi.stubEnv('DEMO_NOTIFICATION_RETRY_TOKEN','test-only-secret');for(const header of ['', 'Bearer wrong','Bearer éééééééééééééééé'])expect((await POST(new Request('https://closureproof.example/api/admin/demo-notifications/retry',{method:'POST',headers:{authorization:header}}))).status).toBe(401);expect(retry).not.toHaveBeenCalled();});
it('allows an operator token to run the bounded retry handler',async()=>{vi.stubEnv('DEMO_NOTIFICATION_RETRY_TOKEN','test-only-secret');const response=await POST(new Request('https://closureproof.example/api/admin/demo-notifications/retry',{method:'POST',headers:{authorization:'Bearer test-only-secret'}}));expect(response.status).toBe(200);expect(retry).toHaveBeenCalledOnce();expect(await response.json()).toEqual({processed:0,statuses:[]});});
it('does not enable retries without a configured operator token',async()=>{vi.stubEnv('DEMO_NOTIFICATION_RETRY_TOKEN','');expect((await POST(new Request('https://closureproof.example/api/admin/demo-notifications/retry',{method:'POST'}))).status).toBe(401);expect(retry).not.toHaveBeenCalled();});
