import { File as NodeFile } from 'node:buffer';
import { validateDemoFile } from './manual-api';
import { vi } from 'vitest';
import { webcrypto } from 'node:crypto';
vi.stubGlobal('crypto', webcrypto);
function file(content: string, name: string) {
  return new NodeFile([content], name) as unknown as File;
}
it('rejects disguised PDF and malformed JSON before sending bytes to storage', async () => {
  await expect(validateDemoFile(file('not a PDF', 'bad.pdf'))).rejects.toThrow('not a PDF');
  await expect(validateDemoFile(file('{bad json', 'bad.json'))).rejects.toThrow(
    'JSON file is invalid',
  );
});
it('does not allow uploaded HTML or executable formats', async () => {
  await expect(validateDemoFile(file('<script>alert(1)</script>', 'unsafe.html'))).rejects.toThrow(
    'disabled',
  );
});
it('produces a content digest for an inert JSON upload', async () => {
  const result = await validateDemoFile(file('{"users":["one"]}', 'evidence.json'));
  expect(result.mime).toBe('application/json');
  expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
});
