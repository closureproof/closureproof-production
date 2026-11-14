import {test,expect} from '@playwright/test';
test('finding and multiple attachments submit together and a failed upload retries without duplicates',async({page,request})=>{
 const title='Combined submission '+test.info().project.name+' '+Date.now();
 await page.goto('/app/submission');await page.getByRole('button',{name:'Enter finding manually',exact:true}).click();
 await page.getByRole('checkbox',{name:/^A\.5\.18 ·/}).check();
 for(const [label,value]of [['Finding title',title],['Finding description','The privileged access review omitted identities.'],['Remediation owner','IT Operations'],['Source account / environment reference','SIM-AWS-PROD-01'],['Affected systems / environment','Production'],['Affected identities and resource references','DEMO-PRIV-001 through DEMO-PRIV-126']])await page.getByLabel(label,{exact:true}).fill(value);
 for(const [index,name]of ['population.txt','changes.txt'].entries()){
  await page.getByRole('button',{name:index?'Add more evidence':'Add evidence',exact:true}).click();
  await page.getByLabel('Evidence file to add',{exact:true}).setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from('Synthetic population and corrective action record: '+name)});
  await page.getByLabel('Evidence type',{exact:true}).fill(index?'Corrective change record':'Population review');
  await page.getByLabel('Source system',{exact:true}).fill('Synthetic AWS IAM');
  await page.getByLabel('Evidence description',{exact:true}).fill('Source evidence for the submitted access review finding.');
  if(index===0){await page.getByLabel('Capture date (if known)',{exact:true}).fill('2026-11-09');await page.getByLabel('Coverage period start (optional)',{exact:true}).fill('2026-11-09');await page.getByLabel('Coverage period end (optional)',{exact:true}).fill('2026-11-10');}
  await page.getByRole('button',{name:'Add to evidence list',exact:true}).click();
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.getByLabel('Evidence type',{exact:true})).toHaveCount(0);
 }
 let uploads=0;
 await page.route('**/storage/v1/object/closureproof-pilot-evidence/**',route=>{if(route.request().method()==='POST'){uploads++;if(uploads===2)return route.fulfill({status:503,json:{message:'Simulated upload interruption'}});}return route.continue();});
 await page.getByRole('button',{name:'Submit finding and evidence',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'The finding is saved, but'})).toContainText('The finding is saved, but submission has not finished.');
 await expect(page.getByRole('button',{name:'Retry remaining evidence',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Retry remaining evidence',exact:true}).click();
 await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'population.txt · v1',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'changes.txt · v1',exact:true})).toBeVisible();
 expect(uploads).toBe(3);
 const id=page.url().split('/').pop();const files=await(await request.get('http://127.0.0.1:54330/rest/v1/cpp_evidence?finding_id=eq.'+id+'&upload_state=eq.ready')).json();expect(files).toHaveLength(2);expect(files.find((file:{filename:string})=>file.filename==='population.txt').metadata.period_end).toBe('2026-11-10');expect(files.every((file:{metadata:{source_account:string}})=>file.metadata.source_account==='SIM-AWS-PROD-01')).toBe(true);
 const findings=await(await request.get('http://127.0.0.1:54330/rest/v1/cpp_findings')).json();expect(findings.filter((row:{details:{title:string}})=>row.details.title===title)).toHaveLength(1);
});
