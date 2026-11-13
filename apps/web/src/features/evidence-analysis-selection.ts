import type { PublicAnalysisRun } from '../lib/document-analysis';
import type { ManualFinding } from '../lib/manual-api';

// Retain all history, but use only the newest completed analysis for each exact
// current evidence version/hash. Repeated extraction is not additional evidence.
export function latestEvidenceAnalyses(runs:PublicAnalysisRun[],finding:Pick<ManualFinding,'revision'|'evidence'>):PublicAnalysisRun[] {
  const files=(finding.evidence||[]).filter(file=>!finding.evidence?.some(next=>next.supersedesId===file.id));
  const seen=new Set<string>();
  return [...runs].sort((a,b)=>b.created_at.localeCompare(a.created_at)).filter(run=>{
    if(run.mode!=='evidence'||run.status!=='ready'||run.finding_revision!==finding.revision)return false;
    const file=files.find(file=>file.id===run.evidence_id&&file.version===run.evidence_version&&file.sha256===run.sha256);
    if(!file||seen.has(file.id))return false;
    seen.add(file.id);return true;
  });
}
