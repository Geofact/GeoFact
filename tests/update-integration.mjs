import {setLanguage} from './language-control.mjs';
import {currentSave} from './save-fixtures.mjs';
export async function testUpdateIntegration({newContext,url,tap,check,equal,telemetry,core}) {
 const origin=new URL(url).origin;
 const profile={cookies:[],origins:[{origin,localStorage:Object.entries(currentSave).map(([name,value])=>({name,value}))}]};
 const read=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{return await r.read();}finally{r.close();}});
 const settled=p=>p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));
 const count=s=>Object.values(s.collection).reduce((total,c)=>total+Object.values(c.counts).reduce((n,v)=>n+v,0),0);
 const current=p=>p.evaluate(()=>GeoFactCountries.find(c=>c.name[document.documentElement.lang]===document.getElementById('countryName').textContent).iso);
 async function practice(p,custom=false){
  if(await p.locator('#home').isHidden())await p.click('#brand');await p.click('#choosePractice');
  if(custom){await p.click('#practiceCustom');await p.locator('input[value=FRA]').check();await p.click('#startCustomPractice');}
  else {await p.evaluate(()=>{window.updateOriginalShuffle ||= GeoFactCore.shuffle;GeoFactCore.shuffle=list=>list.includes('FRA')?['FRA']:list;});await p.click('#practiceByDifficulty');await p.click('[data-level=easy]');}
  await p.locator('#playing').waitFor({state:'visible'});
 }
 async function correct(p,next=true){await tap(await current(p),'touch',p);await p.locator('#result').waitFor({state:'visible'});await settled(p);if(next)await p.click('#next');}
 async function repeat(p,n){for(let i=0;i<n;i++)await correct(p);}
 async function game(p){if(await p.locator('#home').isHidden())await p.click('#brand');await p.evaluate(()=>{if(window.updateOriginalShuffle)GeoFactCore.shuffle=updateOriginalShuffle;});await p.click('#chooseGame');await p.click('[data-level=easy]');await p.locator('#playing').waitFor({state:'visible'});}
 async function challenge(p){await p.goto(url+'?challenge='+core.encodeChallenge('easy',['FRA','JPN','USA','GBR','NOR'],90));await p.locator('#acceptChallenge').waitFor({state:'visible'});await p.waitForFunction(()=>!document.getElementById('chooseDaily').disabled);await p.click('#acceptChallenge');await p.locator('#playing').waitFor({state:'visible'});}
 console.log('Update: shared bonus modes, excluded custom lists, collection navigation, language, sound and visitor IDs…');
 {
  const ctx=await newContext({locale:'fr-FR',viewport:{width:320,height:568},isMobile:true,hasTouch:true,reducedMotion:'reduce',storageState:profile});const p=await ctx.newPage();try{
   await p.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();const original=await read(p);
   equal(await p.locator('[data-i18n=homePracticeDescription]').textContent(),'Joue à ton rythme, sans limite.','exact French subtitle');check(await p.locator('[data-i18n=homePracticeDescription]').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=13),'subtitle remains readable at 320px');
   await practice(p);await repeat(p,7);const seven=await read(p);equal(seven.bonus.progress,7,'normal practice progresses');
   await practice(p,true);check(await p.locator('#practiceBonus').isHidden(),'custom list does not show an eligible streak');await tap('BEL','touch',p);await correct(p);await repeat(p,3);equal((await read(p)).bonus,seven.bonus,'custom wrong and correct leave bonus untouched');
   await game(p);await repeat(p,5);await p.locator('#final').waitFor({state:'visible'});let s=await read(p);equal(s.bonus.progress,2,'five challenge-game countries join practice series');equal(Object.keys(s.bonus.chests).length,1,'shared tenth awards one chest');equal(s.collection,original.collection,'sealed chest does not credit');check(await p.locator('#finalBonusRewards').isVisible(),'final offers earned bonus chest');
   await p.click('#finalBonusRewards');await p.click('#bonusViewCollection');await p.locator('#collection').waitFor({state:'visible'});check(!await p.locator('#bonusDialog').evaluate(d=>d.open),'collection navigation closes dialog');equal(await read(p),s,'view collection does not open or duplicate sealed chest');
   await practice(p);await repeat(p,3);equal((await read(p)).bonus.progress,5,'practice resumes shared streak');await challenge(p);await repeat(p,5);s=await read(p);equal(s.bonus.grantsByDay['2026-10-09'],2,'linked challenge grants second shared chest');equal(s.bonus.progress,0,'second chest resets');
   await practice(p);await repeat(p,11);s=await read(p);equal(s.bonus.progress,0,'normal practice cannot bank third chest');equal(Object.keys(s.bonus.chests).length,2,'shared cap two');
   await p.clock.setFixedTime(new Date('2026-10-10T00:00:01Z'));await correct(p,false);s=await read(p);equal(s.bonus.progress,1,'midnight resumes');equal(s.bonus.grantsByDay['2026-10-09'],2,'previous quota intact');
   await p.click('#openPracticeBonusRewards');const before=await read(p);await p.locator('#openBonusChest').evaluate(b=>{b.click();b.click();});await p.locator('#bonusCardReveal').waitFor({state:'visible'});await p.click('#bonusViewCollection');await p.locator('#collection').waitFor({state:'visible'});s=await read(p);equal(count(s),count(before)+1,'double click adds exactly one card');equal(s.daily,original.daily,'Daily unchanged');equal(s.dailyChests,original.dailyChests,'Daily chests unchanged');
   for(const key of ['gf-collection-v1','gf-daily-v1','wg-best','gf-anonymous-visitor-v1','unrelated-setting'])equal(await p.evaluate(key=>localStorage.getItem(key),key),currentSave[key],'legacy save unchanged '+key);
   const oldStats=JSON.parse(currentSave['wg-stats']),newStats=await p.evaluate(()=>JSON.parse(localStorage.getItem('wg-stats')));for(const key of Object.keys(oldStats))check(newStats[key]>=oldStats[key],'historical play statistics preserved '+key);
   const restored=await ctx.storageState({indexedDB:true});await ctx.close();
   const restart=await newContext({locale:'en-US',storageState:restored,reducedMotion:'reduce'});const q=await restart.newPage();try{await q.goto(url);await q.locator('#chooseDaily:enabled').waitFor();const recovered=await read(q);equal(recovered.bonus,s.bonus,'browser-context restart preserves committed progress and chests');equal(recovered.collection,s.collection,'restart preserves all cards');await q.click('#openBonusRewards');await q.locator('#bonusChestStage').waitFor({state:'visible'});check(await q.locator('#bonusChestStage').isVisible(),'unopened second chest recoverable');}finally{await restart.close();}
  }finally{await ctx.close();}
 }
 {
  const ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce',storageState:profile}),p=await ctx.newPage(),q=await ctx.newPage();try{
   for(const page of [p,q]){await page.clock.setFixedTime(new Date('2026-10-09T12:00:00Z'));await page.goto(url);await page.locator('#chooseDaily:enabled').waitFor();}
   await practice(p);await repeat(p,9);await challenge(q);const before=await read(p);
   await Promise.all([tap('FRA','touch',p),tap('FRA','touch',q)]);await Promise.all([settled(p),settled(q)]);const s=await read(p);equal(Object.keys(s.bonus.chests).length,1,'two different eligible tabs cross shared threshold once');equal(s.bonus.progress,1,'distinct second round counts once');equal(s.collection,before.collection,'parallel awards uncredited');
   for(const page of [p,q]){await page.click('#openPracticeBonusRewards');await page.locator('#bonusChestStage').waitFor({state:'visible'});}
   // Dispatch together: actionability retries can outlive the other tab's commit.
   await Promise.all([p,q].map(page=>page.locator('#openBonusChest').evaluate(button=>button.click())));for(const page of [p,q])await page.locator('#bonusCardReveal').waitFor({state:'visible'});equal(count(await read(p)),count(before)+1,'mixed-mode tabs credit only once');
  }finally{await ctx.close();}
 }
 // A deterministic Web Audio device lets us inspect scheduling, mute, and Safari's prefixed API.
 {
  const ctx=await newContext({locale:'en-US',viewport:{width:320,height:568},isMobile:true,hasTouch:true,reducedMotion:'reduce',storageState:{...profile,origins:profile.origins.map(o=>({...o,localStorage:o.localStorage.filter(x=>x.name!=='wg-lang')}))}});
  await ctx.addInitScript(()=>{
   if(location.protocol!=='http:')return;window.audioLog=[];
   class Device {constructor(){this.state='suspended';this.currentTime=0;this.destination={};audioLog.push('create');}resume(){this.state='running';audioLog.push('resume');return Promise.resolve();}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){return {frequency:{setValueAtTime(f){audioLog.push(f);}},connect(){},disconnect(){},start(){audioLog.push('start');},stop(){audioLog.push('stop');}};}}
   window.AudioContext=undefined;window.webkitAudioContext=Device;
  });
  const p=await ctx.newPage();try{
   await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();equal(await p.evaluate(()=>audioLog.length),0,'no autoplay on first load');equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'false','sound defaults on');equal(await p.locator('[data-i18n=homePracticeDescription]').textContent(),'Play at your own pace, as much as you like.','exact English subtitle');
   await practice(p);await tap('BEL','touch',p);check(await p.evaluate(()=>audioLog.includes(294)),'wrong answer soft sound via webkit context');await tap('FRA','touch',p);await settled(p);equal(await p.evaluate(()=>audioLog.filter(v=>typeof v==='number').slice(-4)),[784,988,1175,1568],'correct answer positive sound');const after=await p.evaluate(()=>audioLog.length);await p.locator('#map [data-iso=JPN]').dispatchEvent('pointerover');await tap('JPN','touch',p);equal(await p.evaluate(()=>audioLog.length),after,'hover and ignored extra taps are silent');
   await p.click('#toggleSound');equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'true','mute immediately active');const muted=await p.evaluate(()=>audioLog.length);await p.click('#next');await tap('BEL','touch',p);await correct(p,false);equal(await p.evaluate(()=>audioLog.length),muted,'muted validation schedules nothing');
   await setLanguage(p,'fr');equal(await p.locator('#toggleSound').getAttribute('aria-label'),'Activer les sons','sound label follows language');await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(await p.locator('#lang').getAttribute('value'),'fr','manual language beats English browser on reload');equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'true','mute persists on reload');equal(await p.evaluate(()=>audioLog.length),0,'muted reload creates no audio context');
   await p.click('#toggleSound');check(await p.evaluate(()=>audioLog.includes('resume')),'explicit enable resumes in gesture');
   await p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{for(let n=0;n<10;n++)await r.answer({id:'sound:'+n,roundId:'sound-round:'+n,mode:'game',correct:true,at:Date.now(),countryDraw:0,rarityDraw:.03},['FRA']);}finally{r.close();}window.dispatchEvent(new Event('focus'));});
   await p.click('#openBonusRewards');await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor({state:'visible'});check(await p.evaluate(()=>audioLog.includes(1047)),'Gold reveal special sound after committed opening');const revealed=await p.evaluate(()=>audioLog.length);
   // Preserve the programmatic language-rerender regression behind this modal.
   await p.locator('#lang').dispatchEvent('click');equal(await p.locator('#lang').getAttribute('value'),'en','bonus modal rerender switches language');equal(await p.evaluate(()=>audioLog.length),revealed,'language rerender does not replay reveal');equal(await p.locator('#bonusViewCollection').textContent(),'View my collection','English collection action');
   await p.click('#bonusViewCollection');check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'small-screen collection/header fit');
   await p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{for(let n=0;n<10;n++)await r.answer({id:'shiny-sound:'+n,roundId:'shiny-sound-round:'+n,mode:'challenge',correct:true,at:Date.now(),countryDraw:0,rarityDraw:0},['FRA']);}finally{r.close();}window.dispatchEvent(new Event('focus'));});
   await p.click('#collectionBonusRewards');await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor({state:'visible'});equal(await p.evaluate(()=>audioLog.filter(value=>typeof value==='number').slice(-4)),[659,784,988,1319],'Shiny reveal retains its own committed melody');await p.click('#bonusViewCollection');
   const state=await ctx.storageState({indexedDB:true});const again=await newContext({locale:'fr-FR',storageState:state,reducedMotion:'reduce'});const other=await again.newPage();try{await other.goto(url);await other.locator('#chooseDaily:enabled').waitFor();equal(await other.locator('#lang').getAttribute('value'),'en','manual English survives reconstructed next visit');}finally{await again.close();}
  }finally{await ctx.close();}
 }
 {
  const before=telemetry.length,ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce'}),p=await ctx.newPage(),q=await ctx.newPage();try{
   await Promise.all([p.goto(url),q.goto(url)]);for(const page of [p,q])await page.locator('#chooseDaily:enabled').waitFor();await p.reload();await p.locator('#chooseDaily:enabled').waitFor();
   const visitors=telemetry.slice(before).filter(e=>e.body?.p_event_type==='visit');equal(visitors.length,3,'each page load is a visit event');equal(new Set(visitors.map(e=>e.body.p_visitor_id)).size,1,'first parallel tabs and reload share one persistent visitor');
  }finally{await ctx.close();}
 }
 {
  const before=telemetry.length,ctx=await newContext({locale:'en-US',reducedMotion:'reduce'});await ctx.addInitScript(()=>{if(location.protocol==='http:')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});});const p=await ctx.newPage();try{
   await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();await setLanguage(p,'fr');equal(await p.locator('#lang').getAttribute('value'),'fr','language changes without storage');check(await p.locator('#toggleSound').isEnabled(),'sound switch usable without storage');await p.click('#toggleSound');equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'true','memory-only mute');equal(telemetry.slice(before).filter(e=>e.rpc==='geofact_record_event').length,0,'denied storage never sends ephemeral visitor');
  }finally{await ctx.close();}
 }
 {
  const english={...profile,origins:profile.origins.map(o=>({...o,localStorage:o.localStorage.map(x=>x.name==='wg-lang'?{...x,value:'en'}:x)}))};
  const ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce',storageState:english});let release;const gate=new Promise(ok=>release=ok);
  await ctx.route('**/app.js*',async route=>{await gate;await route.continue();});
  const p=await ctx.newPage();try{
   await p.goto(url,{waitUntil:'commit'});await p.locator('[data-i18n=homePracticeDescription]').waitFor({state:'visible'});
   equal(await p.evaluate(()=>document.documentElement.lang),'en','saved language applied before game boot');
   equal(await p.locator('[data-i18n=homePracticeDescription]').textContent(),'Play at your own pace, as much as you like.','static subtitle translated while app loading');
   await p.evaluate(()=>{const e=document.createElement('span');e.id='partialLanguage';e.dataset.i18n='practiceShort';document.getElementById('home').appendChild(e);});
   await p.locator('#partialLanguage').filter({hasText:'Play without limits'}).waitFor();await p.evaluate(()=>document.getElementById('partialLanguage').appendChild(document.createTextNode('Joue sans limite')));
   await p.waitForFunction(()=>document.getElementById('partialLanguage').textContent==='Play without limits, earn bonus chests');equal(await p.locator('#partialLanguage').textContent(),'Play without limits, earn bonus chests','partial parser-like text is translated without duplication');await p.locator('#partialLanguage').evaluate(e=>e.remove());
   release();await p.locator('#chooseDaily:enabled').waitFor();await p.click('#openCollection');await p.locator('#collection').waitFor({state:'visible'});
   const card=p.locator('#collectionGrid .collection-card').first();await card.click();await p.locator('#collectionDetail .zoomable-card').first().click();await p.locator('#cardModal').waitFor({state:'visible'});
   const iso=await p.locator('#cardModal').getAttribute('data-iso');
   // This retained rerender test intentionally changes language behind the modal overlay.
   await p.locator('#lang').dispatchEvent('click');equal(await p.locator('#lang').getAttribute('value'),'fr','open modal language changes');
   equal(await p.locator('#cardModalContent h3').textContent(),await p.evaluate(iso=>GeoFactCountries.find(c=>c.iso===iso).name.fr,iso),'open card modal translates immediately');
   await p.click('#closeCardModal');
  }finally{release();await ctx.close();}
 }
 {
  const ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce'}),p=await ctx.newPage(),q=await ctx.newPage();try{
   for(const page of [p,q]){await page.goto(url);await page.locator('#chooseDaily:enabled').waitFor();}
   await p.click('#toggleSound');await q.waitForFunction(()=>document.getElementById('toggleSound').dataset.muted==='true');equal(await q.locator('#toggleSound').getAttribute('aria-pressed'),'true','mute propagates to other tab');
   await q.click('#toggleSound');await p.waitForFunction(()=>document.getElementById('toggleSound').dataset.muted==='false');equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'false','other tab can restore sound');
  }finally{await ctx.close();}
 }
 {
  const ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce'});let release;const gate=new Promise(ok=>release=ok);
  await ctx.route('**/rest/v1/rpc/geofact_stats',async route=>{
   const period=route.request().postDataJSON().period_days;if(period===30)await gate;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{visitors:period===30?12:21,players:8,daily_started:6,daily_completed:5,chests_opened:4,challenges_completed:3}])});
  });
  const p=await ctx.newPage();try{
   await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();await p.click('#openPublicStats');await p.locator('#statsStatus').filter({hasText:'Chargement'}).waitFor();
   await setLanguage(p,'en');equal(await p.locator('#statsStatus').textContent(),'Loading statistics…','pending stats message translates');
   await p.selectOption('#statsPeriod','0');await p.locator('#statVisitors').filter({hasText:'21'}).waitFor();
   const response=p.waitForResponse(r=>r.url().endsWith('/geofact_stats')&&r.request().postDataJSON().period_days===30);release();await response;
   await p.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));equal(await p.locator('#statVisitors').textContent(),'21','stale 30-day response cannot overwrite all-time period');
   equal(await p.locator('[data-i18n=statsChests]').textContent(),'Daily chests opened','Daily-only public chest counter explicitly labelled');
  }finally{release();await ctx.close();}
 }
 {
  const ctx=await newContext({locale:'en-US',reducedMotion:'reduce'},{failSupabase:true}),p=await ctx.newPage();try{
   await p.goto(url);await p.click('#openPublicStats');await p.locator('#statsStatus').filter({hasText:'unavailable'}).waitFor();await setLanguage(p,'fr');equal(await p.locator('#statsStatus').textContent(),'Statistiques temporairement indisponibles.','stats error translates immediately');
  }finally{await ctx.close();}
 }

 {
  const ctx=await newContext({locale:'fr-FR',viewport:{width:320,height:568},isMobile:true,hasTouch:true,reducedMotion:'no-preference'}),p=await ctx.newPage();try{
   await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
   await p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{for(let n=0;n<10;n++)await r.answer({id:'navigate:'+n,roundId:'navigate-round:'+n,mode:'game',correct:true,at:Date.now(),countryDraw:0,rarityDraw:.03},['FRA']);}finally{r.close();}window.dispatchEvent(new Event('focus'));});
   await p.click('#openBonusRewards');await p.click('#openBonusChest');await p.locator('#openBonusChest.opening').waitFor({state:'visible'});await p.click('#bonusViewCollection');await p.locator('#collection').waitFor({state:'visible'});
   equal(await p.locator('#collectionGrid .collection-card').count(),0,'navigating during animation never credits early');
   await p.locator('#collectionGrid .collection-card').waitFor({state:'visible'});equal(count(await read(p)),1,'commit refreshes collection after navigation');
   await p.click('#brand');await p.click('#openCollection');await p.locator('#collection').waitFor({state:'visible'});equal(count(await read(p)),1,'reconsultation never duplicates animated credit');
  }finally{await ctx.close();}
 }

}
