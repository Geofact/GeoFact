import {currentSave} from './save-fixtures.mjs';
export async function testBonusIntegration({newContext,url,tap,check,equal,telemetry,core}) {
 const origin=new URL(url).origin;
 const snapshot=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');const r=await openRewardRepository();try{return await r.read();}finally{r.close();}});
 const local=p=>p.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 const count=s=>Object.values(s.collection).reduce((a,e)=>a+Object.values(e.counts).reduce((n,c)=>n+c,0),0);
 const chests=s=>Object.values(s.bonus.chests);
 async function setup(options={}) {
  const ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce',...options,storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(currentSave).map(([name,value])=>({name,value}))}]}});
  const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-09T12:00:00Z')});await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();return {ctx,p};
 }
 async function practice(p) {
  await p.evaluate(()=>{GeoFactCore.shuffle=list=>list.includes('FRA')?['FRA']:list;});
  await p.click('#choosePractice');await p.click('#practiceByDifficulty');await p.click('[data-level=easy]');await p.locator('#playing').waitFor({state:'visible'});
 }
 async function answer(p,next=true) {
  await tap('FRA','touch',p);await p.locator('#result').waitFor({state:'visible'});
  await p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));
  if(next)await p.click('#next');
 }
 async function repeat(p,n) {for(let i=0;i<n;i++)await answer(p);}
 async function quotaFailure(p,on) {
  await p.evaluate(on=>{if(!window.normalTransaction)window.normalTransaction=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=on?function(stores,mode,...rest){if(mode==='readwrite')throw new DOMException('Quota exceeded','QuotaExceededError');return normalTransaction.call(this,stores,mode,...rest);}:normalTransaction;
  },on);
 }
 async function sealed(p) {await p.click('#openPracticeBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});}
 function preserve(s,b,label) {
  equal(s.daily,b.daily,label+' Daily unchanged');equal(s.dailyChests,b.dailyChests,label+' Daily chests unchanged');
  for(const [iso,e] of Object.entries(b.collection)) {
   equal(s.collection[iso].firstUnlocked,e.firstUnlocked,label+' first date '+iso);
   for(const r of e.rarities){check(s.collection[iso].counts[r]>=e.counts[r],label+' existing copies '+iso+r);equal(s.collection[iso].acquiredAt[r],e.acquiredAt[r],label+' timestamp '+iso+r);}
  }
 }
 console.log('  Practice bonus: thresholds, cap, reload, delayed opening, concurrency and errors');
 {
  const {ctx,p}=await setup();try {
   const b=await snapshot(p);
   equal(await p.locator('[data-i18n="practiceBonusText"]').count(),0,'explanatory paragraph removed');
   equal(await p.locator('#homeBonusProgress').textContent(),"Coffres bonus obtenus : 0/2 aujourd'hui",'French home quota only');
   await p.selectOption('#lang','en');equal(await p.locator('#homeBonusProgress').textContent(),'Bonus chests earned: 0/2 today','English home quota');await p.selectOption('#lang','fr');
   await practice(p);await repeat(p,9);let s=await snapshot(p);equal(s.bonus.progress,9,'nine correct = 9');equal(chests(s).length,0,'nine no chest');check((await p.locator('#practiceBonusProgress').textContent()).includes('9/10'),'discreet 9/10');
   await answer(p,false);s=await snapshot(p);equal(s.bonus.progress,0,'tenth resets');equal(chests(s).length,1,'tenth chest');equal(s.collection,b.collection,'attribution does not credit');equal(s.bonus.grantsByDay['2026-10-09'],1,'first quota');check((await p.locator('#practiceChestNotice').textContent()).includes('enregistré'),'only confirmed notice');
   await sealed(p);equal(await p.locator('#map [data-iso=FRA]').evaluate(el=>getComputedStyle(el).fill),'rgb(74, 222, 128)','found country remains green with bonus dialog');await p.click('#closeBonusRewards');await p.click('#next');
   await answer(p);s=await snapshot(p);equal(s.bonus.progress,1,'eleventh = 1');equal(chests(s).length,1,'eleventh no new chest');
   await tap('BEL','touch',p);await p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));equal((await snapshot(p)).bonus.progress,0,'wrong immediately resets');check((await p.locator('#distanceReaction').textContent()).includes('pays voisin'),'border feedback retained');
   await answer(p);await repeat(p,6);equal((await snapshot(p)).bonus.progress,7,'partial progress');
   await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal((await snapshot(p)).bonus.progress,7,'partial progress across reload');equal(await p.locator('#homeBonusProgress').textContent(),"Coffres bonus obtenus : 1/2 aujourd'hui",'home quota excludes persistent streak');
   await practice(p);await repeat(p,3);s=await snapshot(p);equal(s.bonus.grantsByDay['2026-10-09'],2,'second quota');equal(chests(s).length,2,'two chests');
   await repeat(p,11);s=await snapshot(p);equal(s.bonus.progress,0,'cap suspends progress');equal(chests(s).length,2,'third blocked');equal(await p.locator('#practiceBonusQuota').textContent(),'Coffres bonus : 2/2','paused quota');
   await p.clock.setFixedTime(new Date('2026-10-10T00:01:00Z'));await answer(p);s=await snapshot(p);equal(s.bonus.progress,1,'resumes tomorrow');equal(s.bonus.grantsByDay['2026-10-09'],2,'previous quota retained');
   const fixed=chests(s).map(c=>c.card);await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(chests(await snapshot(p)).map(c=>c.card),fixed,'sealed fixed cards after midnight/reload');
   await p.click('#openBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});const beforeOpen=await snapshot(p),events=telemetry.filter(e=>e.body?.p_event_type==='chest_opened').length;
   await p.locator('#openBonusChest').evaluate(b=>{b.click();b.click();});await p.locator('#bonusCardReveal').waitFor({state:'visible'});s=await snapshot(p);equal(count(s),count(b)+1,'delayed opening one credit');equal(chests(s).filter(c=>c.openedAt!==null).length,1,'one open chest');equal(s.bonus.grantsByDay,beforeOpen.bonus.grantsByDay,'opening quota unchanged');equal(s.bonus.progress,1,'opening progress unchanged');
   equal(telemetry.filter(e=>e.body?.p_event_type==='chest_opened').length,events,'bonus does not change public Daily opening stats');preserve(s,b,'bonus opening');
   await p.click('#closeBonusRewards');await p.click('#openBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('#openBonusChest').evaluate(b=>b.click());await p.waitForTimeout(200);
   check(await p.locator('#openBonusChest.opening').isVisible(),'shared initial animation');check(await p.locator('#bonusCardReveal').isHidden(),'card not revealed early');await p.locator('#bonusCardReveal').waitFor({state:'visible'});
   s=await snapshot(p);equal(count(s),count(b)+2,'second chest adds one card');equal(chests(s).map(c=>c.card),fixed,'opening cards remain fixed');
   await p.click('#closeBonusRewards');await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(await snapshot(p),s,'reload opened chests no additional credit');
   equal((await local(p))['gf-collection-v1'],currentSave['gf-collection-v1'],'old collection bytes unchanged');equal((await local(p))['gf-daily-v1'],currentSave['gf-daily-v1'],'old Daily bytes unchanged');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup({viewport:{width:390,height:844},isMobile:true,hasTouch:true});try {
   await practice(p);await repeat(p,9);const b=await snapshot(p);await quotaFailure(p,true);await tap('FRA','touch',p);await p.locator('#rewardStatus').filter({hasText:'Progression non confirmée'}).waitFor();
   equal(await snapshot(p),b,'failed attribution leaves state unchanged');check(await p.locator('#openPracticeBonusRewards').isHidden(),'failed tenth never offers chest');check(await p.locator('#next').isDisabled(),'failed answer requires recovery');
   await quotaFailure(p,false);await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));
   let s=await snapshot(p);equal(chests(s).length,1,'pending answer recovered after reload');equal(s.collection,b.collection,'recovery still no credit');
   await p.click('#openBonusRewards');await quotaFailure(p,true);await p.click('#openBonusChest');await p.locator('#bonusRewardStatus').filter({hasText:'Impossible de confirmer'}).waitFor();equal(await snapshot(p),s,'failed opening unchanged');check(await p.locator('#bonusCardReveal').isHidden(),'failed opening does not claim card');
   await quotaFailure(p,false);await p.click('#retryBonusRewards');await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor({state:'visible'});s=await snapshot(p);equal(count(s),count(b)+1,'opening retry once');check(await p.locator('#bonusDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'mobile dialog no horizontal overflow');
   await p.click('#closeBonusRewards');await practice(p);await repeat(p,4);const beforeWrong=await snapshot(p);await quotaFailure(p,true);await tap('BEL','touch',p);check((await p.locator('#practiceBonusProgress').textContent()).includes('0/10'),'wrong immediately displays reset');await p.locator('#rewardStatus').filter({hasText:'Progression non confirmée'}).waitFor();
   await quotaFailure(p,false);await p.click('#retryRewards');await p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));equal((await snapshot(p)).bonus.progress,0,'failed wrong reset recovered');equal((await snapshot(p)).collection,beforeWrong.collection,'reset recovery preserves copies');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup(),q=await ctx.newPage();try {
   await q.clock.install({time:new Date('2026-10-09T12:00:00Z')});await q.goto(url);await q.locator('#chooseDaily:enabled').waitFor();await practice(p);await repeat(p,9);await practice(q);
   const b=await snapshot(p);await Promise.all([tap('FRA','touch',p),tap('FRA','touch',q)]);for(const page of [p,q])await page.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));
   let s=await snapshot(p);equal(chests(s).length,1,'two tabs cross tenth once');equal(s.bonus.progress,1,'other distinct round begins next series');equal(s.collection,b.collection,'concurrent attribution uncredited');
   for(const page of [p,q]){await page.click('#openPracticeBonusRewards');await page.locator('#bonusChestStage').waitFor({state:'visible'});}
   await Promise.all([p.locator('#openBonusChest').evaluate(b=>b.click()),q.locator('#openBonusChest').evaluate(b=>b.click())]);for(const page of [p,q])await page.locator('#bonusCardReveal').waitFor({state:'visible'});
   s=await snapshot(p);equal(count(s),count(b)+1,'simultaneous opening single copy');equal(Object.keys(s.credits).filter(k=>k.startsWith('credit:bonus:')).length,1,'one bonus credit');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup();try {
   const preserved=await p.evaluate(async()=>{
    const {openRewardRepository}=await import('./reward-repository.mjs');const repo=await openRewardRepository({name:'bonus-legacy-date'});
    await repo.activateDaily({getItem:k=>k==='gf-collection-v1'?JSON.stringify({FRA:{rarity:'silver',firstUnlocked:'2026-10-01'}}):null});
    try{
     for(let n=1;n<=10;n++)await repo.answer({id:'legacy:'+n,roundId:'legacy-round:'+n,mode:'practice',correct:true,at:Date.now(),countryDraw:0,rarityDraw:.15},['FRA']);
     const s=await repo.read(),chest=Object.values(s.bonus.chests)[0];await repo.openChest({id:'legacy-open',chestId:chest.id,at:Date.now()});return (await repo.read()).collection.FRA;
    }finally{repo.close();}
   });
   equal(preserved.counts,{silver:2},'legacy duplicate counted');equal(preserved.firstUnlocked,'2026-10-01','legacy first date preserved');equal(preserved.acquiredAt,{},'legacy duplicate does not invent a new first acquisition timestamp');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup();try {
   await practice(p);await repeat(p,3);const before=await snapshot(p);
   await p.evaluate(()=>sessionStorage.setItem('gf-pending-practice-v1','{malformed'));await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await p.locator('#rewardStatus').filter({hasText:'réponses en attente'}).waitFor();
   await p.click('#retryRewards');check((await p.locator('#rewardStatus').textContent()).includes('réponses en attente'),'unreadable pending queue is not silently discarded');equal(await snapshot(p),before,'unreadable pending queue preserves all rewards');
   await p.evaluate(()=>sessionStorage.removeItem('gf-pending-practice-v1'));await p.click('#retryRewards');await p.locator('#rewardStatus').waitFor({state:'hidden'});equal(await snapshot(p),before,'manual correction then retry no reward changes');
  }finally{await ctx.close();}
 }
 {
  const {ctx,p}=await setup();try {
   await practice(p);await repeat(p,7);let s=await snapshot(p);await p.click('#brand');const series=['FRA','JPN','USA','GBR','NOR'];await p.goto(url+'?challenge='+core.encodeChallenge('easy',series,100));await p.click('#acceptChallenge');await tap('JPN','touch',p);await tap('FRA','touch',p);
   await p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));s=await snapshot(p);equal(s.bonus.progress,1,'challenge wrong resets shared series then correct starts at one');await p.click('#brand');await p.click('#chooseDaily');await p.locator('#playing').waitFor({state:'visible'});const daily=await p.evaluate(()=>GeoFactCore.dailySeries(GeoFactCountries));
   for(const iso of daily){await tap(iso,'touch',p);await p.locator('#result').waitFor({state:'visible'});await p.click('#next');}await p.locator('#dailyChest').waitFor({state:'visible'});
   const earned=await snapshot(p);equal(earned.bonus,s.bonus,'Daily completion does not change practice series/quota/chests');await p.click('#openChest');await p.locator('#cardReveal').waitFor({state:'visible'});equal((await snapshot(p)).bonus,s.bonus,'Daily opening independent');
  }finally{await ctx.close();}
 }
}
