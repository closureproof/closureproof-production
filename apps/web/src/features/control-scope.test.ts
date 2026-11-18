import { describe, it, expect } from 'vitest';
import { scopeCatalogue, controlThemes, emptyScope, previewScope } from './control-scope';
import { isoChecklistTasks } from './iso27001';
describe('control-based review scope', () => {
  it('keeps all workbook controls visible and validates every configured task mapping', () => {
    expect(scopeCatalogue.controls).toHaveLength(93);
    for (const c of scopeCatalogue.controls)
      for (const id of c.task_ids) expect(isoChecklistTasks.some((t) => t.id === id)).toBe(true);
  });
  it('groups all controls into the four workbook themes with the expected totals', () => {
    const expected: Record<string, number> = {
      Organisational: 37,
      People: 8,
      Physical: 14,
      Technological: 34,
    };
    expect(controlThemes.map((t) => t.name)).toEqual(Object.keys(expected));
    for (const theme of controlThemes)
      expect(scopeCatalogue.controls.filter((c) => c.theme === theme.name)).toHaveLength(
        expected[theme.name],
      );
    expect(
      scopeCatalogue.controls.every((c) => controlThemes.some((t) => t.name === c.theme)),
    ).toBe(true);
    expect(new Set(scopeCatalogue.controls.map((c) => c.id)).size).toBe(93);
  });
  it('isolates access and backup checks', () => {
    const access = previewScope('access', { ...emptyScope(), control_ids: ['A.5.18'] });
    const backup = previewScope('backup', { ...emptyScope(), control_ids: ['A.8.13'] });
    expect(access.tasks.some((t) => t.id === 'ACC-10')).toBe(true);
    expect(access.tasks.some((t) => t.id === 'DOC-14')).toBe(false);
    expect(backup.tasks.map((t) => t.id)).toEqual(['DOC-01', 'DOC-14']);
    expect(access.modules.some((m) => m.id === 'retest')).toBe(false);
  });
  it('combines shared tasks once and preserves additional modules', () => {
    const combined = previewScope('access', {
      ...emptyScope(),
      control_ids: ['A.5.18', 'A.6.5'],
      additional_modules: ['retest'],
    });
    expect(combined.tasks.filter((t) => t.id === 'ACC-05')).toHaveLength(1);
    expect(combined.modules.some((m) => m.id === 'retest')).toBe(true);
  });
  it('shows provisional defaults rather than an empty unknown-control checklist', () => {
    for (const ids of [[], ['A.5.4']]) {
      const result = previewScope('access', { ...emptyScope(), control_ids: ids });
      expect(result.provisional).toBe(true);
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.modules).toHaveLength(7);
    }
  });
  it('keeps core sections when a request attempts to exclude one', () => {
    const result = previewScope('access', {
      ...emptyScope(),
      control_ids: ['A.5.18'],
      excluded_modules: { scope: 'Invalid attempt', operation: 'One-time action only' },
    });
    expect(result.modules.some((m) => m.id === 'scope')).toBe(true);
    expect(result.modules.some((m) => m.id === 'operation')).toBe(false);
  });
});
