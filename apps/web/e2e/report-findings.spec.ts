import {test,expect} from '@playwright/test';
const backend='http://127.0.0.1:54330';
test('multiple findings retain independent forms and evidence while switching and can both be submitted',async({page,request})=>{
 const seeded=await request.post(backend+'/rest/v1/rpc/cpp_test_ai_multi_report',{data:{}});expect(seeded.ok()).toBeTruthy();const run=await seeded.json();
 await page.route('**/api/document-analysis/'+run.id,async route=>{const rows=await(await request.get(backend+'/rest/v1/cpp_findings')).json();const submissions=rows.filter((row:any)=>row.details.source_report?.run_id===run.id).map((row:any)=>({draft_index:row.details.source_report.draft_index,finding_id:row.id}));return route.fulfill({json:{...run,submissions}});});
 await page.goto('/app/submission/report/'+run.id);
 await expect(page.getByText('0 of 2 findings created',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review draft finding 1',exact:true}).click();
 const form=page.locator('[data-report-draft]:visible');
 async function fill(category:string,control:string,title:string,evidence:string){
  await form.getByLabel('Finding title',{exact:true}).fill(title);await form.getByLabel('Finding category',{exact:true}).selectOption(category);await form.getByRole('checkbox',{name:new RegExp('^'+control.replaceAll('.','\\.')+' ·')}).check();
  for(const [label,value]of [['Remediation owner','IT Operations'],['Source account / environment reference','SIM-'+category],['Affected systems / environment','Production'],['Affected identities and resource references',category+' resources'],['Draft confirmed by','Submitter Casey']])await form.getByLabel(label,{exact:true}).fill(value);
  await form.getByLabel('Severity',{exact:true}).selectOption('High');await form.getByRole('checkbox',{name:/I checked the audit report/}).check();
  await page.getByRole('button',{name:'Add evidence',exact:true}).click();await form.getByLabel('Evidence file to add',{exact:true}).setInputFiles({name:evidence,mimeType:'text/plain',buffer:Buffer.from('Synthetic supporting evidence specific to '+category)});
  await form.getByLabel('Evidence type',{exact:true}).fill(category+' remediation');await form.getByLabel('Source system',{exact:true}).fill('Synthetic '+category);await form.getByLabel('Evidence description',{exact:true}).fill('Independent evidence attachment for '+category+' finding.');await page.getByRole('button',{name:'Add to evidence list',exact:true}).click();await expect(page.getByRole('heading',{name:evidence,exact:true})).toBeVisible();
 }
 await fill('access','A.5.18','Access finding with retained edits','access-remediation.txt');
 await page.getByRole('button',{name:'Finding 2',exact:true}).click();
 await expect(form.getByLabel('Finding title',{exact:true})).toHaveValue('Backup restoration test omitted a workload');
 await fill('backup','A.8.13','Backup finding with retained edits','backup-remediation.txt');
 await page.getByRole('button',{name:'Finding 1',exact:true}).click();
 await expect(form.getByLabel('Finding title',{exact:true})).toHaveValue('Access finding with retained edits');await expect(form.getByLabel('Finding category',{exact:true})).toHaveValue('access');await expect(page.getByRole('heading',{name:'access-remediation.txt',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'backup-remediation.txt',exact:true})).toBeHidden();
 await form.getByRole('button',{name:'Submit finding and evidence',exact:true}).click();await expect(page.getByText('1 of 2 findings created',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Continue with next finding',exact:true}).click();
 await expect(form.getByLabel('Finding title',{exact:true})).toHaveValue('Backup finding with retained edits');await expect(form.getByLabel('Finding category',{exact:true})).toHaveValue('backup');await expect(page.getByRole('heading',{name:'backup-remediation.txt',exact:true})).toBeVisible();
 await form.getByRole('button',{name:'Submit finding and evidence',exact:true}).click();await expect(page.getByText('2 of 2 findings created',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to report findings',exact:true}).click();await expect(page.getByRole('link',{name:'Open finding and evidence',exact:true})).toHaveCount(2);
 const all=await(await request.get(backend+'/rest/v1/cpp_findings')).json();const findings=all.filter((row:any)=>row.details.source_report?.run_id===run.id);expect(findings).toHaveLength(2);expect(new Set(findings.map((row:any)=>row.details.source_report.draft_index)).size).toBe(2);
 for(const finding of findings){const files=await(await request.get(backend+'/rest/v1/cpp_evidence?finding_id=eq.'+finding.id+'&upload_state=eq.ready')).json();expect(files).toHaveLength(1);expect(files[0].filename).toBe(finding.details.protocol_code==='access'?'access-remediation.txt':'backup-remediation.txt');}
 await page.getByRole('link',{name:'Open finding and evidence',exact:true}).first().click();await page.getByRole('link',{name:'Back to report findings',exact:true}).click();await expect(page.getByText('2 of 2 findings created',{exact:true})).toBeVisible();
});
