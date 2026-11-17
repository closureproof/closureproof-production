import {test,expect} from '@playwright/test';
test('reviewer resolves conflicting deadlines once and the date survives save, reload, evaluation and completion',async({page,request})=>{
 const seed=await request.post('http://127.0.0.1:54330/rest/v1/rpc/cpp_test_ai_date_review',{data:{}});expect(seed.ok()).toBe(true);const run=await seed.json();
 await page.goto('/app/reviews/'+run.finding_id);await page.getByLabel('Reviewer',{exact:true}).fill('Reviewer Avery');await page.getByRole('checkbox',{name:/I confirm that the selected controls/}).check();
 await page.getByRole('button',{name:'Prepare review from evidence',exact:true}).click();await page.getByRole('button',{name:'Use draft in review',exact:true}).click();
 const dates=page.locator('[data-review-dates]');await expect(dates.getByText(/Different dates are recorded/)).toBeVisible();
 await expect(page.getByLabel('Finding deadline used in assessment',{exact:true})).toHaveValue('2026-11-30');
 await expect(page.getByLabel('Assessment: Confirmed finding deadline (optional)',{exact:true})).toHaveCount(0);
 await page.getByLabel('Finding deadline: reason for selected date',{exact:true}).fill('The submission owner confirmed 30 November as the revised deadline.');
 await expect(dates.getByText(/Different dates are recorded/)).toHaveCount(0);
 await page.getByRole('button',{name:'Save review draft',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Manual review draft saved.'})).toBeVisible();
 await page.reload();await expect(page.getByLabel('Finding deadline used in assessment',{exact:true})).toHaveValue('2026-11-30');
 await page.getByRole('navigation',{name:'Review steps'}).getByRole('button',{name:'Recommendation & report',exact:true}).click();
 await page.getByRole('button',{name:'Evaluate readiness',exact:true}).click();await page.getByLabel('Engine recommendation disposition',{exact:true}).selectOption('accept');await page.getByRole('checkbox',{name:/I have explained the basis for closure readiness/}).check();
 await page.getByRole('button',{name:'Complete Review',exact:true}).click();await expect(page.getByRole('button',{name:'Download report PDF',exact:true})).toBeVisible();
 const [assessment]=await(await request.get('http://127.0.0.1:54330/rest/v1/cpp_reviews?finding_id=eq.'+run.finding_id+'&status=eq.completed')).json();
 expect(assessment.data.rules_assessment.input.facts.deadline.value).toBe('2026-11-30');expect(assessment.data.rules_assessment.input.facts.deadline.sources[0].kind).toBe('finding');expect(assessment.data.engine_draft.dateDecisions.deadline.reason).toContain('submission owner');
});

test('an extracted written date populates the finding date input and ambiguous dates request clarification',async({page,request})=>{
 const seed=await request.post('http://127.0.0.1:54330/rest/v1/rpc/cpp_test_ai_report',{data:{}});const run=await seed.json();
 run.result.findings[0].fields.deadline='18 December 2026';run.result.findings[0].sources.push({field:'deadline',quote:'Deadline 18 December 2026',locator:'Finding deadline',page:1});
 await page.route('**/api/document-analysis/'+run.id,route=>route.fulfill({json:run}));
 await page.goto('/app/findings/new?analysis='+run.id+'&draft=0');await expect(page.getByLabel('Finding deadline (optional)',{exact:true})).toHaveValue('2026-12-18');
 run.result.findings[0].fields.deadline='03/04/2026';await page.reload();await expect(page.getByLabel('Finding deadline (optional)',{exact:true})).toHaveValue('');await expect(page.getByText(/extracted deadline needs clarification/)).toBeVisible();
});
