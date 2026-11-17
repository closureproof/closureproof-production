import {test,expect} from '@playwright/test';
test('public footer links to About and contact without exposing the workspace',async({page,isMobile})=>{
 await page.goto('/');const footer=page.getByRole('contentinfo');
 await expect(footer.getByRole('link',{name:'info@closureproof.com',exact:true})).toHaveAttribute('href','mailto:info@closureproof.com');
 await expect(footer.getByRole('link',{name:'Contact us',exact:true})).toHaveAttribute('href','mailto:info@closureproof.com');
 await expect(footer.getByRole('link',{name:'Request demo',exact:true})).toHaveAttribute('href','/request-demo');
 await footer.getByRole('link',{name:'About ClosureProof',exact:true}).click();await expect(page).toHaveURL(/\/about$/);
 await expect(page.getByRole('heading',{level:1,name:'A clear basis for closing audit findings.'})).toBeVisible();await expect(page).toHaveTitle('ClosureProof — About');
 await expect(page.getByText(/does not certify compliance or replace/)).toBeVisible();await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
 await expect(page.locator('a[href="/privacy"],a[href="/terms"]')).toHaveCount(0);
 if(isMobile){await expect(page.getByRole('navigation',{name:'Main navigation'}).locator('a[href="/request-demo"]').filter({hasText:'Request demo'})).toBeHidden();await page.getByRole('button',{name:'Toggle menu',exact:true}).click();const navigation=page.getByRole('navigation',{name:'Mobile navigation'});await expect(navigation.getByRole('link',{name:'About',exact:true})).toHaveAttribute('aria-current','page');await expect(navigation.getByRole('link',{name:'Platform',exact:true})).toHaveAttribute('href','/#platform');await navigation.getByRole('link',{name:'About',exact:true}).click();await expect(navigation).toHaveCount(0);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('contentinfo').getByRole('link',{name:'Request demo',exact:true}).click();await expect(page).toHaveURL(/\/request-demo$/);await expect(page.getByRole('heading',{name:'Request demo',exact:true})).toBeVisible();
});
