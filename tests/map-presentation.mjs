import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {setLanguage} from './language-control.mjs';
export async function testMapPresentation({newContext,url,core,check,equal,output}) {
 if(output)await mkdir(output,{recursive:true});
 for(const mobile of [false,true]){
  const ctx=await newContext({viewport:{width:mobile?390:1280,height:900},hasTouch:mobile,isMobile:mobile,locale:'fr-FR'});
  const p=await ctx.newPage();const name=mobile?'mobile':'desktop';
  const tap=async(x,y)=>mobile?p.touchscreen.tap(x,y):p.mouse.click(x,y);
  const capture=async(stage)=>{if(output)await p.locator('#playing').screenshot({path:path.join(output,`${name}-${stage}.png`)});};
  const controlsSafe=async()=>{
   check(await p.evaluate(()=>{const r=document.querySelector('.map-controls').getBoundingClientRect();return [...document.querySelectorAll('.microstate-marker[data-active="true"],.microstate-cluster[data-active="true"] .cluster-disc')].every(n=>{const b=n.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return x+22<=r.left||x-22>=r.right||y+22<=r.top||y-22>=r.bottom;});}),name+': no glyph or touch zone overlaps zoom commands');
  };
  const open=async(iso)=>{
   await p.goto(url+'?challenge='+core.encodeChallenge('hard',[iso,...['VAT','SMR','MCO','LIE','TUV'].filter(x=>x!==iso)].slice(0,5),100));
   await p.click('#acceptChallenge');await p.waitForTimeout(260);
  };
  const openGroups=async(iso,intermediate=false)=>{
   for(let i=0;i<12;i++){
    if(await p.locator(`.microstate-marker[data-iso="${iso}"]`).getAttribute('data-active')==='true'&&await p.locator(`.microstate-marker[data-iso="${iso}"]`).getAttribute('data-local')==='true')return;
    if(await p.locator(`.microstate-marker[data-iso="${iso}"]`).getAttribute('data-active')==='true'){
     // An isolated island is already selectable in the world view. Zoom around its verified anchor.
     await p.evaluate(iso=>{const s=document.querySelector('#map'),m=s.querySelector(`.microstate-marker[data-iso="${iso}"]`),l=m.previousElementSibling,pt=s.createSVGPoint();pt.x=+(l.style.display!=='none'?l.getAttribute('x1'):m.getAttribute('cx'));pt.y=+(l.style.display!=='none'?l.getAttribute('y1'):m.getAttribute('cy'));const q=pt.matrixTransform(s.getScreenCTM());s.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:q.x,clientY:q.y,deltaY:-100}));},iso);
     await p.waitForTimeout(260);continue;
    }
    const chosen=await p.evaluate(iso=>{
     const s=document.querySelector('#map'),shape=s.querySelector(`.territory-detail[data-iso="${iso}"]`),b=shape.getBBox(),pt=s.createSVGPoint();pt.x=b.x+b.width/2;pt.y=b.y+b.height/2;const a=pt.matrixTransform(s.getScreenCTM());
     return [...s.querySelectorAll('.microstate-cluster[data-active="true"]')].map(n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,d:Math.hypot(a.x-r.x-r.width/2,a.y-r.y-r.height/2)};}).sort((a,b)=>a.d-b.d)[0];
    },iso);
    check(!!chosen,name+': regional group can be opened');
    const score=await p.locator('#roundPoints').textContent(),saved=await p.evaluate(()=>JSON.stringify({...localStorage})),view=await p.locator('#map').getAttribute('viewBox');
    await tap(chosen.x,chosen.y);
    // A rapid second touch while controls crossfade must not guess the polygon underneath.
    await tap(chosen.x,chosen.y);
    await p.waitForTimeout(260);
    check(await p.locator('#map').getAttribute('viewBox')!==view,name+': + zooms');
    equal(await p.locator('#roundPoints').textContent(),score,name+': group has no penalty');
    equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved,name+': group preserves saves');
    check(!await p.locator('#result').isVisible()&&!await p.locator('#distanceRow').isVisible(),name+': group and rapid repeat never answer');
    await controlsSafe();if(intermediate&&i===0)await capture('region');
   }
   throw new Error('Group never separates '+iso);
  };
  try{
   await open('VAT');
   equal(await p.locator('.map-zoom-hint [data-i18n]').count(),1,name+': one contextual hint');
   equal(await p.locator('.map-zoom-hint span').textContent(),'Touche les repères + pour agrandir la zone.',name+': world + hint');
   check(await p.evaluate(()=>[...document.querySelectorAll('.microstate-cluster[data-active="true"]')].every(n=>n.querySelector('.cluster-plus')&&getComputedStyle(n.querySelector('.cluster-disc')).strokeDasharray==='none'&&n.getBoundingClientRect().width<=19)),name+': compact solid + groups');
   check(await p.evaluate(()=>[...document.querySelectorAll('.microstate-marker[data-active="true"]')].every(n=>n.getBoundingClientRect().width<=11)),name+': compact world dots');
   await controlsSafe();await capture('monde');
   await setLanguage(p,'en');equal(await p.locator('.map-zoom-hint span').textContent(),'Tap the + markers to zoom into the area.',name+': English contextual hint');await setLanguage(p,'fr');
   await openGroups('VAT',true);
   const vat=p.locator('.microstate-marker[data-iso="VAT"]'),smr=p.locator('.microstate-marker[data-iso="SMR"]');
   const vb=await vat.boundingBox();check(vb.width>=24&&vb.width<=28,name+': local Vatican target 24–28px');
   // Frame Vatican/San Marino together via their sourced geometry, using native wheel zoom if needed.
   if(await smr.getAttribute('data-active')==='true'){
    const sb=await smr.boundingBox();check(Math.abs(vb.x-sb.x)>=(mobile?44:32)||Math.abs(vb.y-sb.y)>=(mobile?44:32),name+': Vatican and San Marino have separate touch areas');
    check(await p.evaluate(()=>[...document.querySelectorAll('.microstate-tether')].filter(n=>n.style.display!=='none').every(n=>n.hasAttribute('x1')&&n.hasAttribute('x2'))),name+': every local offset has a leader line');
   }
   await capture('vatican-saint-marin');
   check(await p.evaluate(()=>[...document.querySelectorAll('.microstate-marker[data-active="true"],.microstate-cluster[data-active="true"]')].every(n=>!n.textContent&&!/Vatican|Saint|flag|Monaco/.test(n.getAttribute('aria-label')))),name+': no name, flag or searched-country styling');
   // Padding of the 44×44 square takes precedence over the neighbouring polygon.
   await tap(vb.x+vb.width/2+(mobile?20:15),vb.y+vb.height/2+(mobile?20:15));
   await p.locator('#result').waitFor({state:'visible'});check(await vat.evaluate(n=>n.classList.contains('country-found')),name+': native touch padding selects Vatican once');
   equal(await p.locator('#totalScore').textContent(),'20 / 100',name+': one correct response');
   await open('TUV');
   await openGroups('TUV');await controlsSafe();await capture('ile');
   const island=p.locator('.microstate-marker[data-iso="TUV"]'),ib=await island.boundingBox();check(ib.width>=24&&ib.width<=28,name+': island local target 24–28px');
   const before=await p.locator('#roundPoints').textContent();
   await p.evaluate(()=>{const s=document.querySelector('#map'),r=s.getBoundingClientRect();const send=(t,id,x,y)=>s.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y}));const x=r.x+r.width/2,y=r.y+r.height/2;send('pointerdown',1,x,y);send('pointermove',1,x+40,y+25);send('pointerup',1,x+40,y+25);send('pointerdown',2,x,y);send('pointerdown',3,x+70,y);send('pointermove',3,x+120,y);send('pointerup',2,x,y);send('pointerup',3,x+120,y);});
   equal(await p.locator('#roundPoints').textContent(),before,name+': drag and pinch never answer');check(!await p.locator('#result').isVisible(),name+': no gesture response');
   if(mobile){await p.setViewportSize({width:320,height:900});await p.waitForTimeout(240);check(await p.evaluate(()=>{const s=document.querySelector('.map-zoom-hint span');return s.getBoundingClientRect().height<22&&document.documentElement.scrollWidth<=320;}),'320px: single readable hint line');}
  }finally{await ctx.close();}
 }
}
