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
 for(const width of [1280,320,375,390])for(const lang of ['fr','en']){
  const m=width!==320&&width!==375,f=width!==320&&width!==390;
  const seed={...currentSave,'gf-music-v1':m?'on':'off','gf-effects-v1':f?'on':'off'};
  const c=await context({width,lang,seed});try{
   const p=await c.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();eq(await p.evaluate(()=>audioProbe.contexts.length),0,'no autoplay context');
   if(width<600){await p.dispatchEvent('#toggleSound','pointerdown',{pointerType:'touch'});eq(await p.evaluate(()=>audioProbe.contexts.length),0,'touch press alone cannot start audio');await p.locator('#toggleSound').tap();}else await p.click('#toggleSound');
   ok(await p.locator('#audioPanel').isVisible(),'panel opens');eq(await p.locator('#toggleSound').getAttribute('aria-expanded'),'true','expanded announced');
   eq(await p.getByRole('switch',{name:lang==='fr'?'Musique':'Music',exact:true}).isChecked(),m,'music label and state');eq(await p.getByRole('switch',{name:lang==='fr'?'Effets sonores':'Sound effects',exact:true}).isChecked(),f,'effects label and state');
   if(m)await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));eq(await activeMusic(p),m?1:0,'only chosen music starts');eq(await p.locator('#toggleSound').getAttribute('data-muted'),String(!(m||f)),'main icon reflects both categories');
   ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');const panel=await p.locator('#audioPanel').boundingBox();ok(panel.x>=0&&panel.x+panel.width<=width+1,'panel fits viewport');
   for(const id of ['#toggleMusic','#toggleEffects']){const b=await p.locator(id).boundingBox();ok(b.height>=44,'comfortable switch target');}
   const before=await p.evaluate(()=>({...localStorage}));
   await setSwitch(p,'#toggleMusic',!m);if(!m)await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));eq(await activeMusic(p),m?0:1,'music toggle applies immediately');
   await setSwitch(p,'#toggleMusic',m);if(m)await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));
   await setSwitch(p,'#toggleEffects',!f);await setSwitch(p,'#toggleEffects',f);
   eq((await records(p)).filter(s=>s.name==='correct'||s.name==='wrong'||s.name==='chest').length,0,'enabling effects replays nothing');
   const after=await p.evaluate(()=>({...localStorage}));for(const [key,value]of Object.entries(before))eq(after[key],value,'audio controls preserve '+key);
   await p.keyboard.press('Escape');ok(await p.locator('#audioPanel').isHidden(),'Escape closes');eq(await p.locator('#toggleSound').evaluate(e=>e===document.activeElement),true,'Escape restores focus');
   await p.click('#toggleSound');await p.mouse.click(4,280);ok(await p.locator('#audioPanel').isHidden(),'outside click closes');
   if(width===390&&lang==='fr'){await p.click('#toggleSound');await p.screenshot({path:output+'/audio-panel-390-fr.png',fullPage:true});await p.keyboard.press('Escape');}
   const priorIds=await musicIds(p);await p.click('#choosePractice');await p.evaluate(()=>{GeoFactCore.shuffle=list=>list.includes('FRA')?['FRA']:list;});await p.click('#practiceByDifficulty');await p.click('[data-level=easy]');await p.locator('#playing').waitFor();eq(await musicIds(p),priorIds,'screen changes do not restart music');
   await tapCountry(p,'JPN');if(f)await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='wrong'&&s.started));
   await tapCountry(p,'FRA');await p.locator('#resultDialog[open]').waitFor();if(f)await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='correct'&&s.started&&Math.abs(s.target.gain.value-.035)<1e-7));
   const sounds=await records(p);eq(sounds.filter(s=>s.name==='wrong').length,f?1:0,'supplied wrong answer');eq(sounds.filter(s=>s.name==='correct').length,f?1:0,'supplied correct answer');eq(await musicIds(p),priorIds,'questions and modal preserve the loop instance');
   ok(sounds.filter(s=>s.name==='music').every(s=>Math.abs(s.gain-.036)<1e-7&&s.loop),'native loop and preserved music reference gain');ok(sounds.filter(s=>s.name==='correct'||s.name==='wrong').every(s=>Math.abs(s.gain-.035)<1e-7&&!s.loop),'native supplied effects and preserved gain '+JSON.stringify(sounds));eq(await p.evaluate(()=>audioProbe.oscillators),0,'answers and music are not recreated as oscillators');ok(sounds.every(s=>s.rate===1&&s.detune===0),'native pitch and speed are unchanged');
   await p.click('#closeResult');await p.click('#toggleSound');
   if(f){await setSwitch(p,'#toggleEffects',false);ok(await p.evaluate(()=>audioProbe.sources.filter(s=>s.name==='correct'||s.name==='wrong').every(s=>s.stopped||s.ended)),'muting effects cuts active recordings');await setSwitch(p,'#toggleEffects',true);eq((await records(p)).filter(s=>s.name==='correct').length,1,'unmute does not replay answer');}
   await setSwitch(p,'#toggleMusic',true);await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));await p.waitForTimeout(120);
   const offset=await p.evaluate(()=>{const s=audioProbe.sources.findLast(s=>s.name==='music'&&!s.stopped);return s.offset+s.ctx.currentTime-s.at;});
   await setSwitch(p,'#toggleMusic',false);eq(await activeMusic(p),0,'music mute cuts current source');await p.waitForTimeout(100);await setSwitch(p,'#toggleMusic',true);await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));const resumed=(await records(p)).findLast(s=>s.name==='music').offset;ok(resumed>=offset&&resumed-offset<.25,'music resumes at saved cursor');eq(await activeMusic(p),1,'one resumed music instance');
   await setSwitch(p,'#toggleMusic',m);await setSwitch(p,'#toggleEffects',f);await p.keyboard.press('Escape');
   const save=await p.evaluate(()=>({...localStorage}));await p.reload();await p.locator('#chooseDaily:enabled').waitFor();eq(await p.evaluate(()=>({...localStorage})),save,'reload keeps preferences and gameplay saves');eq(await p.evaluate(()=>audioProbe.contexts.length),0,'reload never autoplays');await p.click('#toggleSound');eq(await p.locator('#toggleMusic').isChecked(),m,'music persists');eq(await p.locator('#toggleEffects').isChecked(),f,'effects persist');
   eq(await p.evaluate(()=>audioProbe.schedulers),0,'no music restart scheduler');console.log('PASS choices, UI, answers, gains, resume, reload',width,lang);
  }finally{await c.close();}
 }
 // Legacy migrations in a real browser, with no rewrite of existing data.
 for(const legacy of ['off','on',null]){
  const seed={...currentSave};if(legacy)seed['gf-sound-v1']=legacy;const c=await context({seed});try{const p=await c.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();const saved=await p.evaluate(()=>({...localStorage}));eq(saved['gf-music-v1'],legacy==='off'?'off':'on','legacy music migration');eq(saved['gf-effects-v1'],legacy==='off'?'off':'on','legacy effects migration');for(const [k,v]of Object.entries(seed))if(k!=='wg-lang')eq(saved[k],v,'legacy save preserved '+k);}finally{await c.close();}
 }
 // Background and device suspension use the same policies as the current game.
 {const c=await context();try{const p=await c.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();await p.click('#toggleSound');await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));await p.evaluate(()=>{audioProbe.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});eq(await activeMusic(p),0,'background stops loop');await p.evaluate(()=>audioProbe.contexts[0].suspend());const resumes=await p.evaluate(()=>audioProbe.resumes);await p.evaluate(()=>{audioProbe.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});eq(await p.evaluate(()=>audioProbe.resumes),resumes,'foreground cannot force resume');eq(await activeMusic(p),0,'suspended foreground stays quiet');await p.click('#toggleSound');await p.waitForFunction(()=>audioProbe.sources.some(s=>s.name==='music'&&!s.stopped));eq(await activeMusic(p),1,'next gesture resumes once');}finally{await c.close();}}
 // Native OfflineAudioContext renders four complete repetitions, testing all three joins.
 {const c=await context();try{const p=await c.newPage();await p.goto(url);const analysis=await p.evaluate(async()=>{
  const bytes=await (await fetch(GeoFactMusic.MUSIC_URL)).arrayBuffer(),decode=new OfflineAudioContext(2,1,32000);const buffer=await decode.decodeAudioData(bytes);const ctx=new OfflineAudioContext(2,buffer.length*4,buffer.sampleRate),source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=GeoFactMusic.MUSIC_GAIN;source.connect(gain);gain.connect(ctx.destination);source.start(0);const result=await ctx.startRendering();let maxError=0;const joins=[];
  for(let ch=0;ch<buffer.numberOfChannels;ch++){const a=buffer.getChannelData(ch),b=result.getChannelData(ch);for(let cycle=0;cycle<4;cycle++)for(let i=0;i<a.length;i++)maxError=Math.max(maxError,Math.abs(b[cycle*a.length+i]-a[i]*GeoFactMusic.MUSIC_GAIN));for(let cycle=1;cycle<4;cycle++){const at=cycle*a.length;joins.push({cycle,channel:ch,jump:b[at]-b[at-1],expected:(a[0]-a[a.length-1])*GeoFactMusic.MUSIC_GAIN});}}
  const x=buffer.getChannelData(0);let leading=0,trailing=0;while(leading<x.length&&Math.abs(x[leading])<1e-7)leading++;while(trailing<x.length&&Math.abs(x[x.length-1-trailing])<1e-7)trailing++;return {duration:buffer.duration,sampleRate:buffer.sampleRate,length:buffer.length,renderedDuration:result.duration,maxError,joins,leadingSilenceSamples:leading,trailingSilenceSamples:trailing};
 });ok(analysis.maxError<1e-7,'all four cycles match the decoded recording, without injected samples');eq(analysis.joins.length,6,'three joins checked in stereo');ok(analysis.joins.every(j=>Math.abs(j.jump-j.expected)<1e-7),'all joins have only the source recording discontinuity');ok(analysis.leadingSilenceSamples<2&&analysis.trailingSilenceSamples<2,'no decoded encoder-padding silence at the MP3 join');console.log('LOOP ANALYSIS',JSON.stringify(analysis));}finally{await c.close();}}
 // Daily and bonus chests: the supplied file, its native gain, and both timing modes.
 for(const reduced of [false,true]){
  const seed={...currentSave},daily=JSON.parse(seed['gf-daily-v1']);daily.days['2026-10-09']={...daily.days['2026-10-07'],number:3,cardOpened:false};seed['gf-daily-v1']=JSON.stringify(daily);
  const c=await context({seed,motion:reduced?'reduce':'no-preference'});try{
   const p=await c.newPage();await p.clock.install({time:new Date('2026-10-09T13:00:00Z')});await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();await p.click('#chooseDaily');await p.locator('#dailyChest').waitFor();await p.waitForFunction(()=>audioProbe.buffers.some(b=>b.name==='chest'));const at=await p.evaluate(()=>audioProbe.contexts[0].currentTime);await p.click('#openChest');await p.locator('#cardReveal').waitFor({state:'visible'});const chest=(await records(p)).filter(s=>s.name==='chest');eq(chest.length,1,'one supplied chest recording');eq(chest[0].gain>0&&Math.abs(chest[0].gain-.035)<1e-7,true,'unchanged chest effect gain');if(!reduced)ok(Math.abs((chest[0].when-chest[0].at)+.55-4.91)<.03,'riser/shimmer scheduled at the animation reveal cue');else ok(chest[0].when-chest[0].at<.1,'reduced motion keeps full clip at native speed');
   await p.evaluate(async()=>{const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');const r=await openRewardRepository();try{for(let n=0;n<10;n++)await r.answer({id:'audio-bonus:'+n,roundId:'audio-round:'+n,mode:'practice',correct:true,at:Date.now(),countryDraw:0,rarityDraw:.8},['USA']);}finally{r.close();}window.dispatchEvent(new Event('focus'));});await p.click('#brand');await p.locator('#openBonusRewards:not(.hidden)').waitFor();await p.click('#openBonusRewards');await p.locator('#bonusChestStage').waitFor();await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor();eq((await records(p)).filter(s=>s.name==='chest').length,2,'bonus opening uses the same supplied file once');eq(await p.evaluate(()=>audioProbe.oscillators),0,'no synthesized replacement/doubled reveal melody');console.log('PASS Daily and bonus chest',reduced?'reduced':'animated');
  }finally{await c.close();}
 }
 eq(errors,[],'no browser exception or missing local audio asset');console.log('PASS',checks,'audio browser assertions');
}finally{await browser.close();await new Promise(r=>server.close(r));}
