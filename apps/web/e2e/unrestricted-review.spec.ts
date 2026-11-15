import {test,expect} from '@playwright/test';
for(const recommendation of ['Closure ready','Not closure ready'])test('temporary completion saves '+recommendation+' and generates a report without assessment prerequisites',async({page,request})=>{
 const seeded=await request.post('http://127.0.0.1:54330/rest/v1/rpc/cpp_test_ai_evidence',{data:{}});expect(seeded.ok()).toBe(true);const run=await seeded.json();
 await page.goto('/app/reviews/'+run.finding_id);
 await page.getByRole('navigation',{name:'Review steps'}).getByRole('button',{name:'Recommendation & report',exact:true}).click();
 await page.getByLabel('Reviewer recommendation (manually selected)',{exact:true}).selectOption(recommendation);
 await page.getByRole('button',{name:'Complete Review',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download report PDF',exact:true})).toBeVisible();
 const response=await request.get('http://127.0.0.1:54330/rest/v1/cpp_reviews?finding_id=eq.'+run.finding_id+'&status=eq.completed');const [assessment]=await response.json();
 expect(assessment.data.recommendation).toBe(recommendation);expect(assessment.data.completion_validation).toBe('suspended');expect(assessment.data.rules_assessment).toBeUndefined();
 expect(assessment.data.checks.every((check:any)=>check.implementation_status==='not_assessed')).toBe(true);
});
