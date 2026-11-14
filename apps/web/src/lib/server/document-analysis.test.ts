import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { zipSync,strToU8 } from 'fflate';
import { DOCX_MIME,type AnalysisRun } from '@closureproof/document-contracts';
vi.mock('server-only',()=>({}));
import { extractWithOpenAI,validateDocumentBytes } from './document-analysis';
const run={filename:'report.pdf',mime:'application/pdf',mode:'report',model:'gpt-5-mini'} as AnalysisRun;
const output={coverage:'readable_text',limitations:[],findings:[],facts:[]};
beforeEach(()=>{vi.stubEnv('AI_EXTRACTION_ENABLED','true');vi.stubEnv('OPENAI_API_KEY','test-server-secret');});
afterEach(()=>vi.unstubAllEnvs());
it('sends the original bytes directly to Responses with a strict schema and no tools',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}],usage:{input_tokens:123}}),{status:200}));
 const bytes=strToU8('%PDF-1.7 synthetic fixture');const result=await extractWithOpenAI(bytes,run,fetcher);
 const [url,options]=fetcher.mock.calls[0];const body=JSON.parse(options.body);
 expect(url).toBe('https://api.openai.com/v1/responses');expect(body.store).toBe(false);expect(body.text.format.strict).toBe(true);expect(body.tools).toBeUndefined();
 expect(body.input[0].content[0]).toEqual({type:'input_file',filename:'report.pdf',file_data:'data:application/pdf;base64,'+Buffer.from(bytes).toString('base64')});
 expect(options.headers.Authorization).toBe('Bearer test-server-secret');expect(result.usage.input_tokens).toBe(123);
});
it('does not call a provider when configuration is missing',async()=>{
 vi.stubEnv('OPENAI_API_KEY','');const fetcher=vi.fn();await expect(extractWithOpenAI(new Uint8Array([1]),run,fetcher)).rejects.toThrow('not enabled');expect(fetcher).not.toHaveBeenCalled();
});
it('does not accept incomplete responses, refusals or invalid output, and never automatically retries',async()=>{
 for(const response of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'not JSON'}]}]}]){
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));await expect(extractWithOpenAI(strToU8('%PDF-'),run,fetcher)).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
 }
});
it('validates DOCX archive metadata without extracting document text',()=>{
 const docx=zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<document>Audit finding</document>')});expect(()=>validateDocumentBytes(docx,DOCX_MIME)).not.toThrow();
 expect(()=>validateDocumentBytes(zipSync({'readme.txt':strToU8('not DOCX')}),DOCX_MIME)).toThrow('standard');
 expect(()=>validateDocumentBytes(zipSync({'[Content_Types].xml':strToU8(''),'word/document.xml':strToU8(''),'word/vbaProject.bin':new Uint8Array([1])}),DOCX_MIME)).toThrow('non-macro');
 expect(()=>validateDocumentBytes(strToU8('not a PDF'),'application/pdf')).toThrow('not a PDF');
});

it('constrains DOCX page fields to null in the provider schema, not just the prompt',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})));
 await extractWithOpenAI(strToU8('provider input'),{...run,filename:'audit.docx',mime:DOCX_MIME,model:'gpt-4.1-mini'},fetcher);
 const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.reasoning).toBeUndefined();expect(body.input[0].content[0].file_data).toContain('data:'+DOCX_MIME+';base64,');
 const pages:unknown[]=[];const visit=(node:unknown)=>{if(!node||typeof node!=='object')return;const value=node as Record<string,unknown>;const props=value.properties as Record<string,unknown>|undefined;if(props?.page)pages.push(props.page);Object.values(value).forEach(visit);};visit(body.text.format.schema);
 expect(pages.length).toBeGreaterThan(0);expect(pages.every(page=>JSON.stringify(page)==='{"type":"null"}')).toBe(true);
});

it('retains more than twenty evidence facts without a schema count restriction',async()=>{
 const facts=Array.from({length:45},(_,index)=>({label:'Source record '+index,value:'Recorded evidence fact '+index,quote:'Recorded source passage.',locator:'Record '+index,page:1}));
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...output,facts})}]}]})));
 const result=await extractWithOpenAI(strToU8('%PDF-'),{...run,mode:'evidence'},fetcher);expect(result.result.facts).toHaveLength(45);
 const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.text.format.schema.properties.facts.maxItems).toBeUndefined();
});
