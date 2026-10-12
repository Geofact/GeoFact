import assert from 'node:assert/strict';

// Exercise the same one-touch control as players, including its saved preference.
export async function setLanguage(page, language) {
 const button = page.locator('#lang');
 const reopen = !!await page.locator('#resultDialog[open]').count();
 if(reopen)await page.click('#closeResult');
 if (await button.getAttribute('value') !== language) await button.click();
 if(reopen)await page.click('#reopenResult');
 assert.equal(await button.getAttribute('value'), language);
}
