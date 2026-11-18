// Status lists transcribed from columns E and H of the supplied 2022 SoA workbook.
export const soaApplicabilityOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'under_review', label: 'Under review' },
] as const;
export const soaImplementationOptions = [
  { value: 'not_assessed', label: 'Not assessed' },
  { value: 'not_implemented', label: 'Not implemented' },
  { value: 'partially_implemented', label: 'Partially implemented' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'not_applicable', label: 'Not applicable' },
] as const;
export type SoaApplicability = (typeof soaApplicabilityOptions)[number]['value'];
export type SoaImplementation = (typeof soaImplementationOptions)[number]['value'];
export type EvidenceResult = 'pass' | 'fail' | 'unknown' | 'not_applicable';
export interface SoaCheck {
  result: EvidenceResult;
  implementation_status?: SoaImplementation;
  applicability?: SoaApplicability;
  previous_evidence_result?: EvidenceResult;
}
// Keep the existing storage contract while saving the exact, separate SoA status.
// This compatibility value never calculates a finding recommendation.
export function storageResult(status: SoaImplementation): EvidenceResult {
  if (status === 'implemented') return 'pass';
  if (status === 'not_assessed') return 'unknown';
  if (status === 'not_applicable') return 'not_applicable';
  return 'fail';
}
export function initialiseSoaCheck<T extends SoaCheck>(
  check: T,
): Omit<T, keyof SoaCheck> &
  SoaCheck &
  Required<Pick<SoaCheck, 'implementation_status' | 'applicability'>> {
  if (check.implementation_status)
    return {
      ...check,
      applicability: check.applicability || 'under_review',
      implementation_status: check.implementation_status,
    };
  return {
    ...check,
    previous_evidence_result: check.result,
    result: 'unknown',
    implementation_status: 'not_assessed',
    applicability: 'under_review',
  };
}
export function soaCheckLabel(check: SoaCheck): string {
  if (check.implementation_status)
    return (
      soaImplementationOptions.find((option) => option.value === check.implementation_status)
        ?.label || 'Not assessed'
    );
  return {
    pass: 'Earlier evidence assessment: Evidence sufficient',
    fail: 'Earlier evidence assessment: More evidence required',
    unknown: 'Earlier evidence assessment: Not established',
    not_applicable: 'Earlier evidence assessment: Not applicable',
  }[check.result];
}
export function validateSoaChecks(checks: SoaCheck[], publish: boolean): string {
  if (
    checks.some(
      (check) => check.implementation_status === 'not_applicable' && check.applicability !== 'no',
    )
  )
    return 'Select No for applicability before recording Not applicable.';
  if (
    publish &&
    checks.some(
      (check) => check.applicability === 'no' && check.implementation_status !== 'not_applicable',
    )
  )
    return 'For an excluded item, select Not applicable and explain the exclusion in its rationale.';
  if (
    publish &&
    checks.some(
      (check) => check.implementation_status === 'implemented' && check.applicability !== 'yes',
    )
  )
    return 'Confirm Yes for applicability on each item marked Implemented.';
  return '';
}

// One reviewer-entered explanation can cover untouched checks without changing
// their applicability or implementation status.
export function prepareCompletionChecks<
  T extends SoaCheck & { check_id: string; reason: string; reason_source?: string },
>(checks: T[], sharedReason: string): { checks: T[]; error: string } {
  const reason = sharedReason.trim();
  const missing = checks.find(
    (check) => !check.reason.trim() && check.implementation_status === 'not_assessed',
  );
  if (missing && reason.length < 10)
    return {
      checks,
      error:
        'Add a shared explanation for checks left Not assessed (at least 10 characters), or explain them individually. You do not need to mark them Not applicable.',
    };
  const prepared = checks.map((check) =>
    check.implementation_status === 'not_assessed' && !check.reason.trim()
      ? { ...check, reason, reason_source: 'shared_unassessed_note' }
      : check,
  );
  const unexplained = prepared.find((check) => check.reason.trim().length < 10);
  if (unexplained)
    return {
      checks,
      error: `Explain checklist item ${unexplained.check_id} (at least 10 characters). Not applicable is a separate decision and also needs a reason.`,
    };
  return { checks: prepared, error: '' };
}
