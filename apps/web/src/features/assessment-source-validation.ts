import type { AssessmentField } from '@closureproof/assessment-engine/protocol-catalogue';
import type { EngineDraft } from '@closureproof/assessment-engine/aws-iam';

export interface AssessmentSourceIssue { fieldId:string; label:string; missing:('basis'|'locator'|'evidence')[] }
export function assessmentSourceIssue(fields:readonly AssessmentField[],draft:EngineDraft,currentEvidenceIds:string[]):AssessmentSourceIssue|null {
  for(const field of fields){
    if(field.conditional&&draft.entries[field.conditional]?.value==='false')continue;
    const entry=draft.entries[field.id];
    if(!entry?.value||entry.value==='unknown')continue;
    const missing:AssessmentSourceIssue['missing']=[];
    if(entry.basis.trim().length<10)missing.push('basis');
    if(entry.locator.trim().length<2)missing.push('locator');
    if(!entry.evidenceIds.length||new Set(entry.evidenceIds).size!==entry.evidenceIds.length||entry.evidenceIds.some(id=>!currentEvidenceIds.includes(id)))missing.push('evidence');
    if(missing.length)return {fieldId:field.id,label:field.label,missing};
  }
  return null;
}
export function assessmentSourceMessage(issue:AssessmentSourceIssue,shared:boolean){
  const names={basis:shared?'Shared assessment basis (at least 10 characters)':'the assessment basis (at least 10 characters)',locator:shared?'Shared source location':'the source location',evidence:shared?'a current file under Shared supporting evidence':'a current supporting evidence file'};
  return `Before evaluating readiness, add ${issue.missing.map(key=>names[key]).join(', ')}. This supports your answer: ${issue.label}.`;
}
