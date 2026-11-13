import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {providerReviewSchema} from './ai-review-schema';
import type {ReviewContext} from './ai-review-preparation';
const context={finding:{id:'test',revision:1,details:{},protocol:{code:'aws-iam',checks:[{id:'iso-ACC-08'}],review_scope:{modules:['scope','cause','exceptions','conclusion']}}},facts:[{key:'known-source:0'}],unanalysed:[]} as unknown as ReviewContext;
it('constrains checklist IDs, source keys and typed engine values inside the provider schema',()=>{
 const schema=providerReviewSchema(context);expect(schema.properties.checklist.items.properties.check_id.enum).toEqual(['iso-ACC-08']);
 expect(schema.properties.checklist.items.properties.source_refs.items.enum).toEqual(['known-source:0']);
 const fields=schema.properties.engine.items.anyOf;const scope=fields.find((entry:any)=>entry.properties.field_id.enum[0]==='scope');expect(scope.properties.value.enum).toEqual(['true','false',null]);expect(scope.properties.source_refs.items.enum).toEqual(['known-source:0']);
});
it('excludes judgement modules outside the pinned scope and constrains exact choice labels',()=>{
 const entries=providerReviewSchema(context).properties.judgements.items.anyOf;
 expect(entries.some((entry:any)=>entry.properties.field.enum[0]==='retest_requirement')).toBe(false);
 const scope=entries.find((entry:any)=>entry.properties.field.enum[0]==='scope_status');expect(scope.properties.value.enum).toEqual(['Sufficient for this finding','Gaps identified','Not yet established',null]);
});
