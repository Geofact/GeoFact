import {currentSave} from './save-fixtures.mjs';
export async function testIphoneRegression({newContext,url,tap,core,check,equal}) {
 const origin=new URL(url).origin;
 const profile={cookies:[],origins:[{origin,localStorage:Object.entries(currentSave).map(([name,value])=>({name,value}))}]};
 const read=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{return await r.read();}finally{r.close();}});
 async function practice(p){await p.evaluate(()=>{GeoFactCore.shuffle=list=>list.includes('NGA')?['NGA']:list;});await p.click('#choosePractice');await p.click('#practiceByDifficulty');const level=await p.evaluate(()=>GeoFactCountries.find(c=>c.iso==='NGA').difficulty);await p.click(`[data-level="${level}"]`);await p.locator('#playing').waitFor({state:'visible'});}
 async function nativeNigeria(p){
  // Wrong-answer pulses transform neighbouring SVG paths; wait before sampling hit coordinates.
  await p.waitForFunction(()=>!document.querySelector('#map .country-wrong'));
  await p.locator('#map').evaluate(e=>e.scrollIntoView({block:'center',behavior:'auto'}));
  const point=await p.evaluate(()=>{
   const svg=document.getElementById('map'),shape=svg.querySelector('[data-iso=NGA]'),b=shape.getBBox();
   for(const a of [.5,.4,.6,.3,.7])for(const c of [.5,.4,.6,.3,.7]){
    const q=svg.createSVGPoint();q.x=b.x+b.width*a;q.y=b.y+b.height*c;
    if(!shape.isPointInFill(q))continue;const s=q.matrixTransform(svg.getScreenCTM());s.x=Math.round(s.x);s.y=Math.round(s.y);
    if(document.elementFromPoint(s.x,s.y)?.closest('[data-iso]')?.dataset.iso==='NGA')return {x:s.x,y:s.y};
   }return null;
  });check(!!point,'native Nigeria interior found');await p.touchscreen.tap(point.x,point.y);
 }
 async function settled(p){await p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));}
 console.log('iPhone regression scenarios: Nigeria, repeated taps, rendering, storage and compact counters…');
 // Loading and unreadable recovery data used to silently discard practice touches.
 for(const condition of ['loading','unreadable']) {
  const ctx=await newContext({locale:'fr-FR',viewport:{width:320,height:568},isMobile:true,hasTouch:true,reducedMotion:'reduce',storageState:profile});
  let release;
  const gate=new Promise(resolve=>release=resolve);
  if(condition==='loading')await ctx.route('**/reward-repository.mjs*',async route=>{await gate;await route.continue();});
  else await ctx.addInitScript(()=>{if(location.protocol==='http:')sessionStorage.setItem('gf-pending-practice-v1','{broken');});
  const p=await ctx.newPage();try{
   await p.goto(url);if(condition!=='loading')await p.locator('#chooseDaily:enabled').waitFor();
   await practice(p);await nativeNigeria(p);
   check(await p.locator('#result').isHidden(),condition+' cannot validate before storage recovery');
   equal(await p.locator('#map .country-found').count(),0,condition+' is hover only, no validated country');
   check(await p.locator('#practiceInputRecovery').isVisible(),condition+' displays recovery beside map');
   check(await p.locator('#practiceInputStatus').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),condition+' explanation is in mobile viewport after ignored touch');
   check((await p.locator('#practiceInputStatus').textContent()).includes(condition==='loading'?'Attends':'suspendue'),condition+' explains why answers are paused');
   await p.selectOption('#lang','en');
   check((await p.locator('#practiceInputStatus').textContent()).includes(condition==='loading'?'Wait':'paused'),condition+' English explanation');
   console.log('Reproduced and explained practice guard:',condition);
   if(condition==='loading'){release();await p.waitForFunction(()=>!document.getElementById('chooseDaily').disabled);await nativeNigeria(p);await p.locator('#result').waitFor({state:'visible'});await settled(p);}
   else {
    equal(await p.evaluate(()=>sessionStorage.getItem('gf-pending-practice-v1')),'{broken','unreadable recovery source preserved');
    check(await p.locator('#retryPracticeRewards').isEnabled(),'inline recovery action available');
    // Test-only repair by the owner of the original data; the app never discards it.
    await p.evaluate(()=>sessionStorage.setItem('gf-pending-practice-v1','[]'));
    await p.click('#retryPracticeRewards');await p.locator('#practiceInputRecovery').waitFor({state:'hidden'});
    await nativeNigeria(p);await p.locator('#result').waitFor({state:'visible'});await settled(p);
   }
   check(await p.locator('#practiceInputRecovery').isHidden(),condition+' recovery clears pause explanation');
   equal(await p.evaluate(()=>localStorage.getItem('gf-collection-v1')),currentSave['gf-collection-v1'],'locked practice preserves legacy collection');
  }finally{release();await ctx.close();}
 }
 for(const mode of ['classic','daily','challenge','practice'])for(const reduced of [true,false]){
  const ctx=await newContext({locale:'fr-FR',viewport:{width:320,height:568},isMobile:true,hasTouch:true,reducedMotion:reduced?'reduce':'no-preference',storageState:profile});const p=await ctx.newPage();
  try{
   console.log('  Nigeria:',mode,reduced?'reduced':'animated');
   await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
   if(mode==='daily'){
    const date=await p.evaluate(()=>{for(let n=0;n<1000;n++){const d=new Date(Date.UTC(2026,9,10+n,12));if(GeoFactCore.dailySeries(GeoFactCountries,d)[0]==='NGA')return d.toISOString();}throw new Error('Nigeria Daily not found');});
    await p.clock.setFixedTime(new Date(date));await p.click('#chooseDaily');
   }else if(mode==='practice')await practice(p);
   else if(mode==='challenge'){const token=await p.evaluate(()=>{const level=GeoFactCountries.find(c=>c.iso==='NGA').difficulty;const series=['NGA',...GeoFactCountries.filter(c=>c.difficulty===level&&c.iso!=='NGA').slice(0,4).map(c=>c.iso)];return GeoFactCore.encodeChallenge(level,series,90);});await p.goto(url+'?challenge='+token);await p.locator('#challengeIntro').waitFor({state:'visible'});await p.click('#acceptChallenge');}
   else {const level=await p.evaluate(()=>{const base=GeoFactCore.shuffle;GeoFactCore.shuffle=(list,...rest)=>list.includes('NGA')?['NGA',...base(list.filter(x=>x!=='NGA'),...rest)]:base(list,...rest);return GeoFactCountries.find(c=>c.iso==='NGA').difficulty;});await p.click('#chooseGame');await p.click(`[data-level="${level}"]`);}
   await p.locator('#playing').waitFor({state:'visible'});equal(await p.locator('#countryName').textContent(),'Nigeria','Nigeria requested in '+mode);
   await tap('BEN','touch',p);check(await p.locator('#result').isHidden(),'wrong country has no anecdote');check(!(await p.locator('#map [data-iso=BEN]').getAttribute('class')).includes('country-found'),'wrong country is not validated green');
   await nativeNigeria(p);await p.locator('#result').waitFor({state:'visible'});
   await p.waitForFunction(()=>getComputedStyle(document.getElementById('result')).opacity==='1'&&getComputedStyle(document.querySelector('.fact-reward')).opacity==='1');
   check((await p.locator('#fact').textContent()).trim().length>10,'Nigeria anecdote is rendered and opaque');check(await p.locator('#next').isEnabled(),'Nigeria next enabled');
   await p.waitForFunction(()=>!document.querySelector('#map .country-correct'));
   equal(await p.locator('#map [data-iso=NGA]').evaluate(e=>getComputedStyle(e).fill),'rgb(74, 222, 128)','Nigeria permanent green');
   const fact=await p.locator('#fact').textContent(),score=await p.locator('#totalScore').textContent();
   for(const iso of ['BEN','GHA','FRA','NGA'])await tap(iso,'touch',p);
   equal(await p.locator('#fact').textContent(),fact,'extra taps preserve anecdote');equal(await p.locator('#totalScore').textContent(),score,'extra taps do not score');equal(await p.locator('#map .country-found').count(),1,'only Nigeria validated green');
   await p.selectOption('#lang','en');check((await p.locator('#fact').textContent()).trim().length>10,'Nigeria anecdote translates');
   if(mode==='practice')await settled(p);
   await p.click('#next');await p.locator('#result').waitFor({state:'hidden'});equal(await p.locator('#map .country-found').count(),0,'next round clears success');
   const iso=await p.evaluate(()=>GeoFactCountries.find(c=>c.name.en===document.getElementById('countryName').textContent).iso);await tap(iso,'touch',p);await p.locator('#result').waitFor({state:'visible'});check((await p.locator('#fact').textContent()).trim().length>10,'following round progresses');
   equal(await p.evaluate(()=>localStorage.getItem('gf-collection-v1')),currentSave['gf-collection-v1'],'legacy collection unchanged');equal(await p.evaluate(()=>localStorage.getItem('gf-daily-v1')),currentSave['gf-daily-v1'],'legacy Daily unchanged');
  }finally{await ctx.close();}
 }
 {
  const ctx=await newContext({locale:'fr-FR',viewport:{width:320,height:568},isMobile:true,hasTouch:true,reducedMotion:'reduce',storageState:profile});const p=await ctx.newPage();try{
   await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();equal(await p.locator('#homeBonusProgress').textContent(),"Coffres bonus : 0/2 aujourd'hui",'home quota only');equal(await p.locator('.practice-bonus-copy').count(),0,'paragraph completely removed');check((await p.locator('#choosePractice').textContent()).includes('Joue sans limite'),'practice subtitle kept');
   await practice(p);check(await p.locator('#streak').isHidden(),'session streak replaced by persisted bonus streak');await tap('NGA','touch',p);await settled(p);await p.click('#next');
   // A native transaction holds the write queue; the UI must still update synchronously.
   await p.evaluate(async()=>{const db=await new Promise((ok,bad)=>{const q=indexedDB.open('geofact-rewards');q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error);});const tx=db.transaction(['state','chests','sessions'],'readwrite'),start=performance.now();const pump=()=>{const q=tx.objectStore('sessions').get('hold');q.onsuccess=()=>{if(performance.now()-start<700)pump();};};pump();tx.oncomplete=()=>db.close();});
   await tap('NGA','touch',p);equal(await p.locator('#practiceBonusProgress').textContent(),"Pays trouvés d'affilée : 2/10",'streak updates before write confirmation');equal(await p.locator('#practiceBonusQuota').textContent(),'Coffres bonus : 0/2','quota remains committed');equal(await p.locator('#practiceBonusMeter').getAttribute('aria-label'),"Pays trouvés d'affilée : 2/10",'accessible meter');await settled(p);
   await p.selectOption('#lang','en');equal(await p.locator('#practiceBonusProgress').textContent(),'Countries found in a row: 2/10','English streak');equal(await p.locator('#practiceBonusQuota').textContent(),'Bonus chests: 0/2','English practice quota');
   await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(await p.locator('#homeBonusProgress').textContent(),'Bonus chests: 0/2 today','reload home has no streak');await practice(p);equal(await p.locator('#practiceBonusProgress').textContent(),'Countries found in a row: 2/10','reload restores streak');
   const q=await ctx.newPage();await q.goto(url);await q.locator('#chooseDaily:enabled').waitFor();await practice(q);await tap('NGA','touch',q);await settled(q);await p.waitForFunction(()=>document.getElementById('practiceBonusProgress').textContent.endsWith('3/10'));equal(await p.locator('#practiceBonusQuota').textContent(),'Bonus chests: 0/2','two tabs same quota');await q.close();
   const before=await read(p);await p.evaluate(()=>{window.iphoneOriginalTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(mode==='readwrite')throw new DOMException('Full','QuotaExceededError');return iphoneOriginalTransaction.call(this,stores,mode,...rest);};});
   await tap('NGA','touch',p);await p.locator('#result').waitFor({state:'visible'});await p.locator('#rewardStatus').filter({hasText:'Progress not confirmed'}).waitFor();check((await p.locator('#fact').textContent()).trim().length>10,'storage failure does not hide anecdote');check(await p.locator('#next').isDisabled(),'storage failure explicitly blocks practice continuation');equal(await read(p),before,'failed answer leaves durable state unchanged');
   await p.evaluate(()=>IDBDatabase.prototype.transaction=iphoneOriginalTransaction);await p.click('#retryPracticeRewards');await settled(p);check(await p.locator('#next').isEnabled(),'inline storage recovery resumes progression');await p.click('#next');await p.locator('#result').waitFor({state:'hidden'});
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px counters no overflow');
  }finally{await ctx.close();}
 }
}
