import {setAudioEnabled} from './audio-controls.mjs';
export async function testMobileAudio({newContext,url,tap,check,equal}){
 const ctx=await newContext({viewport:{width:375,height:812},locale:'fr-FR',hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 await ctx.addInitScript(()=>{
  window.mobileAudio={notes:[],resumes:0,session:{type:'auto'}};Object.defineProperty(navigator,'audioSession',{configurable:true,value:mobileAudio.session});
  class Device{
   constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.sampleRate=44100;mobileAudio.device=this;}
   resume(){mobileAudio.resumes++;return new Promise(resolve=>{mobileAudio.finish=()=>{this.state='running';resolve();};});}
   createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
   createBuffer(channels,length,rate){return {duration:length/rate};}
   decodeAudioData(bytes,done){const label=({220544:'correct',158804:'wrong',564524:'chest',1183149:'music'})[bytes.byteLength],buffer={label,duration:label==='music'?73.846:3.2};done?.(buffer);return Promise.resolve(buffer);}
   createBufferSource(){return {connect(){},disconnect(){},start(){if(this.buffer?.label)mobileAudio.notes.push(this.buffer.label);},stop(){}};}
  }
  window.AudioContext=undefined;window.webkitAudioContext=Device;
 });
 try{
  const p=await ctx.newPage();await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();equal(await p.locator('#toggleSound').getAttribute('data-muted'),'false','defaults on');equal(await p.evaluate(()=>navigator.audioSession.type),'auto','no playback session before gesture');await p.dispatchEvent('#choosePractice','pointerdown',{pointerType:'touch'});equal(await p.evaluate(()=>mobileAudio.device===undefined),true,'touch press waits for release');
  await p.evaluate(()=>{GeoFactCore.shuffle=list=>list.includes('FRA')?['FRA']:list;});await p.click('#choosePractice');await p.click('#practiceByDifficulty');await p.click('[data-level=easy]');await tap('FRA','touch',p);await p.locator('#result').waitFor();check(await p.locator('#fact').isVisible(),'audio delay cannot block result');equal(await p.evaluate(()=>navigator.audioSession.type),'playback','iOS playback session retained');equal(await p.evaluate(()=>mobileAudio.resumes),1,'no duplicated resume request');equal(await p.evaluate(()=>mobileAudio.notes.length),0,'no samples before resume');await p.evaluate(()=>mobileAudio.finish());await p.waitForFunction(()=>mobileAudio.notes.includes('correct'));equal(await p.evaluate(()=>mobileAudio.notes.filter(n=>n==='correct').length),1,'one supplied first answer after delayed resume');
  await setAudioEnabled(p,false);await p.reload();await p.locator('#chooseDaily:enabled').waitFor();equal(await p.locator('#toggleSound').getAttribute('data-muted'),'true','both mute preferences survive reload');equal(await p.evaluate(()=>mobileAudio.resumes),0,'muted reload cannot resume');
 }finally{await ctx.close();}
}
