import catalogue from './iso27001-checklist.json';
import templates from './manual-protocols.json';
export interface ISOChecklistTask {
  id: string;
  title: string;
  area: string;
  category: string;
  page: number;
  pages: number[];
  requirement: string;
  type: string;
  frequency: string;
  reference: string;
  sourceRow: string;
  objective: string;
  evidence: string;
  sourceLocation: string;
  preparation: string;
  steps: { id: string; text: string }[];
  example: string;
}
export const ISO_PROTOCOL_VERSION = '1.0-iso27001';
export const isoChecklistTasks: ISOChecklistTask[] = catalogue.tasks;
export const isoChecklistManifest = catalogue.manifest;
const byId = new Map(isoChecklistTasks.map((task) => [task.id, task]));
export const isoProtocolTemplates = templates.map((protocol) => ({
  ...protocol,
  checks: protocol.checks.map((check) => ({ ...check, sourceTask: byId.get(check.sourceTaskId)! })),
}));

// Older pinned definitions retain their stored wording. Adapt vendor-specific
// source guidance for display without changing the assessment basis or user notes.
interface ChecklistPresentation {
  checks: { id: string; label: string; guidance: string; sourceTask?: ISOChecklistTask }[];
}
const importedVendor = /complyjet/i;
export function presentProtocol<T extends ChecklistPresentation>(protocol: T): T {
  return {
    ...protocol,
    checks: protocol.checks.map((check) => {
      const task = byId.get(check.sourceTask?.id || check.id.replace(/^iso-/, ''));
      if (!task) return check;
      let sourceTask = check.sourceTask;
      if (sourceTask) {
        sourceTask = { ...sourceTask };
        for (const key of Object.keys(task) as (keyof ISOChecklistTask)[]) {
          const previous = sourceTask[key];
          if (typeof previous === 'string' && importedVendor.test(previous)) {
            Object.assign(sourceTask, { [key]: task[key] });
          }
        }
        sourceTask.steps = sourceTask.steps.map((step) =>
          importedVendor.test(step.text)
            ? {
                ...step,
                text:
                  task.steps.find((current) => current.id === step.id)?.text ||
                  'Inspect dated source records for this item and record the evidence and limitations.',
              }
            : step,
        );
      }
      return {
        ...check,
        label: importedVendor.test(check.label) ? `${task.id} · ${task.title}` : check.label,
        guidance: importedVendor.test(check.guidance) ? task.objective : check.guidance,
        ...(sourceTask ? { sourceTask } : {}),
      };
    }),
  };
}
