// Run with the same Playwright/Chromium variables as test:browser.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {testMapPresentation} from './map-presentation.mjs';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../core.js');
const root=path.resolve(new URL('../',import.meta.url).pathname);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--disable-dev-shm-usage']}:{})});
const html=await readFile(path.join(root,'index.html'),'utf8'),svg=html.match(/<svg[^>]*id="map"[\s\S]*?<\/svg>/)[0];
const css=await readFile(path.join(root,'style.css'),'utf8');
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+'/'))return res.writeHead(403).end();
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const errors=[];
const output=process.env.GEOFACT_CAPTURE_DIR;
if(output)await mkdir(output,{recursive:true});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:{width:mobile?390:1280,height:900},hasTouch:mobile,isMobile:mobile,locale:'fr-FR'});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.setContent(`<html lang="fr"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}\nbody{margin:0;padding:8px}#map{width:100%;height:650px;touch-action:none}.map-wrap{width:100%;}</style><div class="map-wrap">${svg}</div></html>`);
  for(const file of ['i18n.js','data/countries.js','data/small-territories.js','map.js'])await p.addScriptTag({content:await readFile(path.join(root,file),'utf8')});
  await p.evaluate(()=>{globalThis.guesses=[];globalThis.controller=GeoFactMap(document.querySelector('#map'),iso=>guesses.push(iso));});
  await p.waitForTimeout(220);
  const data=await p.evaluate(()=>{
   const s=document.querySelector('#map'),iso=new Set([...s.querySelectorAll('path[data-iso]')].map(n=>n.dataset.iso));
   return{coverage:GeoFactCountries.every(c=>iso.has(c.iso)),clusters:s.querySelectorAll('.microstate-cluster').length,
    neutral:[...s.querySelectorAll('.microstate-marker,.microstate-cluster')].every(n=>!n.textContent&&!(n.getAttribute('aria-label')||'').match(/Monaco|Vatican|flag/i))};
  });check(data.coverage,'195 collectible countries have geometry');check(data.clusters===0,'no world cluster symbols');check(data.neutral,'neutral labels');
  // Test the actual SVG CTM and real native input, not a synthetic selection target.
  const zoomTo=async(iso,factor)=>{
   await p.evaluate(({iso,factor})=>{
    controller.reset();
    // Camera uses the verified interior anchor, not an archipelago's bounding-box centre.
    const q=document.querySelector('#map').createSVGPoint();const marker=document.querySelector(`.microstate-marker[data-iso="${iso}"]`);q.x=+marker.dataset.anchorX;q.y=+marker.dataset.anchorY;const a=q.matrixTransform(document.querySelector('#map').getScreenCTM());controller.zoom(factor,a.x,a.y);
   },{iso,factor});await p.waitForTimeout(280);
  };
  const click=async(x,y)=>mobile?p.touchscreen.tap(x,y):p.mouse.click(x,y);
  for(const iso of ['MCO','VAT','SMR','LIE','TUV','NRU','KNA','DMA','MDV','KIR','MHL','SGP']){
   await zoomTo(iso,({LIE:20,SMR:20,SGP:10,KIR:5,MHL:20})[iso]||80);
   const m=p.locator(`.microstate-marker[data-iso="${iso}"]`);
   for(const factor of [20,40,10,5,3,2,80,160]){if(await m.isVisible())break;await zoomTo(iso,factor);}
   check(await m.isVisible(),iso+' visible at intermediate zoom');
   const b=await m.boundingBox();check(b.width>=4.9 && b.width<=10.5,iso+' screen-sized target '+JSON.stringify(b));
   await click(b.x+b.width/2,b.y+b.height/2);
   check(await p.evaluate(iso=>guesses.at(-1)===iso,iso),iso+' native selection');
   check(await p.evaluate(iso=>{const m=document.querySelector(`.microstate-marker[data-iso="${iso}"]`),s=document.querySelector('#map'),p=s.createSVGPoint();const tether=m.previousElementSibling;p.x=+(tether.style.display!=='none'?tether.getAttribute('x1'):m.getAttribute('cx'));p.y=+(tether.style.display!=='none'?tether.getAttribute('y1'):m.getAttribute('cy'));return document.querySelector(`.territory-detail[data-iso="${iso}"]`).isPointInFill(p);},iso),iso+' dot inside sourced geometry');
  }
  await zoomTo('MCO',80);
  const neighbours=await p.evaluate(()=>{
   const s=document.querySelector('#map'),m=s.querySelector('.microstate-marker[data-iso="MCO"]'),r=m.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
   const found=[];
   for(let dx=-35;dx<=35;dx+=3)for(let dy=-35;dy<=35;dy+=3){const t=document.elementFromPoint(x+dx,y+dy);if(t?.matches('path[data-iso="FRA"]')&&Math.max(Math.abs(dx),Math.abs(dy))>22)found.push({x:x+dx,y:y+dy,iso:controller.resolveCountry(t,x+dx,y+dy,'touch')});}
   return found;
  });check(neighbours.length>0,'French land outside individual control exists');check(neighbours.every(n=>n.iso==='FRA'),'outside the control, neighbour selection is preserved');
  await click(neighbours[0].x,neighbours[0].y);check(await p.evaluate(()=>guesses.at(-1)==='FRA'),'native neighbour click');
  // Ocean comfort zone: touch gets 44px, mouse 24px, without a large painted circle.
  await zoomTo('NRU',80);
  check(await p.evaluate(()=>{const s=document.querySelector('#map'),m=s.querySelector('.microstate-marker[data-iso="NRU"]'),r=m.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return controller.resolveCountry(s,x+20,y,'touch')==='NRU'&&controller.resolveCountry(s,x+20,y,'mouse')===null;}),'44px touch / 24px mouse');
  await p.evaluate(()=>{document.body.style.marginTop='73px';});
  check(await p.evaluate(()=>{const s=document.querySelector('#map'),m=s.querySelector('.microstate-marker[data-iso="NRU"]'),r=m.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return controller.resolveCountry(s,x+20,y,'touch')==='NRU';}),'comfort zone follows page translation without resize');
  await p.evaluate(()=>{document.body.style.marginTop='0';});
  await zoomTo('MLT',300);
  check(await p.locator('.microstate-marker[data-iso="MLT"]').isVisible()===false,'dot fades out when real shape is selectable');
  check(await p.evaluate(()=>controller.getView().w)===4,'maximum zoom preserved');
  const landPoint=await p.evaluate(()=>{const s=document.querySelector('#map'),shape=s.querySelector('.territory-detail[data-iso="MLT"]'),b=shape.getBBox(),r=s.getBoundingClientRect();for(let i=1;i<50;i++)for(let j=1;j<50;j++){const q=s.createSVGPoint();q.x=b.x+b.width*i/50;q.y=b.y+b.height*j/50;if(shape.isPointInFill(q)){const a=q.matrixTransform(s.getScreenCTM());if(a.x>r.left&&a.x<r.right&&a.y>r.top&&a.y<r.bottom&&document.elementFromPoint(a.x,a.y)===shape)return{x:a.x,y:a.y};}}});
  check(!!landPoint,'real contour remains accessible after fading');await click(landPoint.x,landPoint.y);check(await p.evaluate(()=>guesses.at(-1)==='MLT'),'native selection through real contour');
  const beforeGestures=await p.evaluate(()=>guesses.length);
  await p.evaluate(()=>{
   const s=document.querySelector('#map'),r=s.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
   const send=(type,id,a,b)=>s.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',clientX:a,clientY:b}));
   send('pointerdown',1,x,y);send('pointermove',1,x+40,y+20);send('pointerup',1,x+40,y+20);
   send('pointerdown',2,x,y);send('pointerdown',3,x+100,y);send('pointermove',2,x-50,y);send('pointerup',2,x-50,y);send('pointerup',3,x+100,y);
   send('pointerdown',4,x,y);send('pointercancel',4,x,y);
  });check(await p.evaluate(()=>guesses.length)===beforeGestures,'pan pinch cancel never answer');
  // Real application: wrong and correct answers through dots, no persistence during cluster zoom.
  await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
  await p.goto(url+'/?challenge='+core.encodeChallenge('hard',['MCO','VAT','SMR','LIE','TUV'],100));await p.click('#acceptChallenge');
  const savedBeforeZoom=await p.evaluate(()=>JSON.stringify({...localStorage}));
  await p.evaluate(()=>{const s=document.querySelector('#map'),pt=s.createSVGPoint();pt.x=(7.398291+180)/.3;pt.y=(90-43.739652)/.3;const q=pt.matrixTransform(s.getScreenCTM());document.querySelector('#map').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:q.x,clientY:q.y,deltaY:-100}));});
  await p.waitForTimeout(220);
  // Native wheel zoom retains the original main-map camera and normal borders.
  for(let i=0;i<12&&(await p.locator('.microstate-marker[data-iso="MCO"]').getAttribute('data-active'))!=='true';i++){
   await p.evaluate(()=>{const s=document.querySelector('#map'),m=s.querySelector('.microstate-marker[data-iso="MCO"]'),pt=s.createSVGPoint();pt.x=+m.dataset.anchorX;pt.y=+m.dataset.anchorY;const a=pt.matrixTransform(s.getScreenCTM());s.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:a.x,clientY:a.y,deltaY:-100}));});await p.waitForTimeout(260);
  }
  check(!await p.locator('#result').isVisible(),'cluster exploration produces no result');
  check(await p.evaluate(()=>JSON.stringify({...localStorage}))===savedBeforeZoom,'cluster zoom preserves saves');
  check((await p.locator('#roundPoints').textContent()).startsWith('20'),'cluster zoom preserves score: '+await p.locator('#roundPoints').textContent());
  if(output)await p.locator('#playing').screenshot({path:path.join(output,mobile?'geofact-mobile.png':'geofact-desktop.png')});
  const appZoom=async iso=>{await p.click('#resetMap');for(let i=0;i<8;i++){await p.evaluate(iso=>{const svg=document.querySelector('#map'),m=svg.querySelector(`.microstate-marker[data-iso="${iso}"]`),q=svg.createSVGPoint();q.x=+m.dataset.anchorX;q.y=+m.dataset.anchorY;const pt=q.matrixTransform(svg.getScreenCTM());svg.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:pt.x,clientY:pt.y,deltaY:-100}));},iso);await p.waitForTimeout(260);}};
  await appZoom('VAT');const wrong=p.locator('.microstate-marker[data-iso="VAT"]'),wb=await wrong.boundingBox();await click(wb.x+wb.width/2,wb.y+wb.height/2);
  check(await p.locator('#distanceRow').isVisible(),'wrong dot uses existing feedback');check(!await p.locator('#result').isVisible(),'wrong dot keeps round active');check(!(await p.locator('#roundPoints').textContent()).startsWith('20'),'wrong dot applies existing penalty');check(await wrong.evaluate(n=>n.classList.contains('country-tried')),'wrong dot existing colour');
  await appZoom('MCO');
  const marker=p.locator('.microstate-marker[data-iso="MCO"]');const realBox=await marker.boundingBox();check(!!realBox,'real-game Monaco target accessible');
  await click(realBox.x+realBox.width/2,realBox.y+realBox.height/2);await p.locator('#result').waitFor({state:'visible'});
  check(await p.locator('.microstate-marker[data-iso="MCO"]').evaluate(n=>n.classList.contains('country-found')),'correct dot uses existing success logic');
  await context.close();
 }
 const presentationContext=async options=>{
  const ctx=await browser.newContext({serviceWorkers:'block',...options});
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
  ctx.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));return ctx;
 };
 await testMapPresentation({newContext:presentationContext,url:url+'/',core,check,equal:(a,b,message)=>{assert.deepEqual(a,b,message);checks++;},output});
 check(errors.length===0,errors.join('\n'));console.log(`Small territories: ${checks} checks passed on desktop and touch mobile.`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
