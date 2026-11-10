import { expect, it } from 'vitest';
import { isoChecklistTasks, isoProtocolTemplates, presentProtocol } from './iso27001';
it('presents evidence guidance without the imported vendor or vendor-passing examples', () => {
  expect(JSON.stringify([isoChecklistTasks, isoProtocolTemplates])).not.toMatch(/complyjet/i);
  expect(isoChecklistTasks).toHaveLength(153);
  expect(isoChecklistTasks.reduce((count, task) => count + task.steps.length, 0)).toBe(626);
  expect(isoChecklistTasks.find(task => task.id === 'ACC-10')?.steps.map(step => step.text).join(' ')).toContain('access-review record');
});
it('adapts older pinned guidance without mutating source snapshots or changing IDs and versions', () => {
  const task = isoChecklistTasks.find(task => task.id === 'VUL-03')!;
  const historical = { version: '1.0-iso27001', checks: [{ id: 'iso-VUL-03', label: 'VUL-03 · Connect vulnerability findings to ComplyJet', guidance: 'ComplyJet pulls vulnerability findings.', sourceTask: { ...task, title: 'Connect vulnerability findings to ComplyJet', steps: task.steps.map((step, index) => index === 0 ? { ...step, text: 'Open the ComplyJet app.' } : step) } }] };
  const before = JSON.stringify(historical);
  const shown = presentProtocol(historical);
  expect(JSON.stringify(shown)).not.toMatch(/complyjet/i);
  expect(JSON.stringify(historical)).toBe(before);
  expect(shown.version).toBe(historical.version);
  expect(shown.checks[0].id).toBe('iso-VUL-03');
  expect(shown.checks[0].sourceTask.reference).toBe(task.reference);
  expect(shown.checks[0].label).toBe('VUL-03 · Record and track vulnerability findings');
});
