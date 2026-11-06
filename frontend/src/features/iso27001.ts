import catalogue from './iso27001-checklist.json';
import templates from './manual-protocols.json';
export interface ISOChecklistTask {
  id: string; title: string; area: string; category: string; page: number; pages: number[];
  requirement: string; type: string; frequency: string; reference: string; sourceRow: string;
  objective: string; evidence: string; sourceLocation: string; preparation: string;
  steps: { id: string; text: string }[]; example: string;
}
export const ISO_PROTOCOL_VERSION = '1.0-iso27001';
export const isoChecklistTasks: ISOChecklistTask[] = catalogue.tasks;
export const isoChecklistManifest = catalogue.manifest;
const byId = new Map(isoChecklistTasks.map(task => [task.id, task]));
export const isoProtocolTemplates = templates.map(protocol => ({ ...protocol, checks: protocol.checks.map(check => ({ ...check, sourceTask: byId.get(check.sourceTaskId)! })) }));
