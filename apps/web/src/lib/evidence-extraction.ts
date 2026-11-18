import { documentApi, type PublicAnalysisRun } from './document-analysis';
import { documentMime } from '@closureproof/document-contracts';
import { getSupabase } from './supabase';
import type { ManualFinding } from './manual-api';
export async function requireMultiDocumentReview() {
  const { data, error } = await getSupabase().rpc('cpp_ai_evidence_capacity_version', {});
  if (error || data !== '2.0-multi-document')
    throw Error(
      'Install 20261114000200_multi_document_review.sql in Supabase to enable multi-document review preparation.',
    );
}
export function extractionEvidence(finding: Pick<ManualFinding, 'evidence'>) {
  return (finding.evidence || []).filter(
    (file) =>
      documentMime(file.filename) &&
      !['rejected', 'insufficient'].includes(file.disposition) &&
      !finding.evidence?.some((next) => next.supersedesId === file.id),
  );
}
export async function extractSubmittedEvidence(
  finding: ManualFinding,
  onProgress: (message: string) => void,
  selectedIds?: string[],
) {
  await requireMultiDocumentReview();
  const files = extractionEvidence(finding).filter(
    (file) => !selectedIds || selectedIds.includes(file.id),
  );
  if (!files.length)
    throw Error('No current PDF or DOCX evidence documents are available for this finding.');
  const { runs } = await documentApi.list(finding.id);
  let completed = 0;
  const failures: string[] = [];
  const results: PublicAnalysisRun[] = [];
  for (const file of files) {
    try {
      const cached = runs.find(
        (run) =>
          run.status === 'ready' &&
          run.finding_revision === finding.revision &&
          run.evidence_id === file.id &&
          run.evidence_version === file.version &&
          run.sha256 === file.sha256,
      );
      if (cached) results.push(cached);
      else {
        onProgress(`Processing document ${completed + 1} of ${files.length}: ${file.filename}`);
        const { run } = await documentApi.evidence(
          finding.id,
          finding.revision,
          file.id,
          crypto.randomUUID(),
        );
        results.push(await documentApi.process(run.id));
      }
    } catch (error) {
      failures.push(
        file.filename +
          ': ' +
          (error instanceof Error ? error.message : 'Analysis could not be completed.'),
      );
    }
    completed++;
    onProgress(`Evidence documents processed: ${completed} of ${files.length}`);
  }
  if (failures.length)
    throw Error(
      'Some evidence documents could not be analysed. Successful analyses are saved and will be reused when you retry. ' +
        failures.join(' '),
    );
  return results;
}
