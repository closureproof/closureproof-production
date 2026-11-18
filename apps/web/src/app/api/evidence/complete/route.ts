import { z } from 'zod';
import { analysisAdmin, AnalysisError } from '../../../../lib/server/document-analysis';
import { failure, input, json } from '../../../../lib/server/analysis-http';
import { limitRequest } from '../../../../lib/server/request-limit';
import { validateEvidenceBytes } from '../../../../lib/server/evidence-validation';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = z
      .object({ id: z.string().uuid(), revision: z.number().int().positive() })
      .strict()
      .parse(await input(request));
    await limitRequest(request, 'upload');
    const admin = analysisAdmin();
    const { data: e, error } = await admin
      .from('cpp_evidence')
      .select('id,object_path,mime,byte_size,sha256,upload_state')
      .eq('id', body.id)
      .eq('organisation_id', '00000000-0000-4000-8000-000000000001')
      .single();
    if (error || !e || e.upload_state !== 'pending')
      throw new AnalysisError('Upload unavailable. Reload the finding before retrying.', 409);
    const file = await admin.storage.from('closureproof-pilot-evidence').download(e.object_path);
    if (file.error || !file.data) throw new AnalysisError('Uploaded evidence is unavailable.', 409);
    if (file.data.size > 25 * 1024 * 1024) throw new AnalysisError('Evidence exceeds 25 MB.', 413);
    try {
      validateEvidenceBytes(
        new Uint8Array(await file.data.arrayBuffer()),
        e.mime,
        Number(e.byte_size),
        e.sha256,
      );
    } catch {
      throw new AnalysisError(
        'Evidence content does not match its declared type, size or checksum. Choose a valid file.',
        400,
      );
    }
    const result = await admin.rpc('cpp_finalize_upload', {
      p_id: body.id,
      p_revision: body.revision,
    });
    if (result.error)
      throw new AnalysisError(
        'The upload could not be completed. Reload the finding and try again.',
        409,
      );
    return json({ accepted: true });
  } catch (error) {
    return failure(error);
  }
}
