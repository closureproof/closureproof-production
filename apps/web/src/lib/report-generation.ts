import { recommendationLabels } from '@closureproof/assessment-engine/review-contracts';
import { documentApi } from './document-analysis';
import { getSupabase } from './supabase';
import { manualApi, type ManualReview } from './manual-api';
import { soaApplicabilityOptions, soaCheckLabel } from '../features/soa-assessment';
import { activeSections } from '../features/control-scope';
import {
  judgementSections,
  judgementFields,
  judgementRequirement,
  JUDGEMENT_VERSION,
} from '../features/review-judgement';
import { workflowApi, workflowRpc, type ReportRecord } from './workflow-api';
const bucket = 'closureproof-pilot-evidence';
export const reportTitle = (r: ReportRecord) =>
  r.mode === 'closure' ? 'Closure Evidence Pack' : 'Review Assessment Report';
export async function checksum(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let fontPromise: Promise<string> | undefined;
async function pdfBytes(
  report: ReportRecord,
  assessment: ManualReview & { organisation_snapshot?: { name: string } },
): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  fontPromise ??= fetch('/fonts/NotoSans-Regular.ttf')
    .then(async (response) => {
      if (!response.ok) throw Error('Report font could not be loaded.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    })
    .catch((error) => {
      fontPromise = undefined;
      throw error;
    });
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('NotoSans.ttf', await fontPromise);
  doc.addFont('NotoSans.ttf', 'NotoSans', 'normal');
  doc.setFont('NotoSans');
  doc.setCreationDate(new Date(report.generated_at!));
  doc.setProperties({
    title: reportTitle(report),
    author: 'ClosureProof',
    subject: 'Assessment ' + assessment.id,
  });
  let y = 24;
  const margin = 18,
    width = 174;
  const text = (value: unknown, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(value ?? 'Not recorded'), width) as string[];
    for (const line of lines) {
      if (y > 275) {
        doc.addPage();
        y = 22;
      }
      doc.text(line, margin, y);
      y += size * 0.48;
    }
    y += 3;
  };
  const heading = (value: string) => {
    if (y > 235) {
      doc.addPage();
      y = 22;
    }
    y += 4;
    doc.setTextColor(8, 70, 150);
    text(value, 13);
    doc.setTextColor(7, 27, 61);
  };
  doc.setTextColor(7, 27, 61);
  text('ClosureProof', 20);
  text(reportTitle(report), 18);
  text(`Report ${report.id} | Version ${report.version} | Template ${report.template_version}`, 8);
  text(
    `Assessment ${assessment.id} | Cycle ${assessment.cycleNumber} | Assessment revision ${assessment.assessmentRevision}`,
    8,
  );
  text(`Generated ${report.generated_at} | Reviewed ${assessment.createdAt}`, 8);
  heading('Review summary');
  text(
    `Organisation: ${assessment.organisation_snapshot?.name === 'ClosureProof pilot' ? 'ClosureProof' : assessment.organisation_snapshot?.name || 'Not recorded'}`,
  );
  text(`Finding: ${assessment.finding_snapshot.title}`);
  text(
    `Finding ID: ${assessment.finding_snapshot.finding_reference || assessment.findingId} | Finding revision: ${assessment.findingRevision}`,
    8,
  );
  if (assessment.finding_snapshot.submission_reference)
    text(`Submission ID: ${assessment.finding_snapshot.submission_reference}`, 8);
  text(`Reviewer (recorded name): ${assessment.reviewer}`);
  text(`Recommendation: ${assessment.recommendation}`);
  if (assessment.recommendation === 'Ready for retest') text('Retest pending');
  if (report.mode === 'closure')
    text('Closure-ready recommendation only; final closure requires authorised approval.');
  text(assessment.reviewer_conclusion);
  text(`Recommendation rationale: ${assessment.recommendation_reason}`);
  if (assessment.rules_assessment) {
    const rules = assessment.rules_assessment;
    heading('Rules-supported closure-readiness assessment');
    text(
      `Protocol ${rules.protocol.code} | ${rules.protocol.version} | Engine ${rules.evaluation.engineVersion}`,
    );
    text(
      'Draft protocol: independent validation pending. This is a readiness recommendation, not an audit pass/fail or formal closure approval.',
    );
    text(`Protocol SHA-256: ${rules.protocolHash} | Assessment basis: ${rules.evaluationHash}`, 8);
    text(
      `Evaluation date: ${rules.input.evaluationDate} | Computed recommendation: ${rules.evaluation.recommendation ? recommendationLabels[rules.evaluation.recommendation] : 'Unavailable'}`,
    );
    text(rules.evaluation.decisionReason);
    text(
      `Reviewer disposition: ${rules.disposition} | Recorded recommendation: ${rules.recordedRecommendation}`,
    );
    if (rules.disposition === 'override') {
      text(`Override reason: ${rules.overrideReason}`);
      text(`Override evidence: ${rules.overrideEvidenceIds.join(', ')}`, 8);
    }
    for (const warning of rules.evaluation.warnings)
      text(
        `${warning.message} ${warning.earliestDate ? `Earliest eligibility ${warning.earliestDate}; deadline ${warning.deadline}` : ''}`,
      );
    for (const rule of rules.evaluation.rules) {
      text(`${rule.id}: ${rule.status} — ${rule.reason}`);
      text(
        `Evidence: ${rule.evidenceIds.join(', ') || 'None'}${rule.earliestDate ? ` | Earliest eligibility ${rule.earliestDate}` : ''}`,
        8,
      );
    }
    heading('Confirmed assessment facts');
    for (const [key, fact] of Object.entries(rules.input.facts)) {
      text(
        `${rules.protocolDefinition.facts.find((field) => field.id === key)?.label || key}: ${fact.state === 'confirmed' ? String(fact.value) : 'Unknown'}`,
      );
      if (fact.state === 'confirmed') {
        text(`Basis: ${fact.basis}`);
        text(`Confirmed by ${fact.confirmedBy} on ${fact.confirmedOn}`, 8);
        for (const source of fact.sources)
          text(
            `${source.evidenceId} v${source.version} | ${source.locator} | SHA-256 ${source.sha256}`,
            8,
          );
      } else text(fact.reason);
    }
  }
  heading('Finding and corrective action');
  for (const [key, label] of [
    ['description', 'Finding'],
    ['control_reference', 'Control reference'],
    ['owner', 'Remediation owner'],
    ['account_reference', 'Source account'],
    ['resources', 'Affected resources'],
    ['approved_baseline', 'Baseline'],
    ['root_cause', 'Root cause'],
    ['corrective_action', 'Corrective action'],
    ['recurrence_prevention', 'Recurrence prevention'],
    ['implementation_date', 'Implementation date'],
    ['deadline', 'Deadline'],
  ] as const)
    text(`${label}: ${assessment.finding_snapshot[key] || 'Not recorded'}`);
  if (assessment.finding_snapshot.source_report) {
    const source = assessment.finding_snapshot.source_report;
    heading('Audit report source');
    text(`${source.filename} | SHA-256 ${source.sha256}`, 8);
    text(
      `Extraction ${source.run_id} | Draft ${source.draft_index + 1} | Submission confirmed by ${source.confirmed_by} at ${source.confirmed_at}`,
      8,
    );
    text(
      'The original audit report identifies the finding; it is not proof of completed remediation.',
    );
  }
  if (assessment.ai_review_proposal_snapshot) {
    const proposal = assessment.ai_review_proposal_snapshot;
    heading('Review preparation');
    text(`Proposal ${proposal.id} | Generated ${proposal.generated_at}`, 8);
    text(`Draft adopted by ${proposal.reviewer} at ${proposal.applied_at}`, 8);
    text(
      `Proposal SHA-256: ${proposal.proposal_hash} | Source basis: ${proposal.source_fingerprint}`,
      8,
    );
    for (const note of [...proposal.limitations, ...proposal.conflicts]) text(note);
  }
  if (assessment.ai_confirmed_facts?.length) {
    heading('Reviewer-confirmed document facts');
    text(
      'Document source references were checked by the recorded reviewer. Confirmation of document content does not by itself establish effectiveness or closure readiness.',
      8,
    );
    for (const fact of assessment.ai_confirmed_facts) {
      text(`${fact.label}: ${fact.value}`);
      text(
        `Source: ${fact.filename} v${fact.evidence_version} (${fact.evidence_id}) | ${fact.page ? `Page ${fact.page} | ` : ''}${fact.locator}`,
        8,
      );
      text(`Quoted passage: ${fact.quote}`, 9);
      text(
        `Decision: ${fact.decision} | Recorded by ${fact.actor} at ${fact.confirmed_at}${fact.reason ? ` | ${fact.reason}` : ''}`,
        8,
      );
      text(
        `Extraction ${fact.run_id} | ${fact.extraction_version} | SHA-256 ${fact.evidence_sha256}`,
        8,
      );
    }
  }
  if (assessment.protocol_snapshot.review_scope) {
    const scope = assessment.protocol_snapshot.review_scope;
    heading('Assessment scope');
    text(
      `Controls: ${scope.controls.map((c) => `${c.id} ${c.title}`).join('; ') || 'Control not yet identified — custom scope'}`,
    );
    text(
      `Mapping version: ${scope.version} | Scope confirmed: ${assessment.scope_confirmed ? 'Yes' : 'Not recorded'}`,
      8,
    );
    text(
      `Scope confirmation: ${assessment.scope_confirmation_notes || 'Recorded against the selected scope'}`,
    );
    if (scope.provisional) text(`Provisional basis: ${scope.unknown_reason}`);
    for (const [id, reason] of Object.entries(scope.excluded_tasks))
      text(`Task ${id}: Outside this assessment scope — ${reason}`);
    for (const [id, reason] of Object.entries(scope.module_exclusions))
      text(
        `${judgementSections.find((s) => s.id === id)?.title || id}: Outside this assessment scope — ${reason}`,
      );
  }
  if (
    assessment.engine_draft?.dateDecisions &&
    Object.keys(assessment.engine_draft.dateDecisions).length
  ) {
    heading('Review date decisions');
    for (const [key, decision] of Object.entries(assessment.engine_draft.dateDecisions)) {
      text(`${key.replaceAll('_', ' ')}: ${decision.value}`);
      text(`Reason: ${decision.reason || 'No conflicting date recorded'}`);
      for (const candidate of decision.candidates)
        text(`${candidate.value} | ${candidate.source}`, 8);
    }
  }
  heading('Protocol and checklist assessments');
  if (assessment.unassessed_checks_reason)
    text(`Shared explanation for unassessed checks: ${assessment.unassessed_checks_reason}`);
  text(
    `${assessment.protocol_snapshot.title} | ${assessment.protocol_snapshot.code} | ${assessment.protocol_snapshot.version}`,
  );
  for (const check of assessment.checks) {
    const source = assessment.protocol_snapshot.checks.find((c) => c.id === check.check_id);
    heading(source?.label || check.check_id);
    text(
      `Applicability: ${soaApplicabilityOptions.find((option) => option.value === check.applicability)?.label || 'Not recorded'} | Implementation: ${soaCheckLabel(check)}`,
    );
    if (source?.mapped_controls)
      text(
        `Mapped controls: ${source.mapped_controls.join(', ') || 'Additional or provisional scope'}`,
        8,
      );
    if (source?.sourceTask)
      text(`Control: ${source.sourceTask.reference} | Source page: ${source.sourceTask.page}`, 8);
    text(
      `${check.reason_source === 'shared_unassessed_note' ? 'Rationale (shared explanation)' : 'Rationale'}: ${check.reason}`,
    );
    text(`Source location: ${check.source_location || 'Not recorded'}`);
    text(`Evidence IDs: ${check.evidence_ids.join(', ') || 'None referenced'}`, 8);
  }
  heading('Evidence inventory');
  if (!assessment.evidence_snapshot.length) text('No evidence supplied.');
  for (const file of assessment.evidence_snapshot) {
    text(`${file.filename} | ID ${file.reference || file.id} | v${file.version}`);
    text(
      `Source: ${file.metadata.source_system} | Account: ${file.metadata.source_account} | Captured: ${file.metadata.captured_at || 'Unknown'}`,
    );
    text(
      `Coverage: ${file.metadata.covered_resources} | Period ${file.metadata.period_start || 'Unknown'} to ${file.metadata.period_end || 'Unknown'}`,
    );
    text(`Recorded disposition: ${file.disposition} | SHA-256: ${file.sha256}`, 8);
  }
  const writeExceptions = () => {
    if (
      assessment.closure_judgement?.version === JUDGEMENT_VERSION &&
      assessment.closure_judgement.exceptions_status === 'Not yet established'
    )
      text('Exception position not yet established.');
    else if (!assessment.exception_entries?.length)
      text('Reviewer recorded no individual exceptions.');
    for (const entry of assessment.exception_entries || [])
      text(
        `${entry.reference}: ${entry.description}\nOwner: ${entry.owner} | Disposition: ${entry.disposition}\nEvidence: ${entry.evidence_reference || 'Not recorded'}\nClosure impact: ${entry.closure_impact}${entry.acceptance_authority ? `\nAccepted by: ${entry.acceptance_authority} | Decision date: ${entry.acceptance_date} | Reference: ${entry.acceptance_reference}` : ''}${entry.compensating_controls ? `\nCompensating controls: ${entry.compensating_controls}` : ''}`,
      );
  };
  if (!['2.0-manual', JUDGEMENT_VERSION].includes(assessment.closure_judgement?.version || '')) {
    heading('Exceptions');
    writeExceptions();
  }
  for (const section of activeSections(
    assessment.protocol_snapshot,
    assessment.closure_judgement,
  )) {
    heading(section.title);
    if (
      section.id === 'exceptions' &&
      ['2.0-manual', JUDGEMENT_VERSION].includes(assessment.closure_judgement?.version || '')
    )
      writeExceptions();
    for (const field of judgementFields(
      section,
      assessment.closure_judgement || {},
      assessment.exception_entries?.length || 0,
    ).filter((field) => field.required !== false || assessment.closure_judgement?.[field.key]))
      text(`${field.label}: ${assessment.closure_judgement?.[field.key] || 'Not recorded'}`);
    const refs = assessment.closure_judgement?.evidence_refs?.[section.id] || [];
    if (refs.length)
      text(
        `Supporting evidence: ${refs
          .map((id) => {
            const file = assessment.evidence_snapshot.find((file) => file.id === id);
            return file ? `${file.filename} v${file.version} (${id})` : id;
          })
          .join('; ')}`,
        8,
      );
  }
  if (
    activeSections(assessment.protocol_snapshot, assessment.closure_judgement).some(
      (s) => s.id === 'retest',
    ) &&
    (!['2.0-manual', JUDGEMENT_VERSION].includes(assessment.closure_judgement?.version || '') ||
      (judgementRequirement(assessment.closure_judgement || {}, 'retest') &&
        assessment.closure_judgement?.retest_status === 'Completed'))
  )
    text(
      `Retest evidence ID: ${assessment.closure_judgement?.retest_evidence_id || 'Not recorded'}`,
      8,
    );
  if (!['2.0-manual', JUDGEMENT_VERSION].includes(assessment.closure_judgement?.version || ''))
    for (const [key, label] of [
      ['population_notes', 'Earlier population notes'],
      ['exceptions', 'Earlier exception notes'],
      ['operating_period_notes', 'Earlier operating-history notes'],
      ['retest_notes', 'Earlier retest notes'],
    ] as const)
      if (assessment[key]) text(`${label}: ${assessment[key]}`);
  heading(
    activeSections(assessment.protocol_snapshot, assessment.closure_judgement).some(
      (s) => s.id === 'population',
    ) && judgementRequirement(assessment.closure_judgement || {}, 'population')
      ? 'Population and required follow-up'
      : 'Required follow-up',
  );
  if (
    activeSections(assessment.protocol_snapshot, assessment.closure_judgement).some(
      (s) => s.id === 'population',
    ) &&
    judgementRequirement(assessment.closure_judgement || {}, 'population')
  )
    text(
      `Expected population: ${assessment.population_expected ?? 'Unknown'} | Reviewed: ${assessment.population_reviewed ?? 'Unknown'}`,
    );
  text(
    `Additional evidence/remediation request: ${assessment.clarification_request || 'None recorded'}`,
  );
  text(
    `Independence declaration: ${assessment.independent ? 'Declared' : 'Not declared'} | ${assessment.independence_notes || 'Not recorded'}`,
  );
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(90, 105, 125);
    doc.text(
      `ClosureProof | ${report.id.slice(0, 8)} | ${page} / ${doc.getNumberOfPages()}`,
      margin,
      289,
    );
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
const active = new Map<string, Promise<ReportRecord>>();
export function generateReport(id: string): Promise<ReportRecord> {
  if (active.has(id)) return active.get(id)!;
  const promise = (async () => {
    const reserved = await workflowRpc<ReportRecord>('cpp_begin_report', { p_report: id });
    if (reserved.status === 'ready') return reserved;
    try {
      const assessment = await workflowApi.assessment(reserved.assessment_id);
      const bytes = await pdfBytes(reserved, assessment);
      const hash = await checksum(bytes);
      const { error } = await getSupabase()
        .storage.from(bucket)
        .upload(reserved.object_path!, bytes, { contentType: 'application/pdf', upsert: false });
      if (error) throw error;
      return await workflowRpc<ReportRecord>('cpp_finish_report', {
        p_report: id,
        p_token: reserved.lease_token,
        p_sha256: hash,
        p_size: bytes.length,
      });
    } catch (error) {
      await workflowRpc('cpp_fail_report', {
        p_report: id,
        p_token: reserved.lease_token,
        p_error:
          error instanceof Error
            ? error.message || error.name
            : typeof error === 'object' && error && 'message' in error
              ? String(error.message)
              : String(error),
      }).catch(() => {});
      throw error;
    }
  })();
  active.set(id, promise);
  promise.finally(() => active.delete(id)).catch(() => {});
  return promise;
}
async function reportFile(report: ReportRecord) {
  if (report.status !== 'ready' || !report.object_path)
    throw Error('Generate the report before downloading.');
  const { data, error } = await getSupabase().storage.from(bucket).download(report.object_path);
  if (error) throw error;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if ((await checksum(bytes)) !== report.sha256)
    throw Error('The report checksum does not match its saved record.');
  return { blob: data, bytes };
}
export async function downloadReport(report: ReportRecord) {
  const file = await reportFile(report);
  downloadBlob(file.blob, `ClosureProof_${report.mode}_${report.id}.pdf`);
}
export async function downloadPack(report: ReportRecord) {
  const assessment = await workflowApi.assessment(report.assessment_id);
  const file = await reportFile(report);
  const files: Record<string, Uint8Array> = { 'review-report.pdf': file.bytes };
  const manifest = [];
  for (const evidence of assessment.evidence_snapshot) {
    try {
      const original = await manualApi.evidenceFile(assessment.findingId, evidence.id, 'download');
      const bytes = new Uint8Array(await original.blob.arrayBuffer());
      if ((await checksum(bytes)) !== evidence.sha256) throw Error('Snapshot checksum mismatch');
      const safe = evidence.filename.replace(/[^\p{L}\p{N}._ -]/gu, '_');
      const path = `evidence/${evidence.id}_v${evidence.version}_${safe}`;
      files[path] = bytes;
      manifest.push({ ...evidence, archive_path: path });
    } catch (error) {
      throw Error(
        `Evidence pack incomplete: ${evidence.filename} (${evidence.id}) could not be retrieved. ${error instanceof Error ? error.message : ''}`,
      );
    }
  }
  const reportSource = assessment.finding_snapshot.source_report;
  if (reportSource) {
    try {
      const original = await documentApi.source(reportSource.run_id);
      const response = await fetch(original.url);
      if (!response.ok) throw Error('Original audit report unavailable');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if ((await checksum(bytes)) !== reportSource.sha256)
        throw Error('Audit report checksum mismatch');
      files['audit-source/' + reportSource.filename.replace(/[^\p{L}\p{N}._ -]/gu, '_')] = bytes;
    } catch (error) {
      throw Error(
        `Evidence pack incomplete: audit source ${reportSource.filename} could not be retrieved. ${error instanceof Error ? error.message : ''}`,
      );
    }
  }
  files['manifest.json'] = new TextEncoder().encode(
    JSON.stringify(
      {
        submission_reference: assessment.finding_snapshot.submission_reference || null,
        finding_reference: assessment.finding_snapshot.finding_reference || null,
        report_id: report.id,
        assessment_id: assessment.id,
        report_sha256: report.sha256,
        review_scope: assessment.protocol_snapshot.review_scope || null,
        source_report: reportSource || null,
        ai_confirmed_facts: assessment.ai_confirmed_facts || [],
        ai_review_preparation: assessment.ai_review_proposal_snapshot || null,
        rules_assessment: assessment.rules_assessment || null,
        evidence: manifest,
      },
      null,
      2,
    ),
  );
  const { zip } = await import('fflate');
  const bytes = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 0 }, (error, result) => (error ? reject(error) : resolve(result))),
  );
  downloadBlob(
    new Blob([bytes.slice().buffer], { type: 'application/zip' }),
    `ClosureProof_pack_${report.id}.zip`,
  );
}
