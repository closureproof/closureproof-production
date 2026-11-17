import {test,expect} from '@playwright/test';
test('submission-team findings are distinct from reviews and review links remain in the evidence library and queue',async({page,request})=>{
 const title='Submission team navigation '+test.info().project.name;
 const seed=await request.post('http://127.0.0.1:54330/rest/v1/rpc/cpp_test_ai_prepared_review',{data:{p_title:title}});expect(seed.ok()).toBe(true);const run=await seed.json();
 await page.goto('/app/findings');await page.getByLabel('Search findings',{exact:true}).fill(run.finding_id);
 await expect(page.getByRole('region',{name:'Your audit submissions'})).toBeVisible();await page.getByRole('button',{name:'View findings for '+title,exact:true}).click();
 await expect(page.getByText('Your submission',{exact:true})).toBeVisible();await page.getByRole('link').filter({hasText:title}).click();
 await expect(page).toHaveURL(new RegExp('/app/findings/'+run.finding_id+'$'));await expect(page.getByRole('link',{name:'Open review',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Edit finding',exact:true})).toBeVisible();
 await page.goto('/app/evidence');await page.getByLabel('Search submissions',{exact:true}).fill(run.finding_id);await page.getByRole('button',{name:'View evidence for '+title,exact:true}).click();
 const openReview=page.getByRole('link',{name:'Open review',exact:true});await expect(openReview).toHaveAttribute('href','/app/reviews/'+run.finding_id);await openReview.click();await expect(page.getByRole('heading',{name:'Inspect. Record. Explain.',exact:true})).toBeVisible();
 await page.goto('/app/reviews');await page.getByLabel('Search findings',{exact:true}).fill(run.finding_id);await expect(page.getByRole('region',{name:'Your audit submissions'})).toHaveCount(0);await page.getByRole('button',{name:'View findings for '+title,exact:true}).click();await expect(page.getByText('Submission reviews',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Open review',exact:true})).toHaveAttribute('href','/app/reviews/'+run.finding_id);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});
