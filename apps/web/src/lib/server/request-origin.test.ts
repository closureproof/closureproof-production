import {expect,it} from 'vitest';
import {sameRequestOrigin} from './request-origin';
it('accepts the public host behind Next proxy and rejects a foreign origin',()=>{
 expect(sameRequestOrigin(new Request('http://localhost:3006/api/assessments/evaluate',{headers:{host:'127.0.0.1:3006',origin:'http://127.0.0.1:3006','x-forwarded-proto':'http'}}))).toBe(true);
 expect(sameRequestOrigin(new Request('http://localhost/api/assessments/evaluate',{headers:{host:'closureproof.example',origin:'https://closureproof.example','x-forwarded-proto':'https'}}))).toBe(true);
 expect(sameRequestOrigin(new Request('http://localhost:3006/api/assessments/evaluate',{headers:{host:'127.0.0.1:3006',origin:'https://elsewhere.example'}}))).toBe(false);
 expect(sameRequestOrigin(new Request('http://localhost:3006/api/assessments/evaluate',{headers:{host:'127.0.0.1:3006',origin:'null'}}))).toBe(false);
});
