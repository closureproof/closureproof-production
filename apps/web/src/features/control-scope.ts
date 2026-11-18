import catalogue from './control-scope-catalogue.json';
import { isoChecklistTasks, isoProtocolTemplates } from './iso27001';
import {
  judgementSections,
  simplifiedJudgementSections,
  progressiveJudgementSections,
  JUDGEMENT_VERSION,
  SIMPLIFIED_JUDGEMENT_VERSION,
  type ClosureJudgement,
  type JudgementSection,
} from './review-judgement';
export const scopeCatalogue = catalogue;
export const scopeModules = judgementSections;
export const controlThemes = [
  {
    name: 'Organisational',
    description: 'Policies, governance, supplier relationships and organisational processes.',
  },
  { name: 'People', description: 'Responsibilities, awareness and employment-related controls.' },
  { name: 'Physical', description: 'Premises, equipment and physical protection.' },
  {
    name: 'Technological',
    description: 'Systems, access, infrastructure and technical safeguards.',
  },
] as const;
export interface ScopeRequest {
  version: string;
  control_ids: string[];
  unknown_reason: string;
  additional_task_ids: string[];
  excluded_tasks: Record<string, string>;
  additional_modules: string[];
  excluded_modules: Record<string, string>;
}
export interface ReviewScope extends ScopeRequest {
  provisional: boolean;
  task_ids: string[];
  modules: string[];
  controls: { id: string; title: string }[];
  task_controls: Record<string, string[]>;
  module_exclusions: Record<string, string>;
  actor: string;
  reason: string;
  recorded_at: string;
}
export const emptyScope = (): ScopeRequest => ({
  version: catalogue.version,
  control_ids: [],
  unknown_reason: '',
  additional_task_ids: [],
  excluded_tasks: {},
  additional_modules: [],
  excluded_modules: {},
});
export function previewScope(category: string, input: ScopeRequest) {
  const controls = catalogue.controls.filter((c) => input.control_ids.includes(c.id));
  const provisional = !controls.length || controls.some((c) => c.status === 'unmapped');
  const tasks = new Set(controls.flatMap((c) => c.task_ids));
  if (provisional)
    for (const check of isoProtocolTemplates.find((p) => p.code === category)?.checks || [])
      tasks.add(check.sourceTaskId);
  for (const id of input.additional_task_ids) tasks.add(id);
  const modules = new Set([
    ...catalogue.core_modules,
    ...controls.flatMap((c) => c.modules),
    ...input.additional_modules,
  ]);
  if (provisional) for (const id of catalogue.conditional_modules) modules.add(id);
  const taskIds = [...tasks].filter((id) => !(id in input.excluded_tasks)).sort();
  const includedModules = [...modules].filter(
    (id) => catalogue.core_modules.includes(id) || !(id in input.excluded_modules),
  );
  return {
    controls,
    provisional,
    tasks: isoChecklistTasks.filter((t) => taskIds.includes(t.id)),
    modules: scopeModules.filter((m) => includedModules.includes(m.id)),
    baseTaskIds: [...tasks],
    baseModules: [...modules],
  };
}
export function activeSections(
  protocol: { review_scope?: ReviewScope },
  judgement?: ClosureJudgement,
): JudgementSection[] {
  const sections: JudgementSection[] =
    judgement?.version === JUDGEMENT_VERSION
      ? progressiveJudgementSections
      : judgement?.version === SIMPLIFIED_JUDGEMENT_VERSION
        ? simplifiedJudgementSections
        : (judgementSections as unknown as JudgementSection[]);
  return protocol.review_scope
    ? sections.filter((s) => protocol.review_scope!.modules.includes(s.id))
    : sections;
}
