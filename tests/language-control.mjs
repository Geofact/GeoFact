import assert from 'node:assert/strict';

// Exercise the same one-touch control as players, including its saved preference.
export async function setLanguage(page, language) {
 const button = page.locator('#lang');
 if (await button.getAttribute('value') !== language) await button.click();
 assert.equal(await button.getAttribute('value'), language);
}
