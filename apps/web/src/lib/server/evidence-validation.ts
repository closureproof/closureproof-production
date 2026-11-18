import { createHash } from 'node:crypto';
import { DOCX_MIME } from '@closureproof/document-contracts';
import { validateDocumentBytes } from './document-analysis';
export function validateEvidenceBytes(
  bytes: Uint8Array,
  mime: string,
  expectedSize: number,
  expectedHash: string,
) {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024 || bytes.length !== expectedSize)
    throw Error('Evidence size does not match the upload.');
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash)
    throw Error('Evidence checksum does not match the upload.');
  if (mime === 'application/pdf' || mime === DOCX_MIME) {
    validateDocumentBytes(bytes, mime);
    return;
  }
  if (mime === 'image/png') {
    if ([137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v))
      throw Error('Invalid PNG evidence.');
    return;
  }
  if (mime === 'image/jpeg') {
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
      throw Error('Invalid JPEG evidence.');
    return;
  }
  if (!['text/plain', 'text/csv', 'application/json'].includes(mime))
    throw Error('Unsupported evidence file type.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0')) throw Error('Invalid text evidence.');
  if (mime === 'application/json') JSON.parse(text);
}
