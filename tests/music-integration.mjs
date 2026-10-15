import {clickOutsideResult} from './result-controls.mjs';
import {setLanguage} from './language-control.mjs';
import {setAudioEnabled} from './audio-controls.mjs';
export async function testMusicIntegration({newContext,url,check,equal}){
 console.log('Music: supplied native buffer, one loop, gestures, independent mute and visibility…');
 const ctx=await newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,locale:'fr-FR'});
 await ctx.addInitScript(()=>{
  const Native=window.AudioContext||window.webkitAudioContext;window.musicProbe={created:0,sources:[],hidden:false};Object.defineProperty(document,'hidden',{configurable:true,get:()=>musicProbe.hidden});
  window.AudioContext=class extends Native{
   constructor(...args){super(...args);musicProbe.created++;musicProbe.device=this;}
   createBufferSource(){const n=super.createBufferSource(),start=n.start.bind(n),stop=n.stop.bind(n),p={started:false,stopped:false};musicProbe.sources.push(p);n.start=(when=0,offset=0)=>{Object.assign(p,{started:true,loop:n.loop,offset,duration:n.buffer?.duration});return start(when,offset);};n.stop=(...args)=>{p.stopped=true;return stop(...args);};return n;}
  };
 });
 try{
  const p=await ctx.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();equal(await p.evaluate(()=>musicProbe.created),0,'no autoplay device');
  await p.locator('#choosePractice').tap();await p.waitForFunction(()=>musicProbe.sources.some(s=>s.loop&&s.started&&!s.stopped));equal(await p.evaluate(()=>musicProbe.created),1,'one shared device');
  await p.click('#practiceByDifficulty');await setLanguage(p,'en');await clickOutsideResult(p,'#howToPlay');await p.click('#closeHow');equal(await p.evaluate(()=>musicProbe.sources.filter(s=>s.loop).length),1,'navigation does not restart the recording');
  await p.evaluate(()=>{musicProbe.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});equal(await p.evaluate(()=>musicProbe.sources.filter(s=>s.loop&&!s.stopped).length),0,'background cuts music');
  await p.evaluate(()=>{musicProbe.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>musicProbe.sources.some(s=>s.loop&&!s.stopped));equal(await p.evaluate(()=>musicProbe.sources.filter(s=>s.loop&&!s.stopped).length),1,'one foreground instance');
  await p.evaluate(async()=>{musicProbe.hidden=true;document.dispatchEvent(new Event('visibilitychange'));await musicProbe.device.suspend();musicProbe.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});equal(await p.evaluate(()=>musicProbe.sources.filter(s=>s.loop&&!s.stopped).length),0,'suspended foreground waits for gesture');
  await clickOutsideResult(p,'#howToPlay');await p.waitForFunction(()=>musicProbe.sources.some(s=>s.loop&&!s.stopped));await p.click('#closeHow');
  await setAudioEnabled(p,false);equal(await p.evaluate(()=>musicProbe.sources.filter(s=>s.loop&&!s.stopped).length),0,'mute cuts current buffer');equal(await p.evaluate(()=>localStorage.getItem('gf-music-v1')),'off','separate music preference');equal(await p.evaluate(()=>localStorage.getItem('gf-effects-v1')),'off','separate effects preference');
  await p.reload();await p.locator('#chooseDaily:enabled').waitFor();await p.click('#choosePractice');equal(await p.evaluate(()=>musicProbe.created),0,'muted reload and gestures stay quiet');await setAudioEnabled(p,true);await p.waitForFunction(()=>musicProbe.sources.some(s=>s.loop&&!s.stopped));equal(await p.evaluate(()=>musicProbe.created),1,'enable creates a single device');check(await p.evaluate(()=>musicProbe.sources.filter(s=>s.loop).every(s=>s.duration>73&&s.duration<74)),'validated recording decoded, no generated score');
 }finally{await ctx.close();}
}
