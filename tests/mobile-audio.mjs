// Simulated delayed Safari audio resume. This does not certify physical iPhone output.
export async function testMobileAudio({newContext,url,tap,check,equal}) {
 const ctx=await newContext({viewport:{width:375,height:812},locale:'fr-FR',hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 await ctx.addInitScript(()=>{
  window.mobileAudio={notes:[],resumes:0,session:{type:'auto'}};
  Object.defineProperty(navigator,'audioSession',{configurable:true,value:mobileAudio.session});
  class Device {
   constructor(){this.state='suspended';this.currentTime=0;this.destination={};mobileAudio.device=this;}
   resume(){mobileAudio.resumes++;return new Promise(resolve=>{mobileAudio.finish=()=>{this.state='running';resolve();};});}
   createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
   createOscillator(){return {frequency:{setValueAtTime(f){mobileAudio.notes.push(f);}},connect(){},disconnect(){},start(){},stop(){}};}
  }
  window.AudioContext=undefined;window.webkitAudioContext=Device;
 });
 try {
  const p=await ctx.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
  equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'false','mobile sound defaults enabled');
  equal(await p.evaluate(()=>navigator.audioSession.type),'auto','no playback session before a gesture');
  await p.evaluate(()=>{GeoFactCore.shuffle=list=>list.includes('FRA')?['FRA']:list;});
  await p.click('#choosePractice');await p.click('#practiceByDifficulty');await p.click('[data-level=easy]');
  await tap('FRA','touch',p);await p.locator('#result').waitFor({state:'visible'});
  check(await p.locator('#fact').isVisible(),'audio delay never blocks anecdote');
  equal(await p.evaluate(()=>navigator.audioSession.type),'playback','supported iOS session routed to playback');
  await p.waitForFunction(()=>!sessionStorage.getItem('gf-pending-practice-v1'));
  equal(await p.evaluate(()=>mobileAudio.resumes),1,'pending mobile resume is not duplicated');
  equal(await p.evaluate(()=>mobileAudio.notes.length),0,'no sound before device resumes');
  await p.evaluate(()=>mobileAudio.finish());await p.waitForFunction(()=>mobileAudio.notes.length===2);
  equal(await p.evaluate(()=>mobileAudio.notes),[880,1319],'first validated answer is heard after delayed resume');
  await p.click('#next');await p.evaluate(()=>{mobileAudio.notes=[];mobileAudio.device.state='interrupted';});
  await p.dispatchEvent('#map','touchend');equal(await p.evaluate(()=>mobileAudio.resumes),2,'touchend alone resumes an interrupted device');
  await tap('FRA','touch',p);await p.locator('#result').waitFor({state:'visible'});
  await p.click('#toggleSound');await p.evaluate(()=>mobileAudio.finish());
  equal(await p.evaluate(()=>mobileAudio.notes.length),0,'muting cancels delayed effects');
  await p.reload();await p.locator('#chooseDaily:enabled').waitFor();
  equal(await p.locator('#toggleSound').getAttribute('aria-pressed'),'true','mobile mute survives reload');
  equal(await p.evaluate(()=>mobileAudio.resumes),0,'muted reload never resumes audio');
 }finally{await ctx.close();}
}
