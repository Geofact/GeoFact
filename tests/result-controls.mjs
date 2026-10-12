// Exercise explicit close/reopen actions when existing regressions inspect the map.
export async function closeResultForMap(page) {
 if(await page.locator('#resultDialog[open]').count())await page.click('#closeResult');
}
export async function clickOutsideResult(page, selector) {
 await closeResultForMap(page);await page.click(selector);
}
export async function clickResultAction(page, selector) {
 if(!await page.locator('#resultDialog[open]').count() && await page.locator('#reopenResult').isVisible())await page.click('#reopenResult');
 await page.click(selector);
}
