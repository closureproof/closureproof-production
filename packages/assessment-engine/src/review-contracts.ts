import { z } from 'zod';
import { dateSchema } from './contracts';

// Shared review inputs. Protocol-specific scope and coverage labels are supplied
// by the catalogue; supported version strings retain persisted draft compatibility.
export const assessmentFields = [
  { id: 'scope', label: 'Scope and approved control baseline are established', type: 'boolean' },
  { id: 'implemented', label: 'Corrective action is implemented', type: 'boolean' },
  { id: 'cause', label: 'Action addresses the root cause and recurrence', type: 'boolean' },
  { id: 'evidence', label: 'Evidence is relevant, reliable and sufficient', type: 'boolean' },
  { id: 'coverage', label: 'The affected population and control scope are reconciled', type: 'boolean' },
  { id: 'exceptions', label: 'Exceptions are resolved or have documented acceptable treatment', type: 'boolean' },
  { id: 'operation_required', label: 'Operating-history assessment is required', type: 'boolean' },
  { id: 'operation_start', label: 'Confirmed effective-operation start', type: 'date', conditional: 'operation_required' },
  { id: 'operation_end', label: 'Operating evidence covers through', type: 'date', conditional: 'operation_required' },
  { id: 'required_days', label: 'Required operating days (record rationale)', type: 'integer', conditional: 'operation_required' },
  { id: 'required_cycles', label: 'Required operating cycles (record rationale)', type: 'integer', conditional: 'operation_required' },
  { id: 'observed_cycles', label: 'Evidenced operating cycles', type: 'integer', conditional: 'operation_required' },
  { id: 'retest_required', label: 'Independent retest is required', type: 'boolean' },
  { id: 'retest', label: 'Independent retest assessment', type: 'retest', conditional: 'retest_required' },
  { id: 'deadline', label: 'Confirmed finding deadline (optional)', type: 'date' },
] as const;
export const engineEntrySchema = z.object({ value: z.string().max(200), basis: z.string().max(2000), evidenceIds: z.array(z.string().uuid()).max(30), locator: z.string().max(500) }).strict();
export const engineDraftSchema = z.object({ version: z.enum(['0.1.0-candidate', '0.2.0-checklist-candidate', '0.3.0-checklist-candidate', '0.1.0-checklist-candidate']), protocolCode:z.string().min(1).max(100).optional(), entries: z.record(z.string(), engineEntrySchema), dateDecisions:z.record(z.string(),z.object({value:dateSchema,reason:z.string().max(2000),candidates:z.array(z.object({value:dateSchema,source:z.string().max(1000)}))}).strict()).optional() }).strict();
export type EngineDraft = z.infer<typeof engineDraftSchema>;
export const recommendationLabels = {
  not_closure_ready: 'Not closure ready', implemented_evidence_incomplete: 'Implemented but evidence incomplete', ready_for_retest: 'Ready for retest', closure_ready: 'Closure ready',
} as const;

