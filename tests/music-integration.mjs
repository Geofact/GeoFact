// Native Chromium Web Audio, with visibility/device suspension simulated explicitly.
export async function testMusicIntegration({newContext,url,check,equal}){
 console.log('Music: native audio, one scheduler, mute, background and foreground…');
 const ctx=await newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,locale:'fr-FR'});
 await ctx.addInitScript(()=>{
  const Native=window.AudioContext||window.webkitAudioContext;
  window.musicProbe={created:0,started:[],immediateStops:0,timers:new Set(),hidden:false};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>musicProbe.hidden});
  const interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window);
  window.setInterval=(callback,delay,...args)=>{const id=interval(callback,delay,...args);if(delay===50)musicProbe.timers.add(id);return id;};
  window.clearInterval=id=>{musicProbe.timers.delete(id);clear(id);};
  window.AudioContext=class extends Native{
   constructor(...args){super(...args);musicProbe.created++;musicProbe.device=this;}
   createOscillator(){const n=super.createOscillator(),start=n.start.bind(n),stop=n.stop.bind(n),device=this;
    n.start=at=>{musicProbe.started.push({type:n.type,frequency:n.frequency.value});return start(at);};
    n.stop=at=>{if(at===undefined||at<=device.currentTime)musicProbe.immediateStops++;return stop(at);};return n;}
  };
 });
 try{
  const p=await ctx.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
  equal(await p.evaluate(()=>musicProbe.created),0,'no context or autoplay before gesture');
  const practice=await p.locator('#choosePractice').boundingBox();await p.touchscreen.tap(practice.x+practice.width/2,practice.y+practice.height/2);await p.waitForFunction(()=>musicProbe.timers.size===1);
  equal(await p.evaluate(()=>musicProbe.created),1,'music and effects share one context');
  check(await p.evaluate(()=>musicProbe.started.some(n=>n.type==='custom')),'native soft 8-bit voice plays');
  await p.click('#practiceByDifficulty');await p.selectOption('#lang','en');await p.click('#howToPlay');await p.click('#closeHow');
  equal(await p.evaluate(()=>musicProbe.timers.size),1,'screen changes and repeated gestures never stack music');
  await p.evaluate(()=>{musicProbe.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
  equal(await p.evaluate(()=>musicProbe.timers.size),0,'background stops scheduler');
  check(await p.evaluate(()=>musicProbe.immediateStops>0),'background cancels already scheduled audio');
  await p.evaluate(()=>{musicProbe.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  equal(await p.evaluate(()=>musicProbe.timers.size),1,'running foreground resumes one score');
  await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));equal(await p.evaluate(()=>musicProbe.timers.size),0,'page cache departure stops the score');
  await p.evaluate(()=>window.dispatchEvent(new Event('pageshow')));equal(await p.evaluate(()=>musicProbe.timers.size),1,'page cache return resumes once');
  await p.evaluate(async()=>{musicProbe.hidden=true;document.dispatchEvent(new Event('visibilitychange'));await musicProbe.device.suspend();musicProbe.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  equal(await p.evaluate(()=>musicProbe.timers.size),0,'suspended foreground waits for interaction');
  await p.click('#howToPlay');await p.waitForFunction(()=>musicProbe.timers.size===1);await p.click('#closeHow');
  await p.click('#toggleSound');equal(await p.evaluate(()=>musicProbe.timers.size),0,'same mute stops music immediately');
  equal(await p.evaluate(()=>localStorage.getItem('gf-sound-v1')),'off','original mute preference retained');
  for(let i=0;i<3;i++){await p.click('#toggleSound');await p.waitForFunction(()=>musicProbe.timers.size===1);await p.click('#toggleSound');equal(await p.evaluate(()=>musicProbe.timers.size),0,'repeat enable/mute leaves no scheduler');}
  await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(await p.evaluate(()=>musicProbe.created),0,'muted reload creates no device');
  await p.click('#choosePractice');equal(await p.evaluate(()=>musicProbe.created),0,'muted interactions never start music');
  await p.click('#toggleSound');await p.waitForFunction(()=>musicProbe.timers.size===1);
  equal(await p.evaluate(()=>musicProbe.created),1,'explicit enable after reload creates one device');
 }finally{await ctx.close();}
}
