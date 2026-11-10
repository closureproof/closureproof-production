import { expect, type Page } from '@playwright/test';
export async function openWorkspace(page: Page) {
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Closure overview', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
}
export async function openJudgementDetails(page: Page, exceptions: 'None identified' | 'Exceptions identified' = 'None identified') {
  const form=page.locator('[data-review-form]');
  await form.getByLabel('Scope and evidence assessment',{exact:true}).selectOption('Gaps identified');
  await form.getByLabel('Root cause and corrective-action assessment',{exact:true}).selectOption('Further assessment needed');
  await form.getByLabel('Are there exceptions?',{exact:true}).selectOption(exceptions);
  for(const label of ['Is population coverage review needed?','Is operating-history review needed?','Is an independent retest needed?'])if(await form.getByLabel(label,{exact:true}).count())await form.getByLabel(label,{exact:true}).selectOption('Required');
  if(await form.getByLabel('Coverage approach',{exact:true}).count())await form.getByLabel('Coverage approach',{exact:true}).selectOption('Full population');
}
export async function openConclusionDetails(page:Page){
 const form=page.locator('[data-review-form]');
 await form.getByLabel('Is follow-up required?',{exact:true}).selectOption('Required');
 await form.getByLabel('Are there limitations or judgement overrides?',{exact:true}).selectOption('Identified');
}
