import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {retryDemoNotifications} from '../../../../../lib/server/demo-requests';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request){const key=process.env.DEMO_NOTIFICATION_RETRY_TOKEN;const supplied=request.headers.get('authorization')||'';const expected='Bearer '+key;const providedBytes=Buffer.from(supplied),expectedBytes=Buffer.from(expected);
 if(!key||providedBytes.length!==expectedBytes.length||!timingSafeEqual(providedBytes,expectedBytes))return NextResponse.json({error:'Unauthorised'},{status:401});
 try{return NextResponse.json(await retryDemoNotifications(),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Notification retry unavailable.'},{status:503});}}
