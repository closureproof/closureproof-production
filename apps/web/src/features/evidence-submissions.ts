import type {ManualFinding} from '../lib/manual-api';
export interface EvidenceSubmission {
  key: string;
  id: string;
  reference?: string;
  name: string;
  report: boolean;
  findings: ManualFinding[];
  evidenceCount: number;
  firstSubmitted: string;
}
// Group only persisted findings, never unsubmitted extraction history. Filenames
// are labels; the persisted report run ID is the relationship key.
export function evidenceSubmissions(findings: ManualFinding[]): EvidenceSubmission[] {
  const groups = new Map<string,EvidenceSubmission>();
  for (const finding of findings) {
    const source = finding.source_report;
    const report = Boolean(source?.run_id);
    const id = report ? source!.run_id : finding.id;
    const key = (report ? 'report:' : 'finding:') + id;
    let group = groups.get(key);
    if (!group) {
      group = {key,id,reference:finding.submissionReference,name:report?source!.filename:finding.title,report,findings:[],evidenceCount:0,firstSubmitted:finding.createdAt};
      groups.set(key,group);
    }
    group.findings.push(finding);
    group.evidenceCount += (finding.evidenceCount || 0) + (finding.legacyEvidence?.length || 0);
    if (finding.createdAt && (!group.firstSubmitted || finding.createdAt < group.firstSubmitted)) group.firstSubmitted = finding.createdAt;
  }
  return [...groups.values()].sort((a,b)=>(b.firstSubmitted||'').localeCompare(a.firstSubmitted||''));
}

// A report is ready only when every finding has a current completed assessment.
// This is an aggregate of recorded recommendations, not a formal closure decision.
export function submissionClosureReady(findings:ManualFinding[]):boolean {
  return findings.length>0&&findings.every(finding=>{
    const review=finding.currentReview;
    return review?.status==='completed'&&!review.stale&&review.findingRevision===finding.revision&&review.cycleNumber===finding.cycleNumber&&review.recommendation==='Closure ready'&&['review_completed','awaiting_final_approval','closed'].includes(finding.lifecycle);
  });
}
