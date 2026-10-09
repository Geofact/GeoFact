import {currentSave,legacySave} from './save-fixtures.mjs';
export async function testDailyStorage({newContext,url,tap,check,equal,telemetry}) {
 const origin=new URL(url).origin;
 const snapshot=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');const r=await openRewardRepository();try{return await r.read();}finally{r.close();}});
 const local=p=>p.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 const copies=s=>Object.values(s.collection).reduce((n,e)=>n+Object.values(e.counts).reduce((a,b)=>a+b,0),0);
 async function setup(seed=currentSave,extra={},time='2026-10-08T12:00:00Z') {
  const ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce',storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(seed).map(([name,value])=>({name,value}))}]}});
  if(extra.init)await ctx.addInitScript(extra.init);
  const p=await ctx.newPage();await p.clock.install({time:new Date(time)});await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();return {ctx,p};
 }
 async function launch(p) {await p.click('#chooseDaily');await p.locator('#playing').waitFor({state:'visible'});return p.evaluate(()=>GeoFactCore.dailySeries(GeoFactCountries));}
 async function solve(p,series,lastNext=true) {for(let i=0;i<5;i++){await tap(series[i],'touch',p);await p.locator('#result').waitFor({state:'visible'});if(i<4||lastNext)await p.click('#next');}if(lastNext)await p.locator('#final').waitFor({state:'visible'});}
 function coherent(s,day,label) {
  const r=s.daily.days[day],chest=s.dailyChests['daily:'+day];check(!!r&&!!chest,label+' result and chest committed');
  equal(chest.card,r.card,label+' fixed card matches chest');equal(chest.revealed,!!r.cardOpened,label+' revelation consistent');
  check(s.collection[r.card.iso].counts[r.card.rarity]>=1,label+' card credited');
  equal(s.bonus.chests,{},label+' no practice bonus');equal(s.bonus.progress,0,label+' practice unchanged');equal(s.bonus.grantsByDay,{},label+' bonus quotas unchanged');
 }
 console.log('  Connected Daily: migration, reload, concurrent tabs, errors and UTC');
 for(const [label,seed] of [['current',currentSave],['legacy',legacySave]]) {
  const {ctx,p}=await setup(seed);try {
   const s=await snapshot(p);equal(s.dailyActive,1,label+' automatic activation');equal(s.daily,JSON.parse(seed['gf-daily-v1']),label+' original Daily fields');
   if(label==='current')equal(s.collection,JSON.parse(seed['gf-collection-v1']),label+' exact collection');
   else {equal(s.collection.FRA.counts,{silver:1},label+' prototype copy');equal(s.collection.FRA.firstUnlocked,'2026-10-01',label+' original date');}
   equal(await local(p),seed,label+' all localStorage bytes preserved');
   await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(await snapshot(p),s,label+' reload no new rewards');
  } finally {await ctx.close();}
 }
 {
  const {ctx,p}=await setup();try {
   const before=await snapshot(p),series=await launch(p);await solve(p,series);const earned=await snapshot(p);coherent(earned,'2026-10-08','completion');
   equal(copies(earned),copies(before)+1,'one copy at completion');equal(Object.keys(earned.credits).length,1,'one new credit');equal(await local(p).then(v=>v['gf-collection-v1']),currentSave['gf-collection-v1'],'old collection untouched');
   await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await p.click('#chooseDaily');await p.locator('#dailyChest').waitFor({state:'visible'});
   equal(await snapshot(p),earned,'consultation leaves fixed reward unchanged');
   await p.locator('#openChest').evaluate(b=>{b.click();b.click();});await p.locator('#cardReveal').waitFor({state:'visible'});
   const revealed=await snapshot(p);coherent(revealed,'2026-10-08','reload reveal');equal(revealed.collection,earned.collection,'opening no extra credit');
   for(let n=0;n<2;n++){await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await p.click('#chooseDaily');await p.locator('#cardReveal').waitFor({state:'visible'});}
   equal(await snapshot(p),revealed,'repeated visits no rewards');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup(),q=await ctx.newPage();try {
   await q.clock.install({time:new Date('2026-10-08T12:00:00Z')});await q.goto(url);await q.locator('#chooseDaily:enabled').waitFor();
   const before=await snapshot(p),series=await launch(p);await launch(q);await solve(p,series,false);await solve(q,series,false);
   const eventsBefore=telemetry.filter(e=>e.body?.p_event_type==='daily_completed').length;
   await Promise.all([p.click('#next'),q.click('#next')]);for(const page of [p,q])await page.locator('#dailyChest').waitFor({state:'visible'});
   const earned=await snapshot(p);coherent(earned,'2026-10-08','two completions');equal(copies(earned),copies(before)+1,'two tabs only one copy');
   equal(telemetry.filter(e=>e.body?.p_event_type==='daily_completed').length-eventsBefore,1,'only winning completion sends event');
   const openedBefore=telemetry.filter(e=>e.body?.p_event_type==='chest_opened').length;
   await Promise.all([p.locator('#openChest').evaluate(b=>b.click()),q.locator('#openChest').evaluate(b=>b.click())]);for(const page of [p,q])await page.locator('#cardReveal').waitFor({state:'visible'});
   const revealed=await snapshot(q);coherent(revealed,'2026-10-08','two openings');equal(revealed.collection,earned.collection,'two openings no extra copy');
   equal(telemetry.filter(e=>e.body?.p_event_type==='chest_opened').length-openedBefore,1,'one opening event across tabs');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup(currentSave,{},'2026-10-08T23:59:50Z');try {
   const series=await launch(p);await p.clock.setFixedTime(new Date('2026-10-09T00:01:00Z'));await solve(p,series);
   const s=await snapshot(p);coherent(s,'2026-10-08','midnight');equal(s.daily.days['2026-10-09'],undefined,'no tomorrow result from yesterday series');
   await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await p.locator('#resumeDailyChest').waitFor({state:'visible'});await p.click('#resumeDailyChest');await p.locator('#dailyChest').waitFor({state:'visible'});
   await p.click('#openChest');await p.locator('#cardReveal').waitFor({state:'visible'});equal((await snapshot(p)).daily.days['2026-10-08'].cardOpened,true,'yesterday chest recovered and revealed');
   await p.click('#brand');const tomorrow=await launch(p);equal(tomorrow,await p.evaluate(()=>GeoFactCore.dailySeries(GeoFactCountries)),'next UTC Daily still playable');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup();try {
   const before=await snapshot(p),series=await launch(p);
   await p.evaluate(()=>{window.originalTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(mode==='readwrite')throw new DOMException('Quota exceeded','QuotaExceededError');return originalTransaction.call(this,stores,mode,...rest);};});
   await solve(p,series);await p.locator('#rewardStatus').filter({hasText:'Récompense non confirmée'}).waitFor();check(await p.locator('#dailyChest').isHidden(),'failed save never offers a reward');equal(await snapshot(p),before,'failed write preserves canonical data');
   await p.selectOption('#lang','en');check((await p.locator('#rewardStatus').textContent()).includes('Reward not confirmed'),'failure translated English');
   await p.evaluate(()=>IDBDatabase.prototype.transaction=originalTransaction);await p.click('#retryRewards');await p.locator('#dailyChest').waitFor({state:'visible'});
   const earned=await snapshot(p);equal(copies(earned),copies(before)+1,'retry credits once');
   await p.evaluate(()=>{IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(mode==='readwrite')throw new DOMException('Quota exceeded','QuotaExceededError');return originalTransaction.call(this,stores,mode,...rest);};});
   await p.click('#openChest');await p.locator('#rewardStatus').filter({hasText:'Unable to save the chest reveal'}).waitFor();check(await p.locator('#cardReveal').isHidden(),'failed revelation not confirmed');equal(await snapshot(p),earned,'failed reveal preserves chest and cards');
   await p.evaluate(()=>IDBDatabase.prototype.transaction=originalTransaction);await p.click('#openChest');await p.locator('#cardReveal').waitFor({state:'visible'});equal((await snapshot(p)).collection,earned.collection,'reveal retry no second copy');check(await p.locator('#rewardStatus').isHidden(),'successful reveal clears old error');
  }finally{await ctx.close();}
 }
 for(const [label,seed,init] of [
  ['malformed',{...currentSave,'gf-collection-v1':'{broken'},null],
  ['denied',currentSave,()=>Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined})]
 ]) {
  const {ctx,p}=await setup(seed,{init});try {
   await p.click('#openCollection');await p.locator('#collectionCount').filter({hasText:'Collection indisponible'}).waitFor();equal(await local(p),seed,label+' originals remain intact');check(await p.locator('#retryRewards').isVisible(),label+' visible retry');
   if(label==='malformed') {const s=await snapshot(p);equal(s.dailyActive,undefined,'failed import never activates empty state');equal(s.legacyImport,undefined,'failed import no marker');}
   await p.click('#brand');await p.click('#chooseGame');await p.click('[data-level="easy"]');await p.locator('#playing').waitFor({state:'visible'});check(await p.locator('#playing').isVisible(),label+' classic still works');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup();try {
   const before=await snapshot(p);
   const response=await p.evaluate(async()=>{
    const {openRewardRepository}=await import('./reward-repository.mjs');let lose=false;
    const repo=await openRewardRepository({transactionProbe:({stage})=>{if(lose&&stage==='committed')throw Error('lost acknowledgement');}});
    lose=true;try{await repo.completeDaily({day:'2026-10-08',number:2,score:100,errors:0,tiles:Array(5).fill('green'),at:Date.now(),card:{iso:'FRA',rarity:'classic'}});}catch(e){return {code:e.code,committed:e.committed};}finally{repo.close();}
   });
   equal(response,{code:'ACKNOWLEDGEMENT_FAILED',committed:true},'lost completion acknowledgement distinguished');
   const earned=await snapshot(p);coherent(earned,'2026-10-08','lost acknowledgement');equal(copies(earned),copies(before)+1,'commit remains saved');
   const retry=await p.evaluate(async()=>{
    const {openRewardRepository}=await import('./reward-repository.mjs');const repo=await openRewardRepository();
    try{return await repo.completeDaily({day:'2026-10-08',number:2,score:90,errors:1,tiles:Array(5).fill('yellow'),at:Date.now(),card:{iso:'JPN',rarity:'gold'}});}finally{repo.close();}
   });
   equal(retry.status,'already-completed','retry after commit idempotent');equal(retry.result.card,earned.daily.days['2026-10-08'].card,'fixed card recovered without new draw');equal(await snapshot(p),earned,'retry no reward or record changes');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup();try {
   const before=await snapshot(p);
   const outcome=await p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');let abort=false;
    const repo=await openRewardRepository({transactionProbe:({stage,transaction})=>{if(abort&&stage==='staged')transaction.objectStore('state').get('rewards').onsuccess=()=>transaction.abort();}});
    abort=true;try{await repo.completeDaily({day:'2026-10-08',number:2,score:100,errors:0,tiles:Array(5).fill('green'),at:Date.now(),card:{iso:'FRA',rarity:'classic'}});}catch(e){return e.code;}finally{repo.close();}});
   equal(outcome,'ABORTED','native abort after all writes');equal(await snapshot(p),before,'result chest and credit all roll back');
   const q=await ctx.newPage();await q.goto(url+'tests/repository-harness.html');await q.evaluate(()=>localStorage.setItem('gf-collection-v1','{}'));
   await p.locator('#rewardStatus').filter({hasText:'ancienne sauvegarde a changé'}).waitFor();equal(await snapshot(p),before,'old tab change no merge');await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(await snapshot(p),before,'reload uses canonical IndexedDB despite old change');
  }finally{await ctx.close();}
 }
}
