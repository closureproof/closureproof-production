import { expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { DOCX_MIME } from '@closureproof/document-contracts';
vi.mock('server-only', () => ({}));
import { validateEvidenceBytes } from './evidence-validation';
function check(
  bytes: Uint8Array,
  mime: string,
  hash = createHash('sha256').update(bytes).digest('hex'),
) {
  validateEvidenceBytes(bytes, mime, bytes.length, hash);
}
it('accepts literal text and rejects checksum, signature and type spoofing', () => {
  const bytes = strToU8('<script>not executable text</script>');
  expect(() => check(bytes, 'text/plain')).not.toThrow();
  expect(() => check(bytes, 'text/plain', 'a'.repeat(64))).toThrow('checksum');
  expect(() => check(bytes, 'application/pdf')).toThrow();
  expect(() => check(bytes, 'image/png')).toThrow();
  expect(() => check(bytes, 'application/x-msdownload')).toThrow();
});
it('checks JSON syntax and DOCX archives on the server', () => {
  expect(() => check(strToU8('{bad}'), 'application/json')).toThrow();
  expect(() =>
    check(
      zipSync({
        '[Content_Types].xml': strToU8(''),
        'word/document.xml': strToU8(''),
        'word/vbaProject.bin': strToU8('macro'),
      }),
      DOCX_MIME,
    ),
  ).toThrow();
});
