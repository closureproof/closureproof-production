import { test, expect } from '@playwright/test';
import { openWorkspace } from './helpers';

test('all existing sidebar sections open their own real-data pages', async ({ page, isMobile }) => {
 await openWorkspace(page);
 const destinations=[['Overview','','Closure overview'],['Findings','/findings','Findings'],['Evidence library','/evidence','Evidence library'],['Manual upload','/submission','Submit a finding'],['Closure protocols','/protocols','Closure protocols'],['Reviewer queue','/reviews','Reviewer queue'],['Decision history','/history','Decision history'],['Closure packs','/exports','Closure packs'],['Integrations','/integrations','Integrations'],['Members','/members','Members'],['Organisation','/settings','Organisation settings']];
 for(const [label,suffix,heading]of destinations){
  if(isMobile)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name:label,exact:label!=='Reviewer queue'}).click();
  await expect(page).toHaveURL(new RegExp('/app'+suffix+'$'));
  await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
 }
 for(const alias of ['/dashboard.html','/preview','/workbench']){await page.goto(alias);await expect(page).toHaveURL(/\/app$/);await expect(page.getByRole('heading',{name:'Closure overview',exact:true})).toBeVisible();}
});
