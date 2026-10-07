import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const core = require('../core.js');
const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname === '/' ? 'index.html' : decodeURIComponent(pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    const type = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type':type}); res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const fileURL = pathToFileURL(path.join(root, 'index.html')).href;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote','--single-process','--use-gl=disabled','--disable-software-rasterizer'] } : {}) });
let assertions=0;
const check=(value,message)=>{ assert.ok(value,message);assertions++; };
const equal=(value,expected,message)=>{ assert.deepEqual(value,expected,message);assertions++; };
const errors=[];
const context=await browser.newContext({viewport:{width:1280,height:850},locale:'fr-FR'});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
async function visible(id,value=true){equal(await page.locator('#'+id).isVisible(),value,id+' visibility');}
async function countryName(){return page.locator('#countryName').textContent();}
async function tap(iso, type='mouse'){
  await page.evaluate(({iso,type})=>{
    const target=document.querySelector(`[data-iso="${iso}"]`);
    for(const event of ['pointerdown','pointerup']) target.dispatchEvent(new PointerEvent(event,{bubbles:true,pointerId:1,pointerType:type,clientX:250,clientY:300,button:0}));
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
  await page.goto(fileURL);
  await visible('home'); equal(await page.locator('html').getAttribute('lang'),'fr','French browser detection');
  for(const mode of ['chooseGame','choosePractice']) for(const level of ['easy','medium','hard']){
    await page.click('#'+mode); await page.click(`[data-level="${level}"]`); await visible('playing'); check((await countryName()).length>0,'round has a country');
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
  equal(await page.locator('#distance').textContent(),'10 km','territorial shared border');equal(await page.locator('#penalty').textContent(),'−1 point','wrong-guess penalty');
  equal(await page.locator('#map circle').count(),29,'no answer markers');
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
  await visible('final');equal(await page.locator('#finalScore').textContent(),'99 / 100');check((await page.locator('#versus').textContent()).includes('+5'),'challenge win margin');
  await page.click('#challengeFriend');const challengeShare=await page.evaluate(()=>window.shared.at(-1));
  const sharedURL=new URL(challengeShare.url);equal([...sharedURL.searchParams.keys()],['challenge'],'single challenge parameter');
  equal(core.parseChallenge(sharedURL.searchParams.get('challenge'),await page.evaluate(()=>GeoFactCountries)),{v:3,d:'easy',c:series,s:99},'shared series and score');
  await page.click('#brand');await visible('home');equal(page.url(),url,'home cleans challenge URL');equal(await page.evaluate(()=>localStorage.getItem('wg-best')),'999','legacy best key preserved');
  check(JSON.parse(await page.evaluate(()=>localStorage.getItem('wg-stats'))).solved===5,'stats only count successes');
  await page.reload();equal(await page.locator('html').getAttribute('lang'),'en','language remembered');
  await challenge(100);await finishPerfect();check((await page.locator('#versus').textContent()).includes('tie'),'challenge tie');
  await challenge(100);await tap('BEL');await finishPerfect();check((await page.locator('#versus').textContent()).includes('−1'),'challenge defeat');
  await page.goto(url+'?challenge=broken');await visible('home');
  await page.click('#choosePractice');await page.click('[data-level="hard"]');
  await visible('roundLabel',false);await visible('totalScore',false);await visible('roundPoints',false);
  for(let i=0;i<7;i++){
    const target=await page.evaluate(name=>GeoFactCountries.find(c=>c.name[document.documentElement.lang]===name).iso,await countryName());
    await tap(target,'touch');await visible('result');await visible('roundEarned',false);await page.click('#next');await visible('playing');
  }
  // Exercise the rendered CTM and selection priority at different zoom levels.
  const hitboxResults=await page.evaluate(()=>{
    const svg=document.getElementById('map'),controller=GeoFactMap(svg,()=>{});
    const output=[];
    for(const zoom of [1,10,80]){
      controller.reset();controller.zoom(zoom);
      const circle=svg.querySelector('[data-iso="TUV"]'),p=svg.createSVGPoint();p.x=+circle.getAttribute('cx');p.y=+circle.getAttribute('cy');const q=p.matrixTransform(svg.getScreenCTM());
      output.push(controller.resolveCountry(svg,q.x+20,q.y,'touch')==='TUV');
      output.push(controller.resolveCountry(svg,q.x+20,q.y,'mouse')!=='TUV');
      output.push(controller.resolveCountry(svg.querySelector('[data-iso="FRA"]'),q.x,q.y,'touch')==='FRA');
    }
    controller.reset();for(let i=0;i<30;i++)controller.zoom(1.5);output.push(controller.getView().w===15&&controller.getView().h===7.5);controller.reset();return output;
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

  const english=await browser.newContext({locale:'en-GB',viewport:{width:390,height:844},hasTouch:true,isMobile:true});const mobile=await english.newPage();
  mobile.on('pageerror',error=>errors.push(error.message));await mobile.goto(fileURL);equal(await mobile.locator('html').getAttribute('lang'),'en','fresh English browser');
  await mobile.screenshot({path:path.join(root,'tests/mobile-home.png')});
  await mobile.goto(fileURL+'?challenge='+core.encodeChallenge('easy',series,3700));check(await mobile.locator('#challengeIntro').isVisible(),'local file challenge');await mobile.click('#acceptChallenge');
  await mobile.screenshot({path:path.join(root,'tests/mobile-game.png')});
  const blocked=await browser.newContext({locale:'fr-FR'});await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}));const restricted=await blocked.newPage();restricted.on('pageerror',error=>errors.push(error.message));await restricted.goto(fileURL);await restricted.click('#chooseGame');await restricted.click('[data-level="easy"]');check(await restricted.locator('#playing').isVisible(),'works with storage disabled');
  const portable=await browser.newContext({locale:'fr-FR'});const offline=await portable.newPage();let externalRequests=0;
  offline.on('pageerror',error=>errors.push(error.message));await offline.route(/^https?:/,route=>{externalRequests++;return route.abort();});
  await offline.goto(pathToFileURL(path.join(root,'GeoFact.html')).href);check(await offline.locator('#home').isVisible(),'portable HTML opens');
  await offline.click('#chooseGame');await offline.click('[data-level="easy"]');check(await offline.locator('#playing').isVisible(),'portable HTML plays');
  const selected=await offline.evaluate(()=>{const name=document.getElementById('countryName').textContent;return GeoFactCountries.find(c=>c.name.fr===name).iso;});
  await offline.evaluate(iso=>{const p=document.querySelector(`[data-iso="${iso}"]`);for(const type of ['pointerdown','pointerup'])p.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:8,pointerType:'mouse',clientX:200,clientY:300}));},selected);
  check(await offline.locator('#result').isVisible(),'portable HTML can validate an answer');equal(externalRequests,0,'portable HTML has no external requests');
  equal(errors,[],'no browser errors or missing local resources');
  console.log(`${assertions} browser assertions passed (file:// and HTTP, desktop and mobile).`);
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
