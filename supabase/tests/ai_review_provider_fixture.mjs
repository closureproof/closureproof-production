// TEST ONLY. Deterministic transport fixture for the provider response contract.
// Production always uses OpenAI; this is loaded only by the isolated DB server.
export function reviewProviderFixture(body){
 const {context,engine_fields,judgement_sections}=JSON.parse(body.input[0].content[0].text);
 const key=context.facts[0].key;const note='Synthetic fixture records the approved baseline, complete population, corrective action and supporting source records.';
 const choices={scope_status:'Sufficient for this finding',cause_status:'Supported',root_cause_type:'Incomplete population',population_requirement:'Required',coverage_approach:'Full population',operation_requirement:'Not required',retest_requirement:'Not required',exceptions_status:'None identified',followup_status:'None required',limitations_status:'None identified'};
 const output={
  checklist:context.finding.protocol.checks.map(check=>({check_id:check.id,applicability:'yes',implementation_status:'implemented',rationale:note,source_refs:[key]})),
  engine:engine_fields.map(field=>({field_id:field.id,value:field.type==='boolean'?field.id.endsWith('_required')?'false':'true':null,rationale:field.id.endsWith('_required')?'The synthetic source explicitly documents that this additional assessment is not required.':note,source_refs:field.type==='boolean'?[key]:[]})),
  judgements:judgement_sections.flatMap(section=>section.fields.map(field=>({field:field.key,value:field.options?choices[field.key]||null:field.type?null:note,source_refs:field.options&&!choices[field.key]||field.type?[]:[key]}))),
  population:{expected:121,reviewed:121,source_refs:[key]},exceptions:[],summary:'The synthetic source records support the documented correction and full population review; this is a proposed review summary.',next_actions:'',limitations:[],conflicts:[],
 };
 if(String(context.finding.details.title).includes('Unsupported AI source'))output.engine[0].source_refs=['nonexistent-fact'];
 return {status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}],usage:{input_tokens:100,output_tokens:100}};
}
