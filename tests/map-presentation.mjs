import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {setLanguage} from './language-control.mjs';
export async function testMapPresentation({newContext,url,core,check,equal,output}){
 if(output)await mkdir(output,{recursive:true});
 for(const mobile of [false,true]){
  const ctx=await newContext({viewport:{width:mobile?390:1280,height:900},hasTouch:mobile,isMobile:mobile,locale:'fr-FR'});
  const p=await ctx.newPage(),name=mobile?'mobile':'desktop';
  const tap=async(x,y)=>mobile?p.touchscreen.tap(x,y):p.mouse.click(x,y);
  const capture=async(stage)=>{if(output)await p.screenshot({path:path.join(output,`${name}-${stage}.png`)});};
  const open=async iso=>{await p.goto(url+'?challenge='+core.encodeChallenge('hard',[iso,...['VAT','SMR','MCO','LIE','TUV'].filter(x=>x!==iso)].slice(0,5),100));await p.click('#acceptChallenge');await p.waitForTimeout(260);};
  const saved=()=>p.evaluate(()=>JSON.stringify({...localStorage}));
  const reachTarget=async iso=>{
   for(let i=0;i<12;i++){
    await p.waitForTimeout(280);
    const target=p.locator(`.small-territory-dialog[open] .small-view-target[data-country="${iso}"]`);
    if(await target.count())return target;
    const groups=p.locator('.small-territory-dialog[open] .small-view-target[data-kind="cluster"]');
    const index=await groups.evaluateAll((nodes,iso)=>nodes.findIndex(n=>n.dataset.members.split('|').includes(iso)),iso);
    check(index>=0,name+': group available to separate '+iso);
    const score=await p.locator('#roundPoints').textContent(),before=await saved();
    if(mobile)await groups.nth(index).tap();else await groups.nth(index).click();await p.waitForTimeout(280);
    equal(await saved(),before,name+': inset zoom preserves saves');equal(await p.locator('#roundPoints').textContent(),score,name+': inset zoom has no penalty');check(!await p.locator('#result').isVisible(),name+': inset group never answers');
   }throw Error('Unresolved inset target '+iso);
  };
  const openInset=async(iso,useCluster=false)=>{
   await p.waitForTimeout(280);
   if(useCluster){
    const groups=p.locator('.microstate-cluster[data-active="true"]');
    const index=await groups.evaluateAll((nodes,iso)=>nodes.findIndex(n=>n.dataset.members.split('|').includes(iso)),iso);
    check(index>=0,name+': world group contains '+iso);const r=await groups.nth(index).boundingBox();await tap(r.x+r.width/2,r.y+r.height/2);await tap(r.x+r.width/2,r.y+r.height/2);
   }else{
    for(let i=0;i<14;i++){
     const marker=p.locator(`.microstate-marker[data-iso="${iso}"]`);
     if(await marker.getAttribute('data-active')==='true'){const r=await marker.boundingBox();await tap(r.x+r.width/2,r.y+r.height/2);break;}
     await p.evaluate(iso=>{const s=document.querySelector('#map'),m=s.querySelector(`.microstate-marker[data-iso="${iso}"]`),pt=s.createSVGPoint();pt.x=+m.dataset.anchorX;pt.y=+m.dataset.anchorY;const q=pt.matrixTransform(s.getScreenCTM());s.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:q.x,clientY:q.y,deltaY:-100}));},iso);await p.waitForTimeout(260);
    }
   }
   await p.locator('.small-territory-dialog[open]').waitFor();await p.waitForTimeout(280);
   check(!await p.locator('#result').isVisible(),name+': opening never answers');return reachTarget(iso);
  };
  const safeLayout=async()=>{
   check(await p.evaluate(()=>{const f=document.querySelector('.small-territory-dialog[open] .small-view-frame').getBoundingClientRect(),bs=[...document.querySelectorAll('.small-territory-dialog[open] .small-view-target')].map(n=>n.getBoundingClientRect());return bs.every((r,i)=>r.width===48&&r.height===48&&r.left>=f.left&&r.right<=f.right&&r.top>=f.top&&r.bottom<=f.bottom&&bs.every((q,j)=>i===j||r.right<=q.left||r.left>=q.right||r.bottom<=q.top||r.top>=q.bottom));}),name+': 48px targets stay inside inset without overlaps');
   check(await p.evaluate(()=>[...document.querySelectorAll('.small-territory-dialog[open] .small-view-target span')].every(n=>n.getBoundingClientRect().width===28)),name+': visible targets are 28px');
  };
  try{
   await open('VAT');await capture('monde');
   equal(await p.locator('.map-zoom-hint [data-i18n]').count(),1,name+': one map hint');equal(await p.locator('.map-zoom-hint span').textContent(),'Touche un repère pour agrandir.',name+': French hint');
   await setLanguage(p,'en');equal(await p.locator('.map-zoom-hint span').textContent(),'Tap a marker for a closer view.',name+': English hint');await setLanguage(p,'fr');
   const score=await p.locator('#roundPoints').textContent(),before=await saved(),mainView=await p.locator('#map').getAttribute('viewBox');
   const vat=await openInset('VAT',true);await safeLayout();await capture('micro-etats');
   equal(await saved(),before,name+': opening and zoom preserve saves');equal(await p.locator('#roundPoints').textContent(),score,name+': no exploration penalty');equal(await p.locator('#map').getAttribute('viewBox'),mainView,name+': main camera preserved');
   check(await p.locator('.small-territory-dialog[open] .small-view-target[data-country="ITA"]').count()===0,name+': Italy has no selectable target in the inset');
   equal(await p.locator('.small-territory-dialog h2').textContent(),'Vue agrandie',name+': anonymous French title');
   check(await p.evaluate(()=>[...document.querySelectorAll('.small-territory-dialog[open] .small-view-target')].every(n=>!/(Vatican|Monaco|Italy|Italie|Saint|flag)/i.test(n.getAttribute('aria-label')))),name+': no territory name or flag');
   const outside=await p.evaluate(()=>{const d=document.querySelector('.small-territory-dialog[open]'),map=d.querySelector('svg'),land=map.querySelector('[data-context="ITA"]'),f=d.querySelector('.small-view-frame').getBoundingClientRect(),bs=[...d.querySelectorAll('.small-view-target')].map(n=>n.getBoundingClientRect()),v=d.querySelector('[data-country="VAT"]').getBoundingClientRect();for(let dx=-60;dx<=60;dx+=6)for(let dy=-60;dy<=60;dy+=6){const x=v.x+24+dx,y=v.y+24+dy;if(x<f.left+24||x>f.right-24||y<f.top+24||y>f.bottom-24||bs.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom))continue;const q=map.createSVGPoint();q.x=x;q.y=y;if(land.isPointInFill(q.matrixTransform(map.getScreenCTM().inverse())))return{x,y};}});
   check(!!outside,name+': Italian land just outside Vatican target exists');await tap(outside.x,outside.y);
   equal(await p.locator('#roundPoints').textContent(),score,name+': surrounding land has no penalty');equal(await saved(),before,name+': surrounding land preserves saves');check(!await p.locator('#result').isVisible()&&!await p.locator('#distanceRow').isVisible(),name+': surrounding land never answers');
   const vb=await vat.boundingBox();
   await p.evaluate(({x,y})=>{const f=document.querySelector('.small-territory-dialog[open] .small-view-frame'),send=(t,id,a,b)=>f.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:id,pointerType:'touch',clientX:a,clientY:b}));send('pointerdown',1,x,y);send('pointermove',1,x+30,y+15);send('pointerup',1,x+30,y+15);send('pointerdown',2,x,y);send('pointerdown',3,x+70,y);send('pointermove',3,x+110,y);send('pointerup',2,x,y);send('pointerup',3,x+110,y);send('pointerdown',4,x,y);send('pointercancel',4,x,y);},{x:vb.x+24,y:vb.y+24});
   check(!await p.locator('#result').isVisible(),name+': gestures never answer');equal(await saved(),before,name+': gestures preserve saves');
   await p.keyboard.press('Escape');check(!await p.locator('.small-territory-dialog').isVisible(),name+': Escape closes safely');equal(await p.locator('#map').getAttribute('viewBox'),mainView,name+': closing preserves main view');
   const selected=await openInset('VAT',true),b=await selected.boundingBox();await tap(b.x+45,b.y+45);
   await p.locator('#result').waitFor();equal(await p.locator('#totalScore').textContent(),'20 / 100',name+': padded target selects Vatican once');check(await p.locator('#map .microstate-marker[data-iso="VAT"]').evaluate(n=>n.classList.contains('country-found')),name+': original success feedback');check(!await p.locator('.small-territory-dialog').isVisible(),name+': inset closes before result');
   for(const iso of ['SMR','MCO','LIE','TUV','NRU','MDV','KIR','ATG']){
    await open(iso);const target=await openInset(iso);await safeLayout();if(iso==='TUV')await capture('iles');
    const r=await target.boundingBox();await tap(r.x+24,r.y+24);await p.locator('#result').waitFor();equal(await p.locator('#totalScore').textContent(),'20 / 100',name+': '+iso+' single correct response');
   }
   await open('VAT');await openInset('VAT',true);const wrong=await reachTarget('SMR'),wb=await wrong.boundingBox();await tap(wb.x+24,wb.y+24);check(await p.locator('#distanceRow').isVisible(),name+': wrong choice uses original distance');check(!await p.locator('#result').isVisible(),name+': wrong choice keeps round active');check((await p.locator('#roundPoints').textContent())!==score,name+': original penalty');
   await open('VAT');await setLanguage(p,'en');await openInset('VAT',true);equal(await p.locator('.small-territory-dialog h2').textContent(),'Closer view',name+': English title');equal(await p.locator('.small-territory-dialog p').textContent(),'Tap a target to answer.',name+': English hint');
   if(mobile){await p.setViewportSize({width:320,height:740});await p.waitForTimeout(260);await safeLayout();check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px: no overflow');await capture('mobile-320');}
   const insetView=await p.locator('.small-territory-dialog[open] svg').getAttribute('viewBox'),zoomSave=await saved();await p.locator('.small-territory-dialog[open] [data-zoom="in"]').click();await p.waitForTimeout(300);check(await p.locator('.small-territory-dialog[open] svg').getAttribute('viewBox')!==insetView,name+': inset zoom controls work');equal(await saved(),zoomSave,name+': animated zoom preserves saves');check(!await p.locator('#result').isVisible(),name+': animated zoom never answers');
   await p.locator('.small-view-close').click();check(!await p.locator('.small-territory-dialog').isVisible(),name+': close button');
  }finally{await ctx.close();}
 }
}
