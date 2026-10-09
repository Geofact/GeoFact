// Home-only visual and navigation regressions; all contexts use the HTTP/mock harness.
import {mkdir} from 'node:fs/promises';
import {currentSave} from './save-fixtures.mjs';
export async function testHomeRedesign({newContext,url,tap,check,equal}) {
 console.log('Home redesign: FR/EN, 320/375/390px, real Daily states and unchanged saves…');
 const captures=process.env.HOME_CAPTURE_DIR;
 if(captures)await mkdir(captures,{recursive:true});
 const origin=new URL(url).origin;
 const snapshot=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');const r=await openRewardRepository();try{return await r.read();}finally{r.close();}});
 for(const width of [1280,320,375,390])for(const lang of ['fr','en']) {
  const seed={...currentSave,'wg-lang':lang};
  const ctx=await newContext({viewport:{width,height:900},locale:lang==='fr'?'fr-FR':'en-US',storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(seed).map(([name,value])=>({name,value}))}]}});
  try {
   const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-09T11:59:59Z')});await p.clock.pauseAt(new Date('2026-10-09T12:00:00Z'));await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
   const before=await snapshot(p);
   equal(await p.locator('#chooseDaily').textContent(),lang==='fr'?'Jouer le Daily':'Play the Daily','available Daily action');
   equal(await p.locator('#homeBonusProgress').count(),1,'one real bonus counter');check(!(await p.locator('#homeBonusProgress').textContent()).includes('/10'),'no home streak');
   check((await p.locator('#homeBonusProgress').textContent()).includes(lang==='fr'?'obtenus':'earned'),'quota meaning explicit');
   equal(await p.locator('.hero-brand img').getAttribute('src'),'assets/geofact-logo.svg','real logo retained');
   equal(await p.locator('.hero-brand').evaluate(e=>getComputedStyle(e).animationName),'heroBrandJourney','original animated logo retained');
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'viewport has no horizontal overflow');
   for(const selector of ['#choosePractice strong','#choosePractice [data-i18n=homePracticeDescription]','#chooseGame strong','#openCollection strong','.home-intro-copy h1']) {
    const style=await p.locator(selector).evaluate(e=>{const s=getComputedStyle(e);return {color:s.color,size:parseFloat(s.fontSize),overflow:e.scrollWidth>e.clientWidth+1};});
    check(style.size>=15,'readable home type '+selector);check(style.color!=='rgb(255, 255, 255)','dark type on light surface '+selector);check(!style.overflow,'unclipped label '+selector);
   }
   for(const selector of ['#chooseDaily','#choosePractice','#chooseGame','#openCollection','#toggleSound','#lang','#openPublicStats','#howToPlay'])check((await p.locator(selector).boundingBox()).height>=44,'touch target '+selector);
   if(captures)await p.screenshot({path:`${captures}/home-${width}-${lang}.png`,fullPage:true});
   await p.clock.runFor(2000);equal(await p.locator('#dailyCountdown').textContent(),'11:59:58','countdown ticks from actual UTC clock');
   await p.click('#howToPlay');check(await p.locator('#howModal').isVisible(),'help accessible');await p.click('#closeHow');
   await p.click('#openPublicStats');check(await p.locator('#publicStats').isVisible(),'stats accessible');await p.click('#brand');
   await p.click('#choosePractice');await p.clock.runFor(500);check(await p.locator('#practiceSetup').isVisible(),'practice handler retained');await p.click('#brand');
   await p.click('#chooseGame');await p.clock.runFor(500);check(await p.locator('#difficulty').isVisible(),'challenge handler retained');await p.click('#brand');
   await p.click('#openCollection');await p.locator('#collection').waitFor({state:'visible'});check(await p.locator('#collection').isVisible(),'collection handler retained');await p.click('#brand');
   equal(await snapshot(p),before,'home consultations never alter rewards');
   for(const [key,value] of Object.entries(seed))equal(await p.evaluate(key=>localStorage.getItem(key),key),value,'original save retained '+key);
   await p.selectOption('#lang',lang==='fr'?'en':'fr');equal(await p.locator('[data-i18n=homeDailyTitle]').textContent(),lang==='fr'?'Your daily exploration':'L’exploration quotidienne','instant language change');
   await p.click('#toggleSound');await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(await p.locator('#lang').inputValue(),lang==='fr'?'en':'fr','language saved');equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'true','sound preference saved');
  } finally {await ctx.close();}
 }
 // Completed/revealed and past sealed chests are real committed fixtures, never UI placeholders.
 for(const lang of ['fr','en'])for(const opened of [false,true]) {
  const save={...currentSave,'wg-lang':lang};const daily=JSON.parse(save['gf-daily-v1']);daily.days['2026-10-09']={...daily.days['2026-10-07'],number:3,cardOpened:opened};save['gf-daily-v1']=JSON.stringify(daily);
  const ctx=await newContext({viewport:{width:375,height:900},locale:lang, reducedMotion:'reduce',storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(save).map(([name,value])=>({name,value}))}]}});
  try {const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-09T23:59:57Z')});await p.clock.pauseAt(new Date('2026-10-09T23:59:58Z'));await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();const before=await snapshot(p);
   equal(await p.locator('#chooseDaily').textContent(),lang==='fr'?'Voir mon résultat':'View my result','completed Daily action');check(await p.locator('#dailyCompleted').isVisible(),'real result shown');
   if(captures)await p.screenshot({path:`${captures}/daily-${opened?'opened':'sealed'}-${lang}.png`,fullPage:true});
   await p.click('#chooseDaily');await p.locator('#final').waitFor({state:'visible'});check(await p.locator(opened?'#cardReveal':'#dailyChest').isVisible(),'correct real chest state');await p.click('#brand');
   await p.clock.runFor(3000);equal(await p.locator('#chooseDaily').textContent(),lang==='fr'?'Jouer le Daily':'Play the Daily','next UTC day available');check(await p.locator('#resumeDailyChest').isVisible()===!opened,'past sealed chest preserved');equal(await snapshot(p),before,'UTC rollover never credits or resets');
  }finally{await ctx.close();}
 }
}
