import {expect,it} from 'vitest';
import {readJsonBody} from './request-body';
const request=(body:string)=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body});
it('accepts JSON data without interpreting injection strings as code',async()=>{expect(await readJsonBody(request('{"name":"<script>alert(1)</script>"}'),100)).toEqual({name:'<script>alert(1)</script>'});});
it('rejects oversized byte streams, including multi-byte characters',async()=>{await expect(readJsonBody(request(JSON.stringify('é'.repeat(30))),50)).rejects.toMatchObject({status:413});});
it('rejects a declared oversize body before reading it',async()=>{const r=request('{}');r.headers.set('content-length','1000');await expect(readJsonBody(r,50)).rejects.toMatchObject({status:413});});
it('requires JSON and rejects malformed JSON',async()=>{await expect(readJsonBody(new Request('https://example.test',{method:'POST',body:'a=b'}),50)).rejects.toMatchObject({status:415});await expect(readJsonBody(request('{bad}'),50)).rejects.toMatchObject({status:400});});
