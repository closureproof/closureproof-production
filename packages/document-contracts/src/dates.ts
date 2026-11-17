// Normalise extracted date values, never infer dates from surrounding document text.
export function normaliseDate(value:unknown):string|null {
 if(typeof value!=='string'||!value.trim())return null;
 const raw=value.trim();let year:number,month:number,day:number;let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(match){[,year,month,day]=match.map(Number);}else{
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  match=raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s*,?\s*(\d{4})$/i);
  if(match){day=Number(match[1]);month=months.findIndex(name=>name===match![2].toLowerCase()||name.slice(0,3)===match![2].toLowerCase())+1;year=Number(match[3]);}
  else {match=raw.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})$/i);
   if(match){month=months.findIndex(name=>name===match![1].toLowerCase()||name.slice(0,3)===match![1].toLowerCase())+1;day=Number(match[2]);year=Number(match[3]);}
   else{match=raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);if(!match)return null;const a=Number(match[1]),b=Number(match[2]);if(a<=12&&b<=12&&a!==b)return null;day=a>12?a:b;month=a>12?b:a;year=Number(match[3]);}
  }
 }
 if(year!<1900||year!>9999||month!<1||month!>12||day!<1)return null;
 const date=new Date(Date.UTC(year!,month!-1,day!));if(date.getUTCFullYear()!==year!||date.getUTCMonth()+1!==month!||date.getUTCDate()!==day!)return null;
 return `${year!}-${String(month!).padStart(2,'0')}-${String(day!).padStart(2,'0')}`;
}
