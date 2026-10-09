import {currentSave} from './save-fixtures.mjs';
export async function testReleaseAudit({newContext,url,tap,check,equal}) {
 const origin=new URL(url).origin;
 const read=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{return await r.read();}finally{r.close();}});
 const profile={cookies:[],origins:[{origin,localStorage:Object.entries(currentSave).map(([name,value])=>({name,value}))}]};
 console.log('Release audit: isolated practice errors, stale cache, FR/EN and small screens…');
 for(const failure of ['denied','malformed']){
  const ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce',storageState:profile});
  await ctx.addInitScript(failure=>{if(location.protocol!=='http:')return;if(failure==='denied')Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Denied','SecurityError');}});else sessionStorage.setItem('gf-pending-practice-v1','{invalid');},failure);
  const p=await ctx.newPage();try{
   await p.clock.install({time:new Date('2026-10-09T12:00:00Z')});await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();const before=await read(p);
   await p.click('#chooseDaily');await p.locator('#playing').waitFor({state:'visible'});if(failure==='malformed')await p.evaluate(()=>{window.auditTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(mode==='readwrite')throw new DOMException('Full','QuotaExceededError');return auditTransaction.call(this,stores,mode,...rest);};});const series=await p.evaluate(()=>GeoFactCore.dailySeries(GeoFactCountries));
   for(const iso of series){equal(await p.evaluate(()=>GeoFactCountries.find(c=>c.name[document.documentElement.lang]===document.getElementById('countryName').textContent).iso),iso,'expected Daily country');await tap(iso,'touch',p);await p.locator('#result').waitFor({state:'visible'});await p.click('#next');}
   if(failure==='malformed'){await p.locator('#rewardStatus').filter({hasText:'Récompense non confirmée'}).waitFor();equal((await read(p)).collection,before.collection,'failed Daily leaves collection unchanged');await p.evaluate(()=>IDBDatabase.prototype.transaction=window.auditTransaction);await p.click('#retryRewards');}
   await p.locator('#dailyChest').waitFor({state:'visible'});const saved=await read(p);
   check(!!saved.daily.days['2026-10-09'].card,failure+' practice journal does not block Daily commit');
   equal(Object.keys(saved.credits).length,Object.keys(before.credits).length+1,'one Daily credit');
   await p.click('#openChest');await p.locator('#cardReveal').waitFor({state:'visible'});await p.reload();await p.locator('#chooseDaily:enabled').waitFor();
   equal((await read(p)).collection,saved.collection,'Daily reveal/reload adds no copies');
   equal(await p.evaluate(()=>localStorage.getItem('gf-collection-v1')),currentSave['gf-collection-v1'],'old collection unchanged');
   equal(await p.evaluate(()=>localStorage.getItem('gf-daily-v1')),currentSave['gf-daily-v1'],'old Daily unchanged');
   if(failure==='malformed')equal(await p.evaluate(()=>sessionStorage.getItem('gf-pending-practice-v1')),'{invalid','unreadable journal preserved');
  }finally{await ctx.close();}
 }
 {
  const ctx=await newContext({locale:'fr-FR',reducedMotion:'reduce'}),requests=[];
  await ctx.route(/\/(?:map\.js|core\.js|reward-repository\.mjs)(?:\?|$)/,route=>{
   const u=new URL(route.request().url());return u.searchParams.get('v')?route.continue():route.fulfill({contentType:'text/javascript',body:"throw new Error('Incompatible cached release')"});
  });
  ctx.on('request',r=>{if(/\.(?:js|mjs|css)(?:\?|$)/.test(r.url()))requests.push(r.url());});
  const p=await ctx.newPage();try{
   await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
   await p.evaluate(()=>{GeoFactCore.shuffle=list=>list.includes('FRA')?['FRA']:list;});await p.click('#choosePractice');await p.click('#practiceByDifficulty');await p.click('[data-level=easy]');await p.locator('#playing').waitFor({state:'visible'});
   await tap('BEL','mouse',p);check((await p.locator('#distanceReaction').textContent()).includes('voisin'),'current border code despite stale cache');
   await tap('FRA','mouse',p);await p.locator('#result').waitFor({state:'visible'});
   equal(await p.locator('#map [data-iso=FRA]').evaluate(e=>getComputedStyle(e).fill),'rgb(74, 222, 128)','current permanent-green map despite stale cache');
   check(requests.length>=12,'reward module graph loaded');for(const request of requests)equal(new URL(request).searchParams.get('v'),'20261009-update1','versioned release resource');
  }finally{await ctx.close();}
 }
 for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[430,932],[568,320],[768,1024],[1280,800]]){
  const ctx=await newContext({viewport:{width,height},hasTouch:width<768,isMobile:width<768,reducedMotion:'reduce',storageState:profile});const p=await ctx.newPage();
  async function fit(label){
   const dimensions=await p.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
   check(dimensions.content<=dimensions.viewport+1,`${width}x${height} ${label} no horizontal overflow (${dimensions.content})`);
  }
  try{
   await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();check(await p.locator('#openBonusRewards').isHidden(),'no empty chest action');
   for(const lang of ['fr','en']){
    await p.selectOption('#lang',lang);await fit(lang+' home');
    await p.click('#howToPlay');await fit(lang+' help');equal(await p.locator('#closeHow').getAttribute('aria-label'),lang==='fr'?'Fermer':'Close','translated close label');await p.click('#closeHow');
    await p.click('#choosePractice');await p.click('#practiceCustom');await fit(lang+' picker');await p.locator('input[value="FRA"]').check();await p.click('#startCustomPractice');await p.locator('#playing').waitFor({state:'visible'});await fit(lang+' map');
    await tap('FRA','touch',p);await p.locator('#result').waitFor({state:'visible'});await fit(lang+' anecdote');await p.selectOption('#lang',lang==='fr'?'en':'fr');
    equal(await p.locator('#map [data-iso=FRA]').evaluate(e=>getComputedStyle(e).fill),'rgb(74, 222, 128)','green during language change');await p.click('#brand');
    await p.click('#openCollection');await p.locator('#collection').waitFor({state:'visible'});for(const sort of ['alpha','date','rarity','continent']){await p.selectOption('#collectionSort',sort);await fit(lang+' collection '+sort);}await p.click('#brand');
   }
   await p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{for(let n=0;n<10;n++)await r.answer({id:'viewport:'+n,roundId:'viewport-round:'+n,mode:'practice',correct:true,at:Date.now(),countryDraw:0,rarityDraw:.4},['FRA']);}finally{r.close();}});
   await p.click('#openCollection');await p.click('#brand');await p.click('#openBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});await fit('bonus dialog');
   check(await p.locator('#bonusDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'bonus modal fits width');await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor({state:'visible'});await fit('bonus reveal');await p.click('#closeBonusRewards');check(await p.locator('#openBonusRewards').isHidden(),'chest action hidden after last opening');
  }finally{await ctx.close();}
 }
}
