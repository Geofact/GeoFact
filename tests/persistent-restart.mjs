import {setLanguage} from './language-control.mjs';
// Actual Chromium process restarts with an isolated on-disk profile and HTTP origin.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentSave} from './save-fixtures.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':decodeURIComponent(name)));
 if(!file.startsWith(root)){res.writeHead(403).end();return;}
 try{const body=await readFile(file);const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(body);}catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url=`http://127.0.0.1:${server.address().port}/`,profile=await mkdtemp(path.join(tmpdir(),'geofact-restart-'));
let context,checks=0;const errors=[],unexpected=[],events=[];
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const check=(a,label)=>{assert.ok(a,label);checks++;};
const snapshot=p=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{return await r.read();}finally{r.close();}});
const copies=s=>Object.values(s.collection).reduce((sum,c)=>sum+Object.values(c.counts).reduce((n,v)=>n+v,0),0);
async function launch(seed=false){
 context=await chromium.launchPersistentContext(profile,{headless:true,locale:'fr-FR',reducedMotion:'reduce',serviceWorkers:'block',...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--disable-dev-shm-usage']}:{} )});
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.origin===new URL(url).origin)return route.continue();
  if(u.origin==='https://wpxaliifkzyhjsucavbr.supabase.co'&&u.pathname==='/rest/v1/rpc/geofact_record_event'){
   events.push(route.request().postDataJSON());return route.fulfill({status:200,contentType:'application/json',body:'true'});
  }
  unexpected.push(u.href);return route.abort();
 });
 const p=context.pages()[0]||await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 p.on('response',r=>{if(new URL(r.url()).origin===new URL(url).origin&&r.status()>=400)errors.push(r.status()+' '+r.url());});
 if(seed)await context.addInitScript(save=>{if(location.protocol==='http:'&&localStorage.getItem('unrelated-setting')===null)for(const [key,value] of Object.entries(save))localStorage.setItem(key,value);},currentSave);
 await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();return p;
}
async function practice(p){
 await p.evaluate(()=>{GeoFactCore.shuffle=list=>list.includes('FRA')?['FRA']:list;});
 await p.click('#choosePractice');await p.click('#practiceByDifficulty');await p.click('[data-level=easy]');await p.locator('#playing').waitFor({state:'visible'});
}
async function answer(p,next=true){
 await p.evaluate(()=>{const shape=document.querySelector('#map [data-iso=FRA]');for(const type of ['pointerdown','pointerup'])shape.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',clientX:-1,clientY:-1,button:0}));});
 await p.locator('#result').waitFor({state:'visible'});await p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));if(next)await p.click('#next');
}
try{
 console.log('Native persistent restart: committed streak, sealed chest, preferences and single credit…');
 let p=await launch(true);const original=await snapshot(p);await setLanguage(p,'en');await p.click('#toggleSound');await practice(p);for(let n=0;n<8;n++)await answer(p);
 const partial=await snapshot(p);equal(partial.bonus.progress,8,'eight committed answers');await context.close();context=null;
 p=await launch();equal((await snapshot(p)).bonus,partial.bonus,'actual browser close/reopen preserves partial streak');equal(await p.locator('#lang').getAttribute('value'),'en','language persists on disk');equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'true','mute persists on disk');await practice(p);await answer(p);await answer(p,false);
 const sealed=await snapshot(p),chest=Object.values(sealed.bonus.chests)[0];check(!!chest,'tenth earns sealed chest');equal(sealed.collection,original.collection,'no early collection credit');equal(chest.openedAt,null,'sealed before restart');await context.close();context=null;
 p=await launch();const restored=await snapshot(p);equal(restored.bonus,sealed.bonus,'sealed card and quota survive process restart');equal(restored.daily,original.daily,'Daily preserved');equal(restored.dailyChests,original.dailyChests,'Daily chests preserved');await p.click('#openBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});await p.locator('#openBonusChest').evaluate(b=>{b.click();b.click();});await p.locator('#bonusCardReveal').waitFor({state:'visible'});
 const opened=await snapshot(p);equal(copies(opened),copies(original)+1,'double opening credits once');equal(Object.values(opened.bonus.chests)[0].card,chest.card,'same fixed card');await context.close();context=null;
 p=await launch();const final=await snapshot(p);equal(final.collection,opened.collection,'credited collection survives process restart');equal(final.bonus,opened.bonus,'opened receipt persists');check(await p.locator('#openBonusRewards').isHidden(),'no second opening offered');
 for(const key of ['gf-collection-v1','gf-daily-v1','unrelated-setting'])equal(await p.evaluate(key=>localStorage.getItem(key),key),currentSave[key],'original key retained '+key);
 check(!errors.length,'no JavaScript or local resource errors');check(!unexpected.length,'all external traffic mocked or blocked');equal(new Set(events.filter(e=>e.p_event_type==='visit').map(e=>e.p_visitor_id)).size,1,'actual restarts retain the same visitor');
 console.log(`${checks} persistent HTTP assertions passed; four Chromium launches; Supabase mocked.`);
}finally{
 if(context)await context.close();await new Promise(ok=>server.close(ok));await rm(profile,{recursive:true,force:true});
}
