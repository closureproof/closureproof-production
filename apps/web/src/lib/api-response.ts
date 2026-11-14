/** Read API results without exposing HTML error pages or browser JSON errors. */
export class ApiResponseError extends Error {
  constructor(message:string,readonly status:number){super(message);this.name='ApiResponseError';}
}
export async function readApiResponse<T>(response:Response,operation:string):Promise<T>{
  const unchanged='Your existing review has not been changed.';
  const fallback=response.status===408||response.status===504
    ? `${operation} timed out. ${unchanged} Please try again.`
    : response.status===401||response.status===403
    ? `${operation} was blocked by the server. Refresh the page and try again.`
    : response.status===404
    ? `${operation} is unavailable at this address. Refresh the application. If this continues, check the deployed application routes.`
    : response.status===429
    ? `${operation} is temporarily busy. Please wait before trying again.`
    : response.status>=500
    ? `${operation} is temporarily unavailable. ${unchanged} Please try again.`
    : `${operation} returned an unreadable response. ${unchanged} Refresh the page and try again.`;
  let data:unknown;
  try{data=JSON.parse(await response.text());}catch{throw new ApiResponseError(fallback,response.status);}
  if(!response.ok){
    const error=data&&typeof data==='object'&&!Array.isArray(data)?(data as Record<string,unknown>).error:undefined;
    throw new ApiResponseError(typeof error==='string'&&error.trim()?error:fallback,response.status);
  }
  if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiResponseError(fallback,response.status);
  return data as T;
}
