// Serve an archived release, then the candidate on the same origin and profile.
// Only synthetic saves are used; no player profile or real Supabase call is read.
import assert from 'node:assert/strict';
import {readFile, access, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {currentSave} from './save-fixtures.mjs';

const candidate=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
if(!process.env.GEOFACT_BASELINE_DIR)throw new Error('GEOFACT_BASELINE_DIR must point to an archived release');
const baseline=path.resolve(process.env.GEOFACT_BASELINE_DIR);
await access(path.join(baseline,'index.html'));
let root=baseline,checks=0;
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const server=createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':decodeURIComponent(name)));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{
    const body=await readFile(file);
    const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream';
    // Keep the previous assets cached; the document is fetched after the switch.
    res.writeHead(200,{'Content-Type':type,'Cache-Control':name==='/'?'no-cache':'public, max-age=3600'}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
const errors=[],unexpected=[];
async function snapshot(page){
  return page.evaluate(async()=>{
    const request=indexedDB.open('geofact-rewards');
    const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{
      const names=[...db.objectStoreNames],tx=db.transaction(names,'readonly');
      const stores=await Promise.all(names.map(name=>new Promise((resolve,reject)=>{
        const request=tx.objectStore(name).getAll();request.onsuccess=()=>resolve([name,request.result]);request.onerror=()=>reject(request.error);
      })));
      return {database:{name:db.name,version:db.version,stores:Object.fromEntries(stores)},local:{...localStorage},session:{...sessionStorage}};
    }finally{db.close();}
  });
}
async function context(seed=true){
  const ctx=await browser.newContext({locale:'fr-FR',reducedMotion:'reduce',serviceWorkers:'block'});
  // Playwright routing disables Chromium's HTTP cache. Reproduce the previous
  // release's warm asset cache explicitly, keyed by the complete resource URL.
  const cachedAssets=new Map();
  await ctx.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin===new URL(url).origin){
      if(/\.(?:js|mjs|css)$/.test(u.pathname)){
        const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
        if(!file.startsWith(root+path.sep))return route.abort();
        if(!cachedAssets.has(u.href))cachedAssets.set(u.href,await readFile(file));
        return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:cachedAssets.get(u.href)});
      }
      return route.continue();
    }
    if(u.origin==='https://wpxaliifkzyhjsucavbr.supabase.co'&&['/rest/v1/rpc/geofact_record_event','/rest/v1/rpc/geofact_stats'].includes(u.pathname))return route.fulfill({contentType:'application/json',body:u.pathname.endsWith('geofact_stats')?'[{"visitors":1,"players":1}]':'true'});
    unexpected.push(u.href);return route.abort();
  });
  if(seed)await ctx.addInitScript(save=>{
    if(location.protocol==='http:'&&localStorage.getItem('unrelated-setting')===null)for(const [key,value] of Object.entries(save))localStorage.setItem(key,value);
  },{...currentSave,'wg-lang':'en','gf-sound-v1':'off'});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(new URL(r.url()).origin===new URL(url).origin&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.clock.install({time:new Date('2026-10-14T10:00:00Z')});
  await page.goto(url);await page.locator('#chooseDaily:enabled').waitFor();
  return {ctx,page};
}
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--disable-dev-shm-usage']}: {})});
  const prepared=[];
  for(const kind of ['partial','sealed','opened','daily-started']){
    const {ctx,page}=await context();
    await page.evaluate(async kind=>{
      const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');
      const r=await openRewardRepository();
      try{
        const at=Date.now(),count=kind==='partial'?7:10;
        for(let n=0;n<count;n++)await r.answer({id:'maintenance:'+n,roundId:'maintenance-round:'+n,mode:'practice',correct:true,at,countryDraw:0,rarityDraw:.8},['VAT']);
        if(kind==='opened'){const state=await r.read();await r.openChest({id:'maintenance:open',chestId:Object.keys(state.bonus.chests)[0],at});}
        await r.completeDaily({day:GeoFactCore.dailyKey(),number:GeoFactCore.dailyNumber(),score:94,tiles:['green','green','yellow','green','green'],errors:2,at,card:{iso:'TUV',rarity:'gold'}});
      }finally{r.close();}
      sessionStorage.setItem('maintenance-unrelated','preserve exactly');window.dispatchEvent(new Event('focus'));
    },kind);
    if(kind==='daily-started'){
      // The next UTC period has no completed result, so this is a live Daily.
      await page.clock.setSystemTime(new Date('2026-10-14T13:00:00Z'));
      await page.click('#chooseDaily');await page.locator('#playing').waitFor({state:'visible'});
    }else await page.reload();
    await page.locator('#chooseDaily:enabled').waitFor({state:'attached'});
    prepared.push({ctx,page,kind,before:await snapshot(page)});
  }
  if(process.env.GEOFACT_UPDATE_GATE){
    await writeFile(process.env.GEOFACT_UPDATE_GATE+'.prepared','Synthetic baseline saves created; do not clear storage.\n');
    console.log('Four baseline saves prepared; waiting for candidate.');
    for(let attempts=0;;attempts++){
      try{await access(process.env.GEOFACT_UPDATE_GATE);break;}catch{}
      if(attempts>1800)throw new Error('Candidate readiness timed out');await delay(1000);
    }
  }
  root=candidate;
  for(const {ctx,page,kind,before} of prepared){
    await page.reload();await page.locator('#chooseDaily:enabled').waitFor();
    const migrated={...before,local:{...before.local,'gf-music-v1':'off','gf-effects-v1':'off'}};
    equal(await snapshot(page),migrated,kind+': all existing bytes preserved; only independent audio preferences added');
    equal(await page.locator('#map .target-core').count(),0,kind+': updated map loads despite previous cached assets');
    equal(await page.locator('#lang').getAttribute('value'),'en',kind+': language unchanged');
    equal(await page.locator('#toggleSound').getAttribute('data-muted'),'true',kind+': mute unchanged');
    const opened=await page.evaluate(async()=>{
      const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();
      try{
        const before=await r.read(),chest=Object.values(before.bonus.chests)[0];if(!chest)return null;
        const input={id:'maintenance:reopen',chestId:chest.id,at:Date.now()};
        await r.openChest(input);const first=await r.read();await r.openChest(input);const second=await r.read();return {before,first,second,card:chest.card};
      }finally{r.close();}
    });
    if(opened){
      equal(opened.second,opened.first,kind+': repeated opening has no second credit');
      const copies=s=>Object.values(s.collection).reduce((sum,c)=>sum+Object.values(c.counts).reduce((n,v)=>n+v,0),0);
      equal(copies(opened.first),copies(opened.before)+(kind==='opened'?0:1),kind+': exactly one new card for a sealed chest');
    }
    if(kind==='sealed'){
      await page.click('#chooseDaily');await page.locator('#final').waitFor({state:'visible'});
      await page.click('#openChest');await page.locator('#cardReveal').waitFor({state:'visible'});
      await page.mouse.move(1,1);
      await page.waitForFunction(()=>[...document.querySelectorAll('#final .revealed-actions button')].filter(b=>b.getClientRects().length).every(b=>getComputedStyle(b).backgroundImage.includes('rgb(249, 212, 185)')));
      equal(await page.locator('#final .revealed-actions button:visible').evaluateAll(buttons=>buttons.every(b=>getComputedStyle(b).backgroundImage.includes('rgb(239, 181, 157)'))),true,'Braise warm reward styles replace the cached stylesheet');
    }
    await ctx.close();
  }
  const fresh=await context(false);equal(await fresh.page.locator('#chooseDaily').isEnabled(),true,'fresh installation loads');
  equal(await fresh.page.locator('#toggleMusic').isChecked(),true,'fresh music defaults to on');
  equal(await fresh.page.locator('#toggleEffects').isChecked(),true,'fresh effects default to on');
  await fresh.page.click('#toggleSound');await fresh.page.locator('#toggleMusic').uncheck();await fresh.page.keyboard.press('Escape');await fresh.page.reload();await fresh.page.locator('#chooseDaily:enabled').waitFor();
  equal(await fresh.page.locator('#toggleMusic').isChecked(),false,'user music choice survives reload');
  equal(await fresh.page.locator('#toggleEffects').isChecked(),true,'music choice leaves effects enabled');
  await fresh.ctx.close();
  equal(errors,[],'no script errors or missing resources');equal(unexpected,[],'external requests isolated');
  console.log(`${checks} same-origin release-update assertions passed; four synthetic saves and fresh installation.`);
}finally{
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
}
