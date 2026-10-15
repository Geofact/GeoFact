// Native Chromium audio, isolated storage, local files and mocked remote telemetry.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {currentSave} from './save-fixtures.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),output=path.join(root,'work/audio-checks');await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let checks=0;const errors=[];const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(v,w,m)=>{assert.deepEqual(v,w,m);checks++;};
async function context({width=390,lang='fr',seed={},motion='reduce'}={}){
 const c=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600,locale:lang==='fr'?'fr-FR':'en-US',reducedMotion:motion,storageState:{cookies:[],origins:[{origin,localStorage:Object.entries({...seed,'wg-lang':lang}).map(([name,value])=>({name,value}))}]}});
 await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await c.addInitScript(()=>{
  const Native=window.AudioContext||window.webkitAudioContext;window.audioProbe={contexts:[],sources:[],hidden:false,resumes:0,oscillators:0,schedulers:0,buffers:[]};
  const probe=audioProbe,tags=new WeakMap(),files={220544:'correct',158804:'wrong',564524:'chest',1183149:'music'};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>probe.hidden});
  const interval=window.setInterval;window.setInterval=(fn,delay,...rest)=>{if(delay===50)probe.schedulers++;return interval(fn,delay,...rest);};
  window.AudioContext=class extends Native{
   constructor(...args){super(...args);probe.contexts.push(this);}
   resume(){probe.resumes++;return super.resume();}
   createOscillator(){probe.oscillators++;return super.createOscillator();}
   decodeAudioData(bytes,done,failed){const name=files[bytes.byteLength];const tag=buffer=>{if(!tags.has(buffer)){tags.set(buffer,name);probe.buffers.push({name,duration:buffer.duration,length:buffer.length,sampleRate:buffer.sampleRate});}return buffer;};return super.decodeAudioData(bytes,b=>done?.(tag(b)),failed).then(tag);}
   createBufferSource(){const n=super.createBufferSource(),start=n.start.bind(n),stop=n.stop.bind(n),connect=n.connect.bind(n),ctx=this;const rec={node:n,ctx,started:false,stopped:false,ended:false};probe.sources.push(rec);n.addEventListener('ended',()=>rec.ended=true);
    n.connect=(target,...args)=>{rec.target=target;return connect(target,...args);};
    n.start=(when=0,offset=0,...args)=>{Object.assign(rec,{started:true,when,offset,at:ctx.currentTime,name:tags.get(n.buffer)||'prime',loop:n.loop,gain:rec.target?.gain?.value});return start(when,offset,...args);};
    n.stop=(...args)=>{rec.stopped=true;return stop(...args);};return n;
   }
  };
 });
 c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(new URL(r.url()).origin===origin&&r.status()>=400)errors.push(r.status()+' '+r.url());});});return c;
}
const activeMusic=p=>p.evaluate(()=>audioProbe.sources.filter(s=>s.name==='music'&&s.started&&!s.stopped&&!s.ended).length);
const musicIds=p=>p.evaluate(()=>audioProbe.sources.map((s,i)=>s.name==='music'&&s.started&&!s.stopped&&!s.ended?i:null).filter(i=>i!==null));
const records=p=>p.evaluate(()=>audioProbe.sources.filter(s=>s.started).map(s=>({name:s.name,when:s.when,offset:s.offset,at:s.at,loop:s.loop,gain:s.target?.gain?.value??s.gain,rate:s.node.playbackRate.value,detune:s.node.detune.value,stopped:s.stopped,ended:s.ended})));
async function setSwitch(p,id,value){if(await p.locator(id).isChecked()!==value){if(p.viewportSize().width<600)await p.locator(id).tap();else await p.click(id);}}
async function tapCountry(p,iso){await p.waitForTimeout(300);await p.evaluate(iso=>{const el=document.querySelector(`#map path.territory-detail[data-iso="${iso}"]`)||document.querySelector(`#map [data-iso="${iso}"]`);for(const type of ['pointerdown','pointerup'])el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',clientX:-1,clientY:-1,button:0}));},iso);}
const session=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('gf-daily-session-v1')));
async function enter(p){await p.click('#chooseDaily');await p.locator('#playing').waitFor();}
try{
 for(const width of (process.env.DAILY_ONLY?[320]:[1280,320,390])){
  const c=await context({width,seed:currentSave});try{
   const p=await c.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
   await p.click('#openCollection');await p.locator('.album-continent').first().waitFor();
   eq(await p.locator('.album-stamp img').count(),6,'six icons');
   for(const icon of await p.locator('.album-stamp img').all()){
    ok(await icon.evaluate(e=>e.complete&&e.naturalWidth>0&&e.getBoundingClientRect().width>=28&&getComputedStyle(e.parentElement).display!=='none'),'icon loaded and visible '+width);
   }
   ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'collection fits '+width);
   ok(await p.locator('.album-continent progress').evaluateAll(es=>es.length===6&&es.every(e=>e.max>0&&e.value>=0&&e.value<=e.max&&e.getBoundingClientRect().height>=6)),'six valid progression bars');
   await p.screenshot({path:output+'/continents-'+width+'.png',fullPage:true});await p.click('#brand');
   await enter(p);const initial=await session(p);eq(initial.index,0,'starts on first round');
   const wrong=await p.evaluate(iso=>GeoFactCountries.find(c=>c.iso!==iso).iso,initial.series[0]);await tapCountry(p,wrong);
   const missed=await session(p);eq(missed.attempts,1,'miss saved');eq(missed.dailyErrors,1,'error saved');ok(missed.points<initial.points,'penalty saved');
   await p.click('#brand');await enter(p);eq(await session(p),missed,'menu preserves exact round');
   await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await enter(p);eq(await session(p),missed,'reload preserves wrong guesses and penalty');
   await tapCountry(p,missed.series[0]);await p.locator('#resultDialog[open]').waitFor();const solved=await session(p),fact=await p.locator('#fact').textContent();
   await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await enter(p);eq(await session(p),solved,'answered round preserved');eq(await p.locator('#fact').textContent(),fact,'same anecdote');
   await p.click('#reopenResult');await p.click('#next');eq((await session(p)).index,1,'next round once');
   await p.click('#brand');await enter(p);eq((await session(p)).index,1,'second round preserved');
   // A different period cannot restore the previous daily session.
   await p.click('#brand');await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('gf-daily-session-v1'));v.dailyKey='2000-01-01';localStorage.setItem('gf-daily-session-v1',JSON.stringify(v));});await enter(p);eq((await session(p)).index,0,'expired period starts fresh');
   if(width===320){
    for(let n=0;n<5;n++){
     const v=await session(p);eq(v.index,n,'correct resumed index');await tapCountry(p,v.series[n]);await p.locator('#resultDialog[open]').waitFor();
     if(n===4){await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await enter(p);eq((await session(p)).dailyTiles.length,5,'five answers preserved before final save');await p.click('#reopenResult');}
     await p.click('#next');
    }
    await p.locator('#final').waitFor();
    const readRewards=()=>p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');const r=await openRewardRepository();try{return await r.read();}finally{r.close();}});
    const completed=await readRewards();await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await p.click('#chooseDaily');await p.locator('#final').waitFor();eq(await readRewards(),completed,'completed daily and reward cannot be duplicated by reload');
   }
   console.log('PASS continents and daily',width);
  }finally{await c.close();}
 }
 if(!process.env.DAILY_ONLY)for(const m of [false,true])for(const e of [false,true]){
  const c=await context({seed:{...currentSave,'gf-music-v1':m?'on':'off','gf-effects-v1':e?'on':'off'}});try{
   const p=await c.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();await p.click('#toggleSound');await p.keyboard.press('Escape');
   if(m)await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));const ids=await musicIds(p);
   for(let n=0;n<5;n++){
    await p.click(n%2?'#chooseGame':'#choosePractice');await p.click('#brand');await p.click('#openCollection');await p.click('#brand');
   }
   eq(await musicIds(p),ids,'menus preserve loop '+m+e);eq(await p.evaluate(()=>audioProbe.contexts.length),m||e?1:0,'one context');
   if(m||e)for(let n=0;n<3;n++){
    await p.evaluate(async()=>{audioProbe.hidden=true;document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new Event('pagehide'));await audioProbe.contexts[0].suspend();audioProbe.hidden=false;document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new Event('pageshow'));dispatchEvent(new Event('focus'));});
    await p.click('#toggleSound');await p.keyboard.press('Escape');if(m)await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));eq(await activeMusic(p),m?1:0,'one loop after suspend');
   }
   await enter(p);const v=await session(p);await tapCountry(p,v.series[0]);await p.locator('#resultDialog[open]').waitFor();if(e)await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='correct'&&s.started));eq((await records(p)).filter(s=>s.name==='correct').length,e?1:0,'effects after interruptions');
   console.log('PASS repeated navigation and suspension',m,e);
  }finally{await c.close();}
 }
 eq(errors,[],'no missing assets or runtime exceptions');console.log('PASS',checks,'lifecycle/daily/continent assertions');
}finally{await browser.close();await new Promise(r=>server.close(r));}
