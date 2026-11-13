import { details, publicRun } from '../../../../lib/server/document-analysis';
import { failure, json } from '../../../../lib/server/analysis-http';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{return json(publicRun(await details((await params).id)));}catch(error){return failure(error);}}
