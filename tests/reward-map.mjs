import {currentSave} from './save-fixtures.mjs';
import {setLanguage} from './language-control.mjs';
export async function testRewardMap({newContext,url,check,equal,output}){
 const origin=new URL(url).origin;
 if(output)await (await import('node:fs/promises')).mkdir(output,{recursive:true});
 const snapshot=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');const repo=await openRewardRepository();try{return await repo.read();}finally{repo.close();}});
 const local=p=>p.evaluate(()=>JSON.stringify({...localStorage}));
 for(const [width,iso] of [[320,'VAT'],[390,'TUV'],[1280,'USA'],[390,'FRA'],[1280,'JPN']]){
  console.log('Reward map:',width,iso);
  const seed={...currentSave,'gf-daily-v1':JSON.stringify({days:{},played:0,streak:0,bestStreak:0})};
  const ctx=await newContext({viewport:{width,height:850},hasTouch:width<600,isMobile:width<600,reducedMotion:'reduce',locale:'fr-FR',storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(seed).map(([name,value])=>({name,value}))}]}});
  try{
   const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-07T10:00:00Z')});await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();await p.evaluate(async iso=>{const {openRewardRepository}=await import('./reward-repository.mjs');const r=await openRewardRepository();await r.activateDaily(localStorage);await r.completeDaily({day:GeoFactCore.dailyKey(),number:1,score:94,tiles:['green','green','yellow','green','green'],errors:2,at:Date.now(),card:{iso,rarity:'gold'}});r.close();window.dispatchEvent(new Event('focus'));},iso);await p.click('#chooseDaily');await p.locator('#final').waitFor();
   check(await p.locator('#finalSeeCountryMap').isHidden(),'map action absent before chest reveal');await p.click('#openChest');await p.locator('#cardReveal').waitFor({state:'visible'});
   equal(await p.locator('#final .final-actions button:visible').count(),4,'four revealed reward actions');
   check(await p.locator('#final .final-actions').evaluate(e=>getComputedStyle(e).display==='grid'&&getComputedStyle(e).gridTemplateColumns.split(' ').length===2),'2×2 action grid');
   const boxes=await p.locator('#final .final-actions button:visible').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));check(boxes[0].top===boxes[1].top&&boxes[2].top===boxes[3].top&&boxes[2].top>boxes[0].top,'two centred action rows');
   for(const lang of ['fr','en']){
    await setLanguage(p,lang);const before=await snapshot(p),saved=await local(p),score=await p.locator('#finalScore').textContent(),view=await p.locator('#map').getAttribute('viewBox');
    await p.click('#finalSeeCountryMap');await p.locator('#countryMapDialog[open]').waitFor();
    equal(await p.locator('#countryMapName').textContent(),await p.evaluate(({iso,lang})=>GeoFactCountries.find(c=>c.iso===iso).name[lang],{iso,lang}),'drawn country name, not last quiz answer');
    check(await p.locator(`#countryLookupMap [data-iso="${iso}"].country-found`).count()>0,'drawn country highlighted');equal(await p.locator('#countryLookupMap .country-location-pin').count(),1,'one exact location pin');equal(await p.locator('#countryLookupMap [tabindex="0"]').count(),0,'read-only map has no inert country buttons in keyboard navigation');
    const box=await p.locator('#countryMapDialog').boundingBox();check(box.x>=0&&box.x+box.width<=width+1&&box.height<=826,'location dialog fits viewport');check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow');
    const beforeZoom=await p.locator('#countryLookupMap').getAttribute('viewBox');await p.click('#countryMapZoomIn');check(await p.locator('#countryLookupMap').getAttribute('viewBox')!==beforeZoom,'lookup zoom works');await p.click('#countryMapWorld');equal(await p.locator('#countryLookupMap').getAttribute('viewBox'),'0 0 1200 600','world context available');await p.click('#countryMapRefocus');
    const r=await p.locator('#countryLookupMap').boundingBox();if(width<600)await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);else await p.mouse.click(r.x+r.width/2,r.y+r.height/2);
    equal(await snapshot(p),before,'lookup creates no reward or save mutation');equal(await local(p),saved,'lookup preserves all localStorage bytes');equal(await p.locator('#finalScore').textContent(),score,'lookup cannot change score');equal(await p.locator('#map').getAttribute('viewBox'),view,'quiz map remains untouched');
    if(output&&lang==='fr')await p.screenshot({path:`${output}/reward-map-${width}-${iso}.png`});
    await p.keyboard.press('Escape');check(await p.locator('#countryMapDialog').isHidden(),'Escape returns to reward');equal(await p.evaluate(()=>document.activeElement.id),'finalSeeCountryMap','focus restored to action');check(await p.locator('#cardReveal').isVisible(),'drawn card remains visible');
   }
   await setLanguage(p,'fr');
   if(output)await p.locator('#final .final-actions').screenshot({path:`${output}/reward-actions-${width}-${iso}.png`});
   await p.click('#finalExploreCollection');await p.locator('#collection').waitFor();equal(await p.locator('#collection').getAttribute('data-view'),await p.evaluate(iso=>GeoFactAlbum.createAlbum(GeoFactCountries,Object.keys(GeoFactFlagCards)).regionOf(iso),iso),'collection action opens drawn continent');
  }finally{await ctx.close();}
 }
 // Bonus chest: lookup returns to the same revealed card and never advances the practice round.
 const ctx=await newContext({viewport:{width:390,height:850},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 try{
  const p=await ctx.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
  await p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');const r=await openRewardRepository();for(let i=0;i<10;i++)await r.answer({id:'lookup-test-'+i,roundId:'lookup-round-'+i,mode:'practice',at:Date.now(),correct:true,countryDraw:0,rarityDraw:.5},['VAT']);r.close();window.dispatchEvent(new Event('focus'));});
  await p.click('#choosePractice');await p.click('#practiceByDifficulty');await p.click('[data-level="easy"]');await p.locator('#playing').waitFor({state:'visible'});const question=await p.locator('#countryName').textContent(),points=await p.locator('#roundPoints').textContent(),quizView=await p.locator('#map').getAttribute('viewBox');await p.locator('#openPracticeBonusRewards').waitFor({state:'visible'});await p.click('#openPracticeBonusRewards');await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor({state:'visible'});const action=p.locator('#bonusCardReveal [data-country-map]'),iso=await action.getAttribute('data-country-map'),before=await snapshot(p),saved=await local(p);
  await action.click();await p.locator('#countryMapDialog[open]').waitFor();check(!await p.locator('#bonusDialog').evaluate(e=>e.open),'one native dialog at a time');check(await p.locator(`#countryLookupMap [data-iso="${iso}"].country-found`).count()>0,'bonus draws correct country');
  await p.click('#closeCountryMap');await p.locator('#bonusDialog[open]').waitFor();check(await p.locator('#bonusCardReveal').isVisible(),'returns to same opened bonus');equal(await snapshot(p),before,'bonus consultation gives no second card');equal(await local(p),saved,'bonus consultation preserves storage');await p.click('#closeBonusRewards');equal(await p.locator('#countryName').textContent(),question,'practice question never advances');equal(await p.locator('#roundPoints').textContent(),points,'practice score untouched');equal(await p.locator('#map').getAttribute('viewBox'),quizView,'practice zoom untouched');check(!await p.locator('#result').isVisible(),'no accidental practice answer');
 }finally{await ctx.close();}
}
