import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {currentSave,legacySave} from './save-fixtures.mjs';
import {testMusicIntegration} from './music-integration.mjs';
import {testMobileAudio} from './mobile-audio.mjs';
import {testHomeRedesign} from './home-redesign.mjs';
import {testHighlight} from './highlight.mjs';
import {testBorders} from './borders.mjs';
import {testRepository} from './repository.mjs';
import {testLegacyImport} from './legacy-import.mjs';
import {testDailyStorage} from './daily-storage.mjs';
import {testUpdateIntegration} from './update-integration.mjs';
import {testIphoneRegression} from './iphone-regression.mjs';
import {testReleaseAudit} from './release-audit.mjs';
import {testBonusIntegration} from './bonus-integration.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const browserTypes = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browserName = process.env.PLAYWRIGHT_BROWSER || 'chromium';
if (!['chromium','webkit','firefox'].includes(browserName)) throw new Error('Unsupported PLAYWRIGHT_BROWSER');
const browserType = browserTypes[browserName];
const core = require('../core.js');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    const type = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type':type}); res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
let browser;
try { browser = await browserType.launch({ headless: true, ...(browserName==='chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args:['--disable-dev-shm-usage'] } : {}) });
} catch (error) { await new Promise(resolve=>server.close(resolve)); throw error; }
let assertions=0;
const check=(value,message)=>{ assert.ok(value,message);assertions++; };
const equal=(value,expected,message)=>{ assert.deepEqual(value,expected,message);assertions++; };
const errors=[];
const telemetry=[];
const unexpectedRequests=[];
async function newContext(options, {failSupabase=false}={}) {
  const context=await browser.newContext({ serviceWorkers:'block', ...options });
  await context.route('**/*', async route=>{
    const request=route.request(), target=new URL(request.url());
    if(target.origin===new URL(url).origin) return route.continue();
    if(target.origin==='https://wpxaliifkzyhjsucavbr.supabase.co' && ['/rest/v1/rpc/geofact_record_event','/rest/v1/rpc/geofact_stats'].includes(target.pathname)) {
      telemetry.push({method:request.method(),rpc:target.pathname.split('/').at(-1),body:request.postDataJSON(),hasAPIKey:!!request.headers().apikey});
      if(failSupabase) return route.abort('failed');
      return route.fulfill({status:200,contentType:'application/json',body:target.pathname.endsWith('/geofact_stats') ? JSON.stringify([{visitors:12,players:8,daily_started:6,daily_completed:5,chests_opened:4,challenges_completed:3}]) : 'null'});
    }
    unexpectedRequests.push(request.url());
    return route.abort();
  });
  context.on('page',p=>{
    p.on('pageerror',error=>errors.push(error.message));
    p.on('response',r=>{if(new URL(r.url()).origin===new URL(url).origin && r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
  });
  return context;
}
const context=await newContext({viewport:{width:1280,height:850},locale:'fr-FR'});
const page=await context.newPage();
async function visible(id,value=true){equal(await page.locator('#'+id).isVisible(),value,id+' visibility');}
async function countryName(){return page.locator('#countryName').textContent();}
// Synthetic selections deliberately use a point outside the SVG, so the event
// target is used rather than an unrelated country at a fixed screen coordinate.
// Native mouse/gesture tests below cover the real pointer path separately.
async function tap(iso, type='mouse', targetPage=page){
  await targetPage.evaluate(({iso,type})=>{
    const target=document.querySelector(`[data-iso="${iso}"]`);
    for(const event of ['pointerdown','pointerup']) target.dispatchEvent(new PointerEvent(event,{bubbles:true,pointerId:1,pointerType:type,clientX:-1,clientY:-1,button:0}));
  },{iso,type});
}
async function gesture(steps){
  await page.evaluate(steps=>{
    const target=document.querySelector('[data-iso="FRA"]');
    for(const [event,id,x,y] of steps) target.dispatchEvent(new PointerEvent(event,{bubbles:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0}));
  },steps);
}
const series=['FRA','JPN','USA','GBR','NOR'];
async function challenge(score=94,base=url){await page.goto(base+'?challenge='+core.encodeChallenge('easy',series,score));await visible('challengeIntro');await page.click('#acceptChallenge');}
async function finishPerfect(){for(const iso of series){await tap(iso);await visible('result');await page.click('#next');}}
try {
  console.log('HTTP gameplay, interactions and sharing…');
  await page.goto(url);
  await visible('home'); equal(await page.locator('html').getAttribute('lang'),'fr','French browser detection');
  for(const mode of ['chooseGame','choosePractice']) for(const level of ['easy','medium','hard']){
    await page.click('#'+mode); if(mode==='choosePractice') await page.click('#practiceByDifficulty'); await page.click(`[data-level="${level}"]`); await visible('playing'); check((await countryName()).length>0,'round has a country');
    const selected=await page.evaluate(name=>GeoFactCountries.find(c=>c.name.fr===name).difficulty,await countryName());equal(selected,level,'selected difficulty');
    await page.click('#brand');await visible('home');
  }
  await challenge();
  equal(await countryName(),'France','challenge order');
  await page.evaluate(()=>{localStorage.setItem('wg-best','999');window.shared=[];Object.defineProperty(navigator,'share',{configurable:true,value:async p=>window.shared.push(p)});});
  await gesture([['pointerdown',1,200,300],['pointermove',1,240,300],['pointermove',1,200,300],['pointerup',1,200,300]]);
  await visible('result',false);await visible('distanceRow',false);
  await gesture([['pointerdown',1,200,300],['pointercancel',1,200,300],['pointerup',1,200,300]]);
  await visible('result',false);await visible('distanceRow',false);
  await gesture([['pointerdown',1,200,300],['pointerdown',2,400,300],['pointermove',1,150,300],['pointermove',2,450,300],['pointerup',2,450,300],['pointerup',1,150,300]]);
  await visible('result',false); await visible('distanceRow',false);
  check(+(await page.locator('#map').getAttribute('viewBox')).split(' ')[2]<1200,'pinch zooms');
  await page.click('#resetMap');
  equal(await page.locator('#map').getAttribute('viewBox'),'0 0 1200 600','reset map');
  await page.evaluate(()=>document.querySelector('.ocean').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'mouse',clientX:100,clientY:200})));
  await page.evaluate(()=>document.querySelector('.ocean').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType:'mouse',clientX:100,clientY:200})));
  await visible('distanceRow',false);
  await tap('BEL'); await visible('result',false); await visible('distanceRow');
  equal(await page.locator('#distance').textContent(),'','no kilometres for land neighbour');await visible('distance',false);check((await page.locator('#distanceReaction').textContent()).includes("Tout près ! C'est un pays voisin."),'French neighbour message');equal(await page.locator('#penalty').textContent(),'−1 points','wrong-guess penalty');
  equal(await page.locator('#map circle.microstate').count(),29,'microstate geometries');equal(await page.locator('#map circle.microstate-marker').count(),29,'microstate display markers');
  await page.selectOption('#lang','en');equal(await countryName(),'France');equal(await page.locator('#roundPoints').textContent(),'19 points');
  // Native mouse input at a genuine interior point of metropolitan France.
  const centre=await page.evaluate(()=>{const s=document.getElementById('map'),p=s.createSVGPoint();p.x=(2.5+180)/.3;p.y=(90-48)/.3;const q=p.matrixTransform(s.getScreenCTM());return{x:q.x,y:q.y};});
  await page.mouse.click(centre.x,centre.y);await visible('result');
  equal(await page.locator('#totalScore').textContent(),'19 / 100','round total');
  const frenchBefore=await page.evaluate(()=>localStorage.getItem('wg-seen-facts'));
  const factEN=await page.locator('#fact').textContent();
  await page.selectOption('#lang','fr');const factFR=await page.locator('#fact').textContent();check(factFR!==factEN,'fact translated');
  equal(await page.evaluate(()=>localStorage.getItem('wg-seen-facts')),frenchBefore,'language preserves fact selection');
  await page.selectOption('#lang','en');equal(await page.locator('#fact').textContent(),factEN,'same fact when switching back');
  await page.click('#shareFact');
  const share=await page.evaluate(()=>window.shared[0]);equal(share.title,'GeoFact');check(share.text.includes(factEN),'shares current fact');check(!share.text.includes(share.url),'native URL only in URL field');equal(share.url,url);
  await page.click('#zoomIn');const zoomed=await page.locator('#map').getAttribute('viewBox');
  await page.mouse.move(600,450);await page.mouse.down();await page.mouse.move(650,480,{steps:5});await page.mouse.up();
  check(await page.locator('#map').getAttribute('viewBox')!==zoomed,'pan works after answering');equal(await page.locator('#totalScore').textContent(),'19 / 100','no extra guesses after success');
  await page.click('#next');
  for(const iso of series.slice(1)){
    equal(await countryName(),await page.evaluate(iso=>GeoFactCountries.find(c=>c.iso===iso).name.en,iso),'challenge next country');
    await tap(iso);await page.click('#next');
  }
  await visible('final');equal(await page.locator('#map .country-found, #map .country-correct').count(),0,'finishing a game clears the answer');equal(await page.locator('#finalScore').textContent(),'99 / 100');check((await page.locator('#versus').textContent()).includes('+5'),'challenge win margin');
  await page.click('#challengeFriend');const challengeShare=await page.evaluate(()=>window.shared.at(-1));
  const sharedURL=new URL(challengeShare.url);equal([...sharedURL.searchParams.keys()],['challenge'],'single challenge parameter');
  equal(core.parseChallenge(sharedURL.searchParams.get('challenge'),await page.evaluate(()=>GeoFactCountries)),{v:4,d:'easy',c:series,s:94,r:99},'shared series and both scores');
  await page.click('#brand');await visible('home');equal(page.url(),url,'home cleans challenge URL');equal(await page.evaluate(()=>localStorage.getItem('wg-best')),'999','legacy best key preserved');
  check(JSON.parse(await page.evaluate(()=>localStorage.getItem('wg-stats'))).solved===5,'stats only count successes');
  await page.reload();equal(await page.locator('html').getAttribute('lang'),'en','language remembered');
  await challenge(100);await finishPerfect();check((await page.locator('#versus').textContent()).includes('tie'),'challenge tie');
  await challenge(100);await tap('BEL');await finishPerfect();check((await page.locator('#versus').textContent()).includes('−1'),'challenge defeat');
  await page.goto(url+'?challenge=broken');await visible('home');
  await page.click('#choosePractice');await page.click('#practiceByDifficulty');await page.click('[data-level="hard"]');
  await visible('roundLabel',false);await visible('totalScore',false);await visible('roundPoints',false);
  for(let i=0;i<7;i++){
    const target=await page.evaluate(name=>GeoFactCountries.find(c=>c.name[document.documentElement.lang]===name).iso,await countryName());
    await tap(target,'touch');await visible('result');await visible('roundEarned',false);await page.click('#next');await visible('playing');
  }
  // Exercise the rendered CTM and selection priority at different zoom levels.
  const hitboxResults=await page.evaluate(async()=>{
    const original=document.getElementById('map'),svg=original.cloneNode(true);svg.removeAttribute('id');svg.querySelector('.microstate-marker-layer')?.remove();original.parentNode.appendChild(svg);const controller=GeoFactMap(svg,()=>{});
    const output=[];
    for(const zoom of [1,10,80]){
      controller.reset();controller.zoom(zoom);
      // Markers can move away from their geographic anchor to avoid overlap.
      // setView schedules layout; explicitly allow it to finish before measuring.
      await new Promise(requestAnimationFrame);
      const marker=svg.querySelector('.microstate-marker[data-iso="TUV"]'),r=marker.getBoundingClientRect();
      const x=r.left+r.width/2,y=r.top+r.height/2;
      output.push(controller.resolveCountry(svg,x+12,y,'touch')==='TUV');
      output.push(controller.resolveCountry(svg,x+12,y,'mouse')!=='TUV');
      output.push(controller.resolveCountry(svg.querySelector('[data-iso="FRA"]'),x,y,'touch')==='FRA');
    }
    controller.reset();for(let i=0;i<30;i++)controller.zoom(1.5);output.push(controller.getView().w===4&&controller.getView().h===2);controller.reset();svg.remove();return output;
  });
  for(const result of hitboxResults)check(result,'screen hitbox / real path priority / zoom cap');
  // A blocked native share falls back; an intentional cancellation does not.
  const target=await page.evaluate(name=>GeoFactCountries.find(c=>c.name.en===name).iso,await countryName());await tap(target);
  await page.evaluate(()=>{window.copied=[];Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new Error('Unavailable')}});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copied.push(text)}});});
  await page.click('#shareFact');const copied=await page.evaluate(()=>window.copied[0]);equal(copied.split(url).length-1,1,'clipboard URL once');
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError')}}));await page.click('#shareFact');equal(await page.evaluate(()=>window.copied.length),1,'share cancellation ignored');
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});});await page.click('#shareFact');await visible('copyDialog');check((await page.locator('#copyText').inputValue()).includes(url),'manual copy fallback');await page.click('#closeCopy');
  for(const width of [320,375,390,430,768,1280]){
    await page.setViewportSize({width,height:844});await page.click('#brand');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home no overflow '+width);
    await page.click('#chooseGame');await page.click('[data-level="easy"]');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'game no overflow '+width);
    const target=await page.evaluate(name=>GeoFactCountries.find(c=>c.name.en===name).iso,await countryName());await tap(target);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'result no overflow '+width);
  }

  const english=await newContext({locale:'en-GB',viewport:{width:390,height:844},hasTouch:true,isMobile:true});const mobile=await english.newPage();
  await mobile.goto(url);equal(await mobile.locator('html').getAttribute('lang'),'en','fresh English browser');
  await mobile.goto(url+'?challenge='+core.encodeChallenge('easy',series,74));check(await mobile.locator('#challengeIntro').isVisible(),'HTTP mobile challenge');await mobile.click('#acceptChallenge');
  const blocked=await newContext({locale:'fr-FR'});await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}));const restricted=await blocked.newPage();await restricted.goto(url);await restricted.click('#chooseGame');await restricted.click('[data-level="easy"]');check(await restricted.locator('#playing').isVisible(),'works with storage disabled');
  console.log('Territories and single-country practice…');
  // Territories resolve facts/history through the country, while wrong guesses
  // retain the territory name and its territorial distance.
  for (const [region,parent] of [['FRA-GF','FRA'],['USA-AK','USA'],['USA-HI','USA']]) {
    const regionalSeries=parent==='FRA'?series:['USA','FRA','JPN','GBR','NOR'];
    await page.goto(url+'?challenge='+core.encodeChallenge('easy',regionalSeries,100));
    await page.click('#acceptChallenge');
    await tap(region);await visible('result');
    equal(await page.locator('#totalScore').textContent(),'20 / 100',region+' accepted');
    const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('wg-seen-facts')));
    check(!!history[parent] && !(region in history),region+' parent history key');
    equal(await page.locator('#fact').textContent(),await page.evaluate(({parent,index})=>GeoFactFacts[parent][index][document.documentElement.lang],{parent,index:history[parent].last}),region+' parent fact');
    await page.click('#next');await visible('playing');await visible('result',false);
    await page.goto(url+'?challenge='+core.encodeChallenge('easy',['JPN','FRA','USA','GBR','NOR'],100));
    await page.click('#acceptChallenge');await tap(region);await visible('distanceRow');await visible('result',false);
    check(/km$/.test(await page.locator('#distance').textContent()),region+' wrong distance');
    check((await page.locator('#distanceReaction').textContent()).includes(region==='FRA-GF'?'Guiana':region==='USA-AK'?'Alaska':'Hawaii'),region+' wrong territory label');
  }
  await page.goto(url);await page.click('#choosePractice');await page.click('#practiceCustom');
  await page.locator('#practiceCountryList input[value="FRA"]').check();await page.click('#startCustomPractice');
  for(let round=0;round<12;round++) {
    equal(await countryName(),'France','single-country round '+round);
    await tap('FRA');await visible('result');await page.click('#next');await visible('playing');await visible('result',false);
  }

  console.log('Existing saves, Daily rewards and storage failures…');
  const rewardSnapshot=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');const repo=await openRewardRepository();try{return await repo.read();}finally{repo.close();}});
  const snapshot=p=>p.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  async function savedContext(seed, {quotaExceeded=false}={}) {
    const ctx=await newContext({locale:'fr-FR',storageState:{cookies:[],origins:[{origin:new URL(url).origin,localStorage:Object.entries(seed).map(([name,value])=>({name,value}))}]}});
    if(quotaExceeded) await ctx.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});
    const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-08T12:00:00Z')});await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
    return {ctx,p};
  }
  for(const [label,seed] of [['current',currentSave],['legacy',legacySave]]) {
    const {ctx,p}=await savedContext(seed);
    equal(await snapshot(p),seed,label+' load preserves every stored byte and key');
    await p.click('#openCollection');
    check((await p.locator('#collectionCount').textContent()).includes(label==='current'?'3 / 780':'1 / 780'),label+' collection rendered');
    if(label==='current') {
      await p.locator('#collectionGrid .collection-card').filter({has:p.locator('h3', {hasText:'France'})}).click();
      check((await p.locator('#collectionDetail').textContent()).includes('×3'),'duplicate copies rendered in rarity detail');
    }
    await p.reload();equal(await snapshot(p),seed,label+' reload preserves stored save');
    await ctx.close();
  }
  const {ctx:saveContext,p:savePage}=await savedContext(currentSave);
  await savePage.goto(url+'?challenge='+core.encodeChallenge('easy',series,100));await savePage.click('#acceptChallenge');
  await tap('FRA','mouse',savePage);
  await savePage.locator('#result').waitFor({state:'visible'});
  const afterAnswer=await snapshot(savePage);
  for(const key of Object.keys(currentSave).filter(k=>!['wg-stats','wg-seen-facts'].includes(k))) equal(afterAnswer[key],currentSave[key],'answer preserves '+key);
  equal(JSON.parse(afterAnswer['wg-stats']),{solved:41,totalClicks:56,oneClick:31},'existing stats incremented without reset');
  equal(JSON.parse(afterAnswer['wg-seen-facts']).JPN,JSON.parse(currentSave['wg-seen-facts']).JPN,'unrelated fact history preserved');
  await savePage.reload();equal(await snapshot(savePage),afterAnswer,'updated progress persists across reload');
  await saveContext.close();

  // Completing and opening a Daily may change its own save and collection,
  // but must preserve every previously owned copy and historical result.
  const {ctx:dailyContext,p:dailyPage}=await savedContext(currentSave);
  await dailyPage.emulateMedia({reducedMotion:'reduce'});
  await dailyPage.click('#chooseDaily');
  await dailyPage.locator('#playing').waitFor({state:'visible'});
  const dailySeries=await dailyPage.evaluate(()=>GeoFactCore.dailySeries(GeoFactCountries));
  for(const iso of dailySeries) { await tap(iso,'touch',dailyPage);await dailyPage.locator('#result').waitFor({state:'visible'});await dailyPage.click('#next'); }
  await dailyPage.locator('#final').waitFor({state:'visible'});
  equal(await dailyPage.locator('#map .country-found, #map .country-correct').count(),0,'finishing Daily clears the answer');
  const earned=await snapshot(dailyPage),earnedState=await rewardSnapshot(dailyPage),daily=earnedState.daily;
  equal(earned['gf-collection-v1'],currentSave['gf-collection-v1'],'Daily leaves old collection untouched');
  equal(earned['gf-daily-v1'],currentSave['gf-daily-v1'],'Daily leaves old history untouched');
  equal(daily.days['2026-10-07'],JSON.parse(currentSave['gf-daily-v1']).days['2026-10-07'],'historical Daily preserved');
  equal([daily.played,daily.streak,daily.bestStreak],[8,4,5],'Daily counters extend existing history');
  const newCollection=earnedState.collection,oldCollection=JSON.parse(currentSave['gf-collection-v1']);
  let addedCopies=0;
  for(const [iso,entry] of Object.entries(newCollection)) {
    for(const [rarity,count] of Object.entries(entry.counts)) addedCopies+=count-(oldCollection[iso]?.counts[rarity]||0);
  }
  equal(addedCopies,1,'Daily adds exactly one card copy');
  for(const [iso,entry] of Object.entries(oldCollection)) {
    equal(newCollection[iso].firstUnlocked,entry.firstUnlocked,iso+' first acquisition retained');
    for(const rarity of entry.rarities) {
      check(newCollection[iso].rarities.includes(rarity),iso+' existing rarity retained');
      check(newCollection[iso].counts[rarity]>=entry.counts[rarity],iso+' copies retained');
      equal(newCollection[iso].acquiredAt[rarity],entry.acquiredAt[rarity],iso+' acquisition time retained');
    }
  }
  for(const key of ['wg-best','gf-best-scores','unrelated-setting']) equal(earned[key],currentSave[key],'Daily preserves '+key);
  const openedBefore=telemetry.filter(e=>e.body?.p_event_type==='chest_opened').length;
  await dailyPage.locator('#openChest').evaluate(button=>{button.click();button.click();});
  await dailyPage.locator('#cardReveal').waitFor({state:'visible'});
  equal((await rewardSnapshot(dailyPage)).daily.days['2026-10-08'].cardOpened,true,'chest opening saved');
  equal(telemetry.filter(e=>e.body?.p_event_type==='chest_opened').length-openedBefore,1,'double click records a single opening');
  equal((await rewardSnapshot(dailyPage)).collection,earnedState.collection,'opening does not award another card');
  const opened=await snapshot(dailyPage);await dailyPage.reload();await dailyPage.click('#chooseDaily');await dailyPage.locator('#final').waitFor({state:'visible'});
  equal(await snapshot(dailyPage),opened,'completed Daily replay does not alter saves or reward again');
  await dailyContext.close();

  const {ctx:quotaContext,p:quotaPage}=await savedContext(currentSave,{quotaExceeded:true});
  await quotaPage.goto(url+'?challenge='+core.encodeChallenge('easy',series,100));await quotaPage.click('#acceptChallenge');await tap('FRA','mouse',quotaPage);
  check(await quotaPage.locator('#result').isVisible(),'quota failure does not interrupt answering');
  equal(await snapshot(quotaPage),currentSave,'quota failure leaves existing saved bytes intact');await quotaContext.close();

  // Malformed/unknown bytes are not rewritten merely by loading the app.
  const malformed={...currentSave,'wg-stats':'{broken','wg-seen-facts':'null','gf-best-scores':'{}','gf-daily-v1':'{broken','gf-collection-v1':'null'};
  const {ctx:malformedContext,p:malformedPage}=await savedContext(malformed);
  equal(await snapshot(malformedPage),malformed,'malformed save preserved on load');await malformedContext.close();
  const failing=await newContext({locale:'en-GB'},{failSupabase:true});const failingPage=await failing.newPage();
  await failingPage.goto(url);await failingPage.click('#openPublicStats');await failingPage.locator('#statsStatus').filter({hasText:'unavailable'}).waitFor();
  await failingPage.goto(url+'?challenge='+core.encodeChallenge('easy',series,100));await failingPage.click('#acceptChallenge');await tap('FRA','mouse',failingPage);
  check(await failingPage.locator('#result').isVisible(),'Supabase outage does not prevent a correct answer');await failing.close();
  await restricted.goto(url+'?challenge='+core.encodeChallenge('easy',series,100));await restricted.click('#acceptChallenge');await tap('FRA','touch',restricted);
  check(await restricted.locator('#result').isVisible(),'storage disabled still allows answers');

  await page.goto(url);await page.click('#openPublicStats');await page.locator('#statVisitors').filter({hasText:'12'}).waitFor();
  equal(await page.locator('#statChests').textContent(),'4','mock public stats rendered');
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/geofact_stats') && r.request().postDataJSON().period_days===0),page.selectOption('#statsPeriod','0')]);
  check(telemetry.some(e=>e.rpc==='geofact_stats' && e.method==='POST' && e.body.period_days===30),'stats period contract');
  check(telemetry.some(e=>e.rpc==='geofact_record_event' && e.body.p_event_type==='challenge_completed'),'challenge event contract');
  console.log('Land-border feedback, translations and unchanged penalties…');
  await testBorders({newContext,url,core,tap,check,equal});
  console.log('Isolated transactional reward repository…');
  await testRepository({newContext,url,check,equal});
  await testLegacyImport({newContext,url,check,equal});
  await testDailyStorage({newContext,url,tap,check,equal,telemetry});
  await testBonusIntegration({newContext,url,tap,check,equal,telemetry,core});
  await testReleaseAudit({newContext,url,tap,check,equal});
  await testIphoneRegression({newContext,url,tap,core,check,equal});
  await testMusicIntegration({newContext,url,check,equal});
  await testMobileAudio({newContext,url,tap,check,equal});
  await testHomeRedesign({newContext,url,tap,check,equal});
  await testUpdateIntegration({newContext,url,tap,core,check,equal,telemetry});
  console.log('Persistent success highlight, all modes and reduced motion…');
  await testHighlight({newContext,url,core,tap,check,equal});
  console.log('Portable export not tested: GeoFact.html/export.py are absent; file:// is outside this HTTP suite.');
  equal(errors,[],'no browser errors or missing local resources');
  equal(unexpectedRequests,[],'no unexpected external requests');
  check(telemetry.every(e=>e.method==='POST' && e.hasAPIKey),'Supabase method and authentication header contract');
  for(const event of ['visit','game_started','daily_started','daily_completed','chest_opened','challenge_completed']) check(telemetry.some(e=>e.rpc==='geofact_record_event' && e.body.p_event_type===event),'mock event '+event);
  check(telemetry.filter(e=>e.rpc==='geofact_record_event').every(e=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(e.body.p_visitor_id)),'anonymous visitor contract');
  console.log(`${assertions} browser assertions passed (${browserName}, HTTP, desktop and mobile; Supabase mocked).`);
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
