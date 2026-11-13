import { listRuns, prepareAnalysis, publicRun } from '../../../lib/server/document-analysis';
import { failure, input, json } from '../../../lib/server/analysis-http';
export const runtime='nodejs';
export async function GET(request:Request){try{const rows=await listRuns(new URL(request.url).searchParams.get('finding'));return json({runs:rows?.map(publicRun)||[]});}catch(error){return failure(error);}}
export async function POST(request:Request){try{const result=await prepareAnalysis(await input(request));return json({...result,run:publicRun(result.run)});}catch(error){return failure(error);}}
