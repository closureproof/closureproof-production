import {test,expect} from '@playwright/test';
const rest='http://127.0.0.1:54330/rest/v1/rpc/';
const headers={apikey:'sb_publishable_test_only','Content-Type':'application/json'};
test('reviewer requests corrections and evidence; submitter responds and reviewer verifies without changing scope',async({page,request})=>{
 const seed=await request.post(rest+'cpp_test_ai_evidence',{headers,data:{}});expect(seed.ok()).toBeTruthy();const run=await seed.json();
 const review='/app/reviews/'+run.finding_id,finding='/app/findings/'+run.finding_id;
 await page.goto(review);
 await expect(page.getByRole('button',{name:'Amend review scope',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Adopt control-based scope',exact:true})).toHaveCount(0);
 for(const [button,field,message] of [['Request scope correction','Requested scope correction','Please include independent retest and confirm the affected account scope.'],['Request more evidence','Evidence required and requested actions','Provide the dated account reconciliation and completed review approvals.']]){
  await page.getByRole('button',{name:button,exact:true}).click();
  await page.getByLabel('Request recorded by',{exact:true}).fill('Reviewer Taylor');
  await page.getByLabel('Reason for request',{exact:true}).fill('The current submission does not establish the required review basis.');
  await page.getByLabel(field,{exact:true}).fill(message);
  await page.getByRole('button',{name:'Send request',exact:true}).click();
  await expect(page.getByText('Request recorded. The finding scope and recommendation have not changed.',{exact:true})).toBeVisible();
 }
 await page.reload();await expect(page.getByRole('button',{name:'Request scope correction',exact:true})).toBeVisible();
 await page.goto(finding);
 await expect(page.getByText('Please include independent retest and confirm the affected account scope.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Respond to request',exact:true}).first().click();
 await page.getByLabel('Request recorded by',{exact:true}).fill('IT Owner');
 await page.getByLabel('Response and supporting references',{exact:true}).fill('The additional records are being obtained; this response does not claim completion.');
 await page.getByRole('button',{name:'Send response',exact:true}).click();
 await expect(page.getByText('Response recorded for reviewer verification.',{exact:true})).toBeVisible();
 await page.goto(review);
 await page.getByRole('button',{name:'Verify response',exact:true}).click();
 await page.getByLabel('Request recorded by',{exact:true}).fill('Reviewer Taylor');
 await page.getByLabel('Verification and resolution notes',{exact:true}).fill('The request has been discussed; additional follow-up will be recorded separately.');
 await page.getByRole('button',{name:'Resolve request',exact:true}).click();
 await expect(page.getByText('Request resolved. This does not complete the review or close the finding.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Complete Review',exact:true})).toHaveCount(0);
});
