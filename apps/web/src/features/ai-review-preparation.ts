import { dateSchema } from '@closureproof/assessment-engine';
import { assessmentMethod, newProtocolDraft } from '@closureproof/assessment-engine/protocol-catalogue';
import { activeSections } from './control-scope';
import { JUDGEMENT_VERSION, type ClosureJudgement } from './review-judgement';
import { storageResult } from './soa-assessment';
import { aiReviewSchema, type ProposalFact, type PreparedReview } from '../lib/ai-review-contract';
import type { ManualFinding, ManualCheck } from '../lib/manual-api';

export function prepareAIReview(raw:unknown,finding:Pick<ManualFinding,'protocol'>,facts:ProposalFact[]):PreparedReview {
  const output=aiReviewSchema.parse(raw);const method=assessmentMethod(finding.protocol.code);
  if(!method)throw Error('No assessment method is available for this category.');
  const sourceWarnings:string[]=[];
  const proposalSections=activeSections(finding.protocol,{version:JUDGEMENT_VERSION});
  const proposalFields=proposalSections.flatMap(section=>section.fields);
  const gapFields=new Set(['required_evidence','evidence_gaps','remaining_actions','limitations_overrides','retest_pending_actions','exceptions_status_reason']);
  const unknownChoices=['Not yet established','Not established','Other / not established'];
  for(const check of output.checklist)if(!check.source_refs.length&&(check.implementation_status!=='not_assessed'||check.applicability!=='under_review')){
    sourceWarnings.push(check.check_id+': no supporting citation was supplied; retained as Not assessed.');check.applicability='under_review';check.implementation_status='not_assessed';check.rationale='The proposed answer had no supporting source citation. Relevant evidence must be linked and inspected before this item can be assessed.';
  }
  for(const entry of output.engine)if(entry.value&&!entry.source_refs.length){sourceWarnings.push(entry.field_id+': uncited proposed value was left unknown.');entry.value=null;}
  for(const entry of output.judgements)if(entry.value&&!entry.source_refs.length&&!unknownChoices.includes(entry.value)&&!gapFields.has(entry.field)&&!entry.field.endsWith('_requirement_reason')&&!(entry.field==='followup_status'&&entry.value==='Required')&&!(entry.field==='limitations_status'&&entry.value==='Identified')){
    const field=proposalFields.find(field=>field.key===entry.field);entry.value=field?.options?.find(value=>unknownChoices.includes(value))||null;sourceWarnings.push(entry.field+': uncited proposed judgement was left unresolved.');
  }
  if(!output.population.source_refs.length&&(output.population.expected!==null||output.population.reviewed!==null)){output.population.expected=null;output.population.reviewed=null;sourceWarnings.push('Population counts had no supporting citation and were left unknown.');}
  const uncitedExceptions=output.exceptions.filter(entry=>!entry.source_refs.length);
  if(uncitedExceptions.length){
    output.exceptions=output.exceptions.filter(entry=>entry.source_refs.length);sourceWarnings.push('Uncited proposed exceptions require inspection; their resolution is not established.');
    const position=output.judgements.find(entry=>entry.field==='exceptions_status');if(position)position.value=output.exceptions.length?'Exceptions identified':'Not yet established';
    const treatment=output.engine.find(entry=>entry.field_id==='exceptions');if(treatment)treatment.value=null;
  }

  const sources=new Map(facts.map(fact=>[fact.key,fact]));const used=new Set<string>();
  function resolve(keys:string[]){if(new Set(keys).size!==keys.length)throw Error('Duplicate document source references.');return keys.map(key=>{const fact=sources.get(key);if(!fact)throw Error('Document analysis returned an unknown source reference.');used.add(key);return fact;});}
  function cited(keys:string[],established:boolean){const refs=resolve(keys);if(established&&!refs.length)throw Error('A proposed answer has no supporting extracted source.');return refs;}
  const seen=new Set<string>();const answers=new Map(output.checklist.map(check=>{
    if(seen.has(check.check_id)||!finding.protocol.checks.some(p=>p.id===check.check_id))throw Error('Document analysis returned a duplicate or out-of-scope checklist item.');seen.add(check.check_id);
    const refs=cited(check.source_refs,check.implementation_status!=='not_assessed'||check.applicability!=='under_review');
    if(check.implementation_status==='implemented'&&check.applicability!=='yes'||check.implementation_status==='not_applicable'&&check.applicability!=='no'||check.applicability==='no'&&check.implementation_status!=='not_applicable')throw Error('Document analysis returned inconsistent checklist applicability and implementation.');
    return [check.check_id,{check_id:check.check_id,applicability:check.applicability,implementation_status:check.implementation_status,result:storageResult(check.implementation_status),reason:check.rationale,evidence_ids:[...new Set(refs.map(f=>f.evidenceId))],source_location:refs.map(f=>`${f.filename}: ${f.page?'page '+f.page+'; ':''}${f.locator}`).join('; ').slice(0,1000)} satisfies ManualCheck];
  }));
  const checks=finding.protocol.checks.map(check=>answers.get(check.id)||{check_id:check.id,applicability:'under_review' as const,implementation_status:'not_assessed' as const,result:'unknown' as const,reason:'The extracted evidence does not establish this checklist item. Further review or evidence is needed.',evidence_ids:[],source_location:''});
  const engine=newProtocolDraft(finding.protocol.code);seen.clear();
  for(const proposal of output.engine){
    const field=method.fields.find(f=>f.id===proposal.field_id);if(!field||seen.has(field.id))throw Error('Document analysis returned an unknown or duplicate engine field.');seen.add(field.id);
    const refs=cited(proposal.source_refs,proposal.value!==null&&proposal.value!=='');const value=proposal.value||'';
    if(value&&(field.type==='boolean'&&!['true','false'].includes(value)||field.type==='integer'&&(!/^\d+$/.test(value)||Number(value)>36500)||field.type==='date'&&!dateSchema.safeParse(value).success||field.type==='retest'&&!['pending','satisfactory','unsatisfactory'].includes(value)))throw Error('Document analysis returned an invalid typed engine value.');
    engine.entries[field.id]={value,basis:proposal.rationale,locator:refs.map(f=>`${f.filename}: ${f.page?'p'+f.page+' ':''}${f.locator}`).join('; ').slice(0,500),evidenceIds:[...new Set(refs.map(f=>f.evidenceId))]};
  }
  const sections=proposalSections;const allowed=sections.flatMap(section=>section.fields.map(field=>({field,section:section.id})));
  const judgement:ClosureJudgement={version:JUDGEMENT_VERSION,evidence_refs:{}};seen.clear();
  for(const proposal of output.judgements){
    const allowedField=allowed.find(item=>item.field.key===proposal.field);if(!allowedField||seen.has(proposal.field))throw Error('Document analysis returned an unknown, excluded or duplicate judgement field.');seen.add(proposal.field);
    const unknown=['Not yet established','Not established','Other / not established'].includes(proposal.value||'');
    const gapField=proposal.field.endsWith('_requirement_reason')||proposal.field==='followup_status'&&proposal.value==='Required'||proposal.field==='limitations_status'&&proposal.value==='Identified'||['required_evidence','evidence_gaps','remaining_actions','limitations_overrides','retest_pending_actions','exceptions_status_reason'].includes(proposal.field);
    const refs=cited(proposal.source_refs,!!proposal.value&&!unknown&&!gapField);if(!proposal.value)continue;
    if(allowedField.field.options&&!allowedField.field.options.includes(proposal.value))throw Error('Document analysis returned an invalid judgement choice.');
    if(allowedField.field.type==='date'&&!dateSchema.safeParse(proposal.value).success||allowedField.field.type==='number'&&!/^\d+$/.test(proposal.value))throw Error('Document analysis returned an invalid judgement date or count.');
    (judgement as Record<string,unknown>)[proposal.field]=proposal.value;
    judgement.evidence_refs![allowedField.section]=[...new Set([...(judgement.evidence_refs![allowedField.section]||[]),...refs.map(f=>f.evidenceId)])];
  }
  const populationRefs=cited(output.population.source_refs,output.population.expected!==null||output.population.reviewed!==null);
  if(populationRefs.length)judgement.evidence_refs!.population=[...new Set(populationRefs.map(f=>f.evidenceId))];
  const exceptions=output.exceptions.map(({source_refs,...entry})=>{cited(source_refs,true);return entry;});
  if(exceptions.length&&judgement.exceptions_status!=='Exceptions identified')throw Error('Proposed exception records disagree with the exception judgement.');
  if(used.size>20)throw Error('The proposed assessment cites more than 20 facts. Use a more focused evidence set or continue manually.');
  // Retest identity/evidence are document claims, never reviewer identity or a
  // completed independent verification inferred from a test file being present.
  const retest=engine.entries.retest;
  if(judgement.retest_status==='Completed'&&retest?.evidenceIds.length)judgement.retest_evidence_id=retest.evidenceIds[0];
  if(output.conflicts.length){
    // A conflicted proposal is useful for locating gaps, but cannot silently
    // establish successful facts. Reviewers resolve and edit the affected draft.
    for(const check of checks)if(check.implementation_status==='implemented'||check.implementation_status==='not_applicable'){check.applicability='under_review';check.implementation_status='not_assessed';check.result='unknown';check.reason=('Conflicting extracted evidence requires review. '+output.conflicts.join(' ')).slice(0,2000);}
    for(const entry of Object.values(engine.entries))entry.value='';
    for(const section of sections)for(const field of section.fields)if(field.options){const unknown=field.options.find(value=>value==='Not yet established'||value==='Not established');if(unknown)(judgement as Record<string,unknown>)[field.key]=unknown;else delete (judgement as Record<string,unknown>)[field.key];}
    delete judgement.retest_evidence_id;
  }
  return {checks,engine,judgement,expected:output.conflicts.length?null:output.population.expected,reviewed:output.conflicts.length?null:output.population.reviewed,exceptions,sourceWarnings,conclusion:sourceWarnings.length?(output.summary.slice(0,1000)+'\n\nEvidence support remains unresolved: '+sourceWarnings.join(' ')).slice(0,2000):output.summary,nextActions:output.next_actions,sourceKeys:[...used]};
}
