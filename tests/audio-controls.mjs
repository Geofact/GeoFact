import {closeResultForMap} from './result-controls.mjs';
export async function setAudioEnabled(page,value){
 await closeResultForMap(page);
 if(await page.locator('#audioPanel').isHidden())await page.click('#toggleSound');
 await page.locator('#toggleMusic').setChecked(value);
 await page.locator('#toggleEffects').setChecked(value);
 await page.keyboard.press('Escape');
}
export async function toggleAudioEnabled(page){await setAudioEnabled(page,(await page.locator('#toggleSound').getAttribute('data-muted'))==='true');}
