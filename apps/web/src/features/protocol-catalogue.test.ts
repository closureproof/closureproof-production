import { describe, expect, it } from 'vitest';
import {
  assessmentMethods,
  newProtocolDraft,
} from '@closureproof/assessment-engine/protocol-catalogue';
import { evaluateDraftProtocol, type AssessmentInput } from '@closureproof/assessment-engine';
import templates from './manual-protocols.json';
import catalogue from './control-scope-catalogue.json';
const evidenceId = '22222222-2222-4222-8222-222222222222';
const confirmed = (value: boolean | string | number) => ({
  state: 'confirmed' as const,
  value,
  confirmedBy: 'Fixture reviewer',
  confirmedOn: '2026-11-11',
  basis: 'Reviewer inspected the original source and recorded the conclusion.',
  sources: [{ evidenceId, version: 1, sha256: 'a'.repeat(64), locator: 'Evidence section 1' }],
});
function input(code: string): AssessmentInput {
  const method = assessmentMethods.find((item) => item.protocol.code === code)!;
  const template = templates.find((item) => item.code === code)!;
  return {
    findingId: 'fixture-finding',
    findingRevision: 1,
    scopeRevision: 1,
    evaluationDate: '2026-11-11',
    facts: Object.fromEntries(
      method.fields
        .filter((field) => field.type === 'boolean')
        .map((field) => [
          field.id,
          confirmed(!['operation_required', 'retest_required'].includes(field.id)),
        ]),
    ),
    evidence: [{ id: evidenceId, version: 1, sha256: 'a'.repeat(64) }],
    checklist: {
      definitions: template.checks.map((check) => ({ id: check.id, label: check.label })),
      answers: template.checks.map((check) => ({
        check_id: check.id,
        result: 'pass',
        applicability: 'yes',
        implementation_status: 'implemented',
        reason: 'Reviewed current source evidence against this scoped requirement.',
        evidence_ids: [evidenceId],
        source_location: 'Evidence section 1',
      })),
    },
  };
}
it('retains all ten stable category codes with distinct protocol definitions', () => {
  expect(assessmentMethods.map((method) => method.protocol.code).sort()).toEqual(
    templates.map((template) => template.code).sort(),
  );
  expect(new Set(assessmentMethods.map((method) => JSON.stringify(method.protocol))).size).toBe(10);
});
for (const method of assessmentMethods)
  describe(method.protocol.code + ' protocol', () => {
    it('explicitly maps its native template and associated configured controls', () => {
      const expected = new Set([
        ...templates
          .find((template) => template.code === method.protocol.code)!
          .checks.map((check) => check.id),
        ...catalogue.controls
          .filter((control) => (control.categories as string[]).includes(method.protocol.code))
          .flatMap((control) => control.task_ids.map((id) => 'iso-' + id)),
      ]);
      expect([...expected].filter((id) => !method.protocol.checklistPolicy!.mappings[id])).toEqual(
        [],
      );
      for (const targets of Object.values(method.protocol.checklistPolicy!.mappings))
        for (const id of targets) expect(method.fields.some((field) => field.id === id)).toBe(true);
    });
    it('reproduces all four outcomes from confirmed facts and scoped evidence', () => {
      const fixture = input(method.protocol.code);
      expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).toBe('closure_ready');
      fixture.facts.implemented = confirmed(false);
      expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).toBe(
        'not_closure_ready',
      );
      fixture.facts.implemented = confirmed(true);
      fixture.facts.evidence = confirmed(false);
      expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).toBe(
        'implemented_evidence_incomplete',
      );
      fixture.facts.evidence = confirmed(true);
      fixture.facts.retest_required = confirmed(true);
      fixture.facts.retest = confirmed('pending');
      expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).toBe(
        'ready_for_retest',
      );
      fixture.facts.retest = confirmed('unsatisfactory');
      expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).toBe(
        'not_closure_ready',
      );
    });
    it('retains unknowns, missing evidence and period/cycle requirements', () => {
      const fixture = input(method.protocol.code);
      fixture.checklist!.answers[0].implementation_status = 'not_assessed';
      fixture.checklist!.answers[0].result = 'unknown';
      expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).not.toBe(
        'closure_ready',
      );
      fixture.checklist!.answers[0].implementation_status = 'implemented';
      fixture.checklist!.answers[0].result = 'pass';
      fixture.facts.operation_required = confirmed(true);
      const result = evaluateDraftProtocol(method.protocol, fixture);
      expect(result.recommendation).toBe('implemented_evidence_incomplete');
      expect(result.missingFacts).toContain('required_days');
      fixture.evidence = [];
      expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).not.toBe(
        'closure_ready',
      );
    });
    it('requires its own domain judgements and prevents cross-category draft reuse', () => {
      const fixture = input(method.protocol.code);
      const domain = method.fields.find(
        (field) => !assessmentMethods[0].fields.some((common) => common.id === field.id),
      );
      if (domain) {
        fixture.facts[domain.id] = confirmed(false);
        expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).toBe(
          'not_closure_ready',
        );
        fixture.facts[domain.id] = { state: 'unknown', reason: 'Not yet inspected' };
        expect(evaluateDraftProtocol(method.protocol, fixture).recommendation).not.toBe(
          'closure_ready',
        );
      }
      const draft = newProtocolDraft(method.protocol.code);
      expect(draft.protocolCode).toBe(method.protocol.code);
      const other = assessmentMethods.find((item) => item.protocol.code !== method.protocol.code)!;
      expect(() => newProtocolDraft(other.protocol.code, draft)).toThrow('another protocol');
    });
  });
