import {afterEach,expect,it,vi} from 'vitest';
import type {ManualFinding} from './manual-api';
const mock=vi.hoisted(()=>({rpc:vi.fn(async()=>({data:'2.0-multi-document',error:null})),list:vi.fn(),evidence:vi.fn(),process:vi.fn()}));
vi.mock('./supabase',()=>({getSupabase:()=>({rpc:mock.rpc})}));vi.mock('./document-analysis',()=>({documentApi:mock}));
import {extractSubmittedEvidence} from './evidence-extraction';
afterEach(()=>vi.clearAllMocks());
const finding={id:'finding',revision:2,evidence:[{id:'a',filename:'first.pdf',version:1,sha256:'a'},{id:'b',filename:'second.docx',version:1,sha256:'b'},{id:'c',filename:'manual.csv',version:1,sha256:'c'}]} as ManualFinding;
it('extracts eligible files sequentially and preserves each file relationship',async()=>{
 mock.list.mockResolvedValue({runs:[]});mock.evidence.mockImplementation(async(_id,_revision,evidence)=>({run:{id:evidence}}));let finishFirst!:(value:unknown)=>void;const first=new Promise(resolve=>{finishFirst=resolve;});
 mock.process.mockImplementation(async id=>id==='a'?first:{id,status:'ready'});
 const progress=vi.fn();const extraction=extractSubmittedEvidence(finding,progress);
 await vi.waitFor(()=>expect(mock.process).toHaveBeenCalledWith('a'));
 expect(mock.evidence).toHaveBeenCalledTimes(1);expect(mock.process).toHaveBeenCalledTimes(1);
 expect(progress).toHaveBeenCalledWith('Processing document 1 of 2: first.pdf');
 finishFirst({id:'a',status:'ready'});await extraction;
 expect(progress).toHaveBeenCalledWith('Processing document 2 of 2: second.docx');expect(mock.evidence.mock.calls.map(call=>call[2]).sort()).toEqual(['a','b']);expect(mock.process).toHaveBeenCalledTimes(2);
});
it('reuses current successful analyses and processes other documents after a failure',async()=>{
 mock.list.mockResolvedValue({runs:[{id:'cached',status:'ready',finding_revision:2,evidence_id:'a',evidence_version:1,sha256:'a'}]});mock.evidence.mockResolvedValue({run:{id:'new'}});mock.process.mockRejectedValue(Error('Temporary provider failure'));
 await expect(extractSubmittedEvidence(finding,vi.fn())).rejects.toThrow('Successful analyses are saved');expect(mock.evidence).toHaveBeenCalledTimes(1);expect(mock.evidence.mock.calls[0][2]).toBe('b');
});
