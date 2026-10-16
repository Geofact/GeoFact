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
try{
 for(const width of [320,390,1280])for(const reduced of [false,true]){
  const seed={...currentSave},daily=JSON.parse(seed['gf-daily-v1']);daily.days['2026-10-09']={...daily.days['2026-10-07'],number:3,cardOpened:false};seed['gf-daily-v1']=JSON.stringify(daily);
  const c=await context({width,seed,motion:reduced?'reduce':'no-preference'});try{
   const p=await c.newPage();await p.clock.install({time:new Date('2026-10-09T13:00:00Z')});await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
   const parity=await p.evaluate(()=>{
    const buttons=['openChest','openBonusChest'].map(id=>document.getElementById(id));
    const normalized=button=>button.querySelector('svg.braise-chest-art').outerHTML.replace(/(id="|href="#|url\(#)(?:daily|bonus)-/g,'$1');
    const allIds=[...document.querySelectorAll('svg.braise-chest-art [id]')].map(e=>e.id);
    const refs=buttons.every(b=>[...b.querySelectorAll('svg *')].every(e=>[...e.attributes].every(a=>{const m=a.name==='href'?a.value.match(/^#(.+)$/):a.value.match(/url\(#([^)]+)\)/);return !m||!!b.querySelector(`[id="${m[1]}"]`);}))); 
    const styles=button=>['.chest-object','.braise-chest-art','.braise-chest-lid','.braise-chest-light'].map(selector=>{const st=getComputedStyle(button.querySelector(selector));return ['width','height','top','display','transformOrigin','animationName','animationDuration','animationDelay'].map(k=>st[k]);});
    const idle=buttons.map(styles);buttons.forEach(b=>b.classList.add('opening'));const opening=buttons.map(styles);buttons.forEach(b=>b.classList.remove('opening'));
    return {art:buttons.map(normalized),unique:new Set(allIds).size===allIds.length,refs,idle,opening};
   });
   eq(parity.art[0],parity.art[1],'same SVG');ok(parity.unique,'no duplicate SVG ids');ok(parity.refs,'all paint and clip references resolve in each chest');eq(parity.idle[0],parity.idle[1],'identical idle styles');eq(parity.opening[0],parity.opening[1],'identical opening animations');
   await p.click('#chooseDaily');await p.locator('#dailyChest').waitFor();await p.screenshot({path:output+'/daily-chest-'+width+'-'+reduced+'.png',fullPage:true});await p.click('#openChest');await p.locator('#cardReveal').waitFor();
   await p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs');const r=await openRewardRepository();try{for(let n=0;n<10;n++)await r.answer({id:'parity:'+n,roundId:'parity-round:'+n,mode:'practice',correct:true,at:Date.now(),countryDraw:0,rarityDraw:.8},['USA']);}finally{r.close();}dispatchEvent(new Event('focus'));});
   await p.click('#brand');await p.locator('#openBonusRewards:not(.hidden)').waitFor();await p.click('#openBonusRewards');await p.locator('#bonusChestStage').waitFor();
   eq(await p.locator('#openBonusChest .chest-body').count(),0,'legacy chest removed');eq(await p.locator('#openBonusChest .braise-chest-art').count(),1,'bonus uses Braise art');await p.screenshot({path:output+'/bonus-chest-'+width+'-'+reduced+'.png',fullPage:true});
   await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor();ok(await p.locator('#bonusCardReveal').isVisible(),'bonus still opens');
   const audio=(await records(p)).filter(s=>s.name==='chest');eq(audio.length,2,'one identical sample per chest opening');eq(audio.map(s=>({gain:s.gain,rate:s.rate,detune:s.detune,loop:s.loop}))[0],audio.map(s=>({gain:s.gain,rate:s.rate,detune:s.detune,loop:s.loop}))[1],'same volume, speed and pitch for Daily and bonus');ok(audio.every(s=>Math.abs(s.gain-.0595)<1e-7&&s.rate===1&&s.detune===0&&!s.loop),'unchanged playback settings');
   ok(audio.every(s=>reduced?s.when-s.at<.1:Math.abs(s.when-s.at+.55-4.91)<.03),'same opening cue for both chests');
   console.log('PASS chest parity',width,reduced?'reduced':'animated');
  }finally{await c.close();}
 }
 eq(errors,[],'no browser errors or missing assets');console.log('PASS',checks,'chest assertions');
}finally{await browser.close();await new Promise(r=>server.close(r));}
