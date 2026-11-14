import {test,expect} from '@playwright/test';
const backend='http://127.0.0.1:54330/rest/v1/';
async function get(request:any,table:string,filter:string){return (await(await request.get(backend+table+'?'+filter)).json());}
test('AI evidence prepares editable review fields and sources, then the engine completes with provenance and a report',async({page,request})=>{
 test.setTimeout(90000);
 const seed=await request.post(backend+'rpc/cpp_test_ai_prepared_review',{data:{p_title:'AI prepared access review '+test.info().project.name}});expect(seed.ok()).toBe(true);const run=await seed.json();
 await page.goto('/app/reviews/'+run.finding_id);
 await page.getByLabel('Reviewer',{exact:true}).fill('Reviewer Avery');
 await page.getByRole('checkbox',{name:/I confirm that the selected controls/}).check();
 let interrupted=false;
 await page.route('**/api/assessments/propose',async route=>{if(!interrupted){interrupted=true;await route.fulfill({status:504,contentType:'text/html',body:'<html>Gateway timeout</html>'});return;}await route.continue();});
 await page.getByRole('button',{name:'Prepare review from evidence',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Review preparation timed out.'})).toBeVisible();
 await expect(page.getByLabel('Reviewer',{exact:true})).toHaveValue('Reviewer Avery');
 await expect(page.getByRole('button',{name:'Use draft in review',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Prepare review from evidence',exact:true}).click();
 await expect(page.getByRole('button',{name:'Use draft in review',exact:true})).toBeVisible();
 const before=await get(request,'cpp_reviews','finding_id=eq.'+run.finding_id);expect(before).toHaveLength(0);
 await page.getByRole('button',{name:'Use draft in review',exact:true}).click();
 await expect(page.getByLabel('Scope and evidence assessment',{exact:true})).toHaveValue('Sufficient for this finding');
 await expect(page.getByLabel('Expected population',{exact:true})).toHaveValue('121');
 await expect(page.getByLabel('Reviewed population',{exact:true})).toHaveValue('121');
 await expect(page.getByLabel('Assessment: Every in-scope identity has a documented access decision',{exact:true})).toHaveValue('true');
 const steps=page.getByRole('navigation',{name:'Review steps'});
 await steps.getByRole('button',{name:'Evidence & checklist',exact:true}).click();
 const checks=page.locator('[data-protocol-check]');
 for(const check of await checks.all()){await expect(check.getByLabel(/: implementation status$/)).toHaveValue('implemented');await expect(check.getByLabel(/: source location$/)).toHaveValue(/access-review.pdf/);}
 await steps.getByRole('button',{name:'Recommendation & report',exact:true}).click();
 await expect(page.getByLabel('Review conclusion and rationale',{exact:true})).toHaveValue(/synthetic source records/i);
 await page.getByRole('button',{name:'Evaluate readiness',exact:true}).click();
 await expect(page.getByLabel('Engine recommendation disposition',{exact:true})).toBeVisible();
 await page.getByLabel('Engine recommendation disposition',{exact:true}).selectOption('accept');
 await page.getByRole('checkbox',{name:/I have explained the basis for closure readiness/}).check();
 await page.getByRole('button',{name:'Save review draft',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Manual review draft saved.'})).toBeVisible();
 await page.reload();await expect(page.getByLabel('Review conclusion and rationale',{exact:true})).toHaveValue(/synthetic source records/i);
 await page.getByRole('button',{name:'Evaluate readiness',exact:true}).click();await page.getByLabel('Engine recommendation disposition',{exact:true}).selectOption('accept');
 await page.getByRole('button',{name:'Complete Review',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download report PDF',exact:true})).toBeVisible();
 const [assessment]=await get(request,'cpp_reviews','finding_id=eq.'+run.finding_id+'&status=eq.completed');
 expect(assessment.data.ai_review_proposal_snapshot.reviewer).toBe('Reviewer Avery');expect(assessment.data.ai_review_proposal_snapshot.model).toBe('test-review-fixture');
 expect(assessment.data.ai_confirmed_facts[0].run_id).toBe(run.id);expect(assessment.data.rules_assessment.evaluation.recommendation).toBe('closure_ready');
 const [finding]=await get(request,'cpp_findings','id=eq.'+run.finding_id);expect(finding.lifecycle).toBe('review_completed');
 const response=await request.get(backend+'cpp_ai_review_proposals');expect(response.status()).toBe(403);
});
test('unsupported AI citations never populate or save review answers',async({page,request})=>{
 const seed=await request.post(backend+'rpc/cpp_test_ai_prepared_review',{data:{p_title:'Unsupported AI source '+test.info().project.name}});const run=await seed.json();
 await page.goto('/app/reviews/'+run.finding_id);await page.getByLabel('Reviewer',{exact:true}).fill('Reviewer Avery');
 await page.getByRole('button',{name:'Prepare review from evidence',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Review preparation could not be applied'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Use draft in review',exact:true})).toHaveCount(0);
 for(const check of await page.locator('[data-protocol-check]').all())await expect(check.getByLabel(/: implementation status$/)).toHaveValue('not_assessed');
 expect(await get(request,'cpp_reviews','finding_id=eq.'+run.finding_id)).toHaveLength(0);
});

test('a changed extracted fact invalidates the prepared assessment before immutable completion',async({page,request})=>{
 const seeded=await request.post(backend+'rpc/cpp_test_ai_prepared_review',{data:{p_title:'Stale AI preparation '+test.info().project.name}});const run=await seeded.json();
 await page.goto('/app/reviews/'+run.finding_id);await page.getByLabel('Reviewer',{exact:true}).fill('Reviewer Avery');await page.getByRole('checkbox',{name:/I confirm that the selected controls/}).check();
 await page.getByRole('button',{name:'Prepare review from evidence',exact:true}).click();await page.getByRole('button',{name:'Use draft in review',exact:true}).click();
 await page.getByRole('navigation',{name:'Review steps'}).getByRole('button',{name:'Recommendation & report',exact:true}).click();
 await expect(page.getByLabel('Engine recommendation disposition',{exact:true})).toBeVisible();await page.getByLabel('Engine recommendation disposition',{exact:true}).selectOption('accept');await page.getByRole('checkbox',{name:/I have explained the basis for closure readiness/}).check();
 const edited=await request.post(backend+'rpc/cpp_test_ai_confirmation',{data:{p_run:run.id,p_confirmation:{fact_index:0,decision:'corrected',value:'122 accounts, rather than 121, are in scope.',actor:'Reviewer Avery',reason:'Corrected population for stale-source contract testing.',source_checked:true}}});expect(edited.ok()).toBe(true);
 await page.getByRole('button',{name:'Complete Review',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Prepared review is stale'})).toBeVisible();
 expect(await get(request,'cpp_reviews','finding_id=eq.'+run.finding_id+'&status=eq.completed')).toHaveLength(0);
});

test('all submitted documents contribute more than twenty facts through batched preparation and completion',async({page,request})=>{
 test.setTimeout(120000);
 const seed=await request.post(backend+'rpc/cpp_test_ai_large_review',{data:{}});expect(seed.ok()).toBe(true);const {finding_id}=await seed.json();
 await page.goto('/app/reviews/'+finding_id);await page.getByLabel('Reviewer',{exact:true}).fill('Reviewer Avery');await page.getByRole('checkbox',{name:/I confirm that the selected controls/}).check();
 await page.getByRole('button',{name:'Prepare review from evidence',exact:true}).click();
 await page.getByRole('button',{name:'Use draft in review',exact:true}).click();
 await page.getByRole('navigation',{name:'Review steps'}).getByRole('button',{name:'Recommendation & report',exact:true}).click();
 await page.getByRole('button',{name:'Evaluate readiness',exact:true}).click();await page.getByLabel('Engine recommendation disposition',{exact:true}).selectOption('accept');await page.getByRole('checkbox',{name:/I have explained the basis for closure readiness/}).check();
 await page.getByRole('button',{name:'Complete Review',exact:true}).click();await expect(page.getByRole('button',{name:'Download report PDF',exact:true})).toBeVisible();
 const [assessment]=await get(request,'cpp_reviews','finding_id=eq.'+finding_id+'&status=eq.completed');
 expect(assessment.data.ai_confirmed_facts).toHaveLength(60);expect(new Set(assessment.data.ai_confirmed_facts.map((fact:any)=>fact.run_id)).size).toBe(2);
 expect(assessment.data.ai_review_proposal_snapshot.source_keys).toHaveLength(60);
});
