// Anecdote-only integration checks. Previous saves and Supabase are synthetic.
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {setLanguage} from './language-control.mjs';
import {clickOutsideResult,clickResultAction} from './result-controls.mjs';
import {currentSave} from './save-fixtures.mjs';

export async function testFactsExpansion({newContext,url,core,tap,check,equal,output}) {
  const before=JSON.parse(await readFile(new URL('./fixtures/facts-before-20261014.json',import.meta.url),'utf8'));
  const origin=new URL(url).origin;
  const baseline=process.env.GEOFACT_FACTS_BASELINE_DIR;
  const currentHTML=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const oldHTML=baseline?await readFile(path.join(path.resolve(baseline),'index.html'),'utf8'):currentHTML.replace('&amp;facts=20261014-780','');
  const oldJS=baseline?await readFile(path.join(path.resolve(baseline),'data/facts.js'),'utf8'):'globalThis.GeoFactFacts = '+JSON.stringify(before)+';';
  const local=p=>p.evaluate(()=>({...localStorage}));
  const history=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('wg-seen-facts')));
  const rewards=p=>p.evaluate(async()=>{
    const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');
    const r=await openRewardRepository();try{return await r.read();}finally{r.close();}
  });
  async function practice(p,iso){
    await p.click('#choosePractice');await p.click('#practiceCustom');
    await p.locator(`input[value="${iso}"]`).check();await p.click('#startCustomPractice');
    await p.locator('#playing').waitFor({state:'visible'});
  }
  console.log('Expanded facts: previous-release saves, complete cycles, languages and long anecdotes…');
  const oldSeen=Object.fromEntries(Object.entries(before).map(([iso,fs])=>[iso,{seen:fs.map((_,i)=>i),last:fs.length-1}]));
  const seed={...currentSave,'wg-seen-facts':JSON.stringify(oldSeen),'gf-sound-v1':'off'};
  const ctx=await newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'fr-FR',reducedMotion:'reduce',storageState:{cookies:[],origins:[{origin,localStorage:Object.entries(seed).map(([name,value])=>({name,value}))}]}});
  try {
    let servingOld=true;const factRequests=[];
    await ctx.route(url+'**',route=>{
      const target=new URL(route.request().url());
      if(servingOld&&target.pathname==='/')return route.fulfill({contentType:'text/html',body:oldHTML});
      if(target.pathname==='/data/facts.js') {
        factRequests.push(target.href);
        // The old asset remains cached at its old URL after the upgrade.
        if(servingOld||!target.searchParams.has('facts'))return route.fulfill({contentType:'text/javascript',body:oldJS});
      }
      return route.fallback();
    });
    const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-14T10:00:00Z')});
    await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
    equal(await p.evaluate(()=>Object.values(GeoFactFacts).flat().length),201,'actual previous corpus loaded before upgrade');
    await practice(p,'FRA');
    for(let n=0;n<before.FRA.length;n++) {
      if(n)await clickResultAction(p,'#next');
      await tap('FRA','touch',p);await p.locator('#resultDialog[open]').waitFor();
      const selected=(await history(p)).FRA.last;
      equal(await p.locator('#fact').textContent(),before.FRA[selected].fr,'previous game actually draws and saves a historical anecdote');
    }
    await p.reload();await p.locator('#chooseDaily:enabled').waitFor();
    const saved=await local(p),canonical=await rewards(p),actualOldHistory=await history(p);
    equal([...actualOldHistory.FRA.seen].sort(),before.FRA.map((_,i)=>i),'previous game exhausts its historical French cycle');
    servingOld=false;await p.reload();await p.locator('#chooseDaily:enabled').waitFor();
    equal(await p.evaluate(()=>Object.values(GeoFactFacts).flat().length),981,'new data loaded despite the old asset cache');
    equal(await local(p),saved,'every previous localStorage value survives the same-origin upgrade');
    equal(await rewards(p),canonical,'canonical collections, Daily and chests are unchanged');
    equal(await history(p),actualOldHistory,'all 195 previous histories retain their exact old indices');
    check(factRequests.some(u=>!new URL(u).searchParams.has('facts')),'old asset was requested');
    check(factRequests.some(u=>new URL(u).searchParams.get('facts')==='20261014-780'),'only the facts asset receives its new cache key');
    const newIndices=new Set();
    for(let n=0;n<4;n++) {
      await practice(p,'FRA');await tap('FRA','touch',p);await p.locator('#resultDialog[open]').waitFor();
      const selected=(await history(p)).FRA.last;check(selected>=before.FRA.length,'old completed cycle exposes a new fact');newIndices.add(selected);
      const seen=await p.evaluate(()=>localStorage.getItem('wg-seen-facts'));
      for(const language of ['en','fr']) {
        await setLanguage(p,language);
        equal(await p.locator('#fact').textContent(),await p.evaluate(({index,language})=>GeoFactFacts.FRA[index][language],{index:selected,language}),'language translates the selected fact without another draw');
        equal(await p.evaluate(()=>localStorage.getItem('wg-seen-facts')),seen,'language leaves history bytes unchanged');
      }
      const snapshot=await history(p);await p.reload();await p.locator('#chooseDaily:enabled').waitFor();
      equal(await history(p),snapshot,'real reload preserves all anecdote history');
    }
    equal(newIndices.size,4,'all four appended French facts are drawn once before replaying the old fact');
    const last=(await history(p)).FRA.last;
    await practice(p,'FRA');await tap('FRA','touch',p);await p.locator('#resultDialog[open]').waitFor();
    check((await history(p)).FRA.last!==last,'next cycle cannot immediately repeat the previous last fact');
    equal((await history(p)).JPN,oldSeen.JPN,'multi-entry Japanese historical indices remain unchanged');
    const after=await local(p);
    for(const key of Object.keys(saved).filter(k=>!['wg-stats','wg-seen-facts'].includes(k)))equal(after[key],saved[key],'unrelated persistent value remains '+key);
  }finally{await ctx.close();}

  // Use the actual longest supplied anecdote, not an artificial replacement.
  for(const [width,height] of [[320,568],[390,844],[1280,900]])for(const mode of ['practice','daily','challenge']) {
    const ctx=await newContext({viewport:{width,height},hasTouch:width<600,isMobile:width<600,locale:'fr-FR',reducedMotion:'reduce'});
    try {
      const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-14T10:00:00Z')});
      await p.goto(mode==='challenge'?url+'?challenge='+core.encodeChallenge('easy',['NZL','FRA','JPN','USA','GBR'],100):url);
      await p.locator('#chooseDaily:enabled').waitFor({state:'attached'});
      await p.evaluate(()=>{
        const index=GeoFactFacts.NZL.findIndex(f=>f.fr.length===304);
        if(index<0)throw Error('Missing longest supplied anecdote');
        localStorage.setItem('wg-seen-facts',JSON.stringify({NZL:{seen:GeoFactFacts.NZL.map((_,i)=>i).filter(i=>i!==index),last:0}}));
      });
      // Reload so the unmodified app reads this synthetic history normally.
      await p.reload();
      if(mode==='challenge')await p.click('#acceptChallenge');
      else {
        await p.locator('#chooseDaily:enabled').waitFor();
        if(mode==='daily'){
          await p.evaluate(()=>{GeoFactCore.dailySeries=()=>['NZL','FRA','JPN','USA','GBR'];});await p.click('#chooseDaily');
        }else await practice(p,'NZL');
      }
      await p.locator('#playing').waitFor({state:'visible'});
      await tap('NZL',width<600?'touch':'mouse',p);await p.locator('#resultDialog[open]').waitFor();
      equal(await p.locator('#fact').textContent(),await p.evaluate(()=>GeoFactFacts.NZL.find(f=>f.fr.length===304).fr),'actual longest French fact is shown');
      const selected=(await history(p)).NZL.last;
      for(const language of ['fr','en']) {
        await setLanguage(p,language);
        equal(await p.locator('#fact').textContent(),await p.evaluate(({index,language})=>GeoFactFacts.NZL[index][language],{index:selected,language}),'long supplied translation is exact');
        check(await p.locator('#fact').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'long text wraps without clipping');
        check(await p.locator('#result .result-content').evaluate(pane=>{
          pane.scrollTop=pane.scrollHeight;
          const text=document.getElementById('fact').firstChild,range=document.createRange();
          range.setStart(text,text.length-1);range.setEnd(text,text.length);
          const last=range.getBoundingClientRect(),viewport=pane.getBoundingClientRect();
          return last.top>=viewport.top-1&&last.bottom<=viewport.bottom+1;
        }),'the end of the complete anecdote is readable using the existing result scroll');
        const box=await p.locator('#resultDialog').boundingBox();check(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=height+1,'result stays within the screen');
        check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
        for(const selector of ['#next','#shareFact','#closeResult']) {
          await p.locator(selector).scrollIntoViewIfNeeded();
          const button=await p.locator(selector).boundingBox();check(button&&button.y>=0&&button.y+button.height<=height+1,'result control remains reachable '+selector);
        }
        if(output){await mkdir(output,{recursive:true});await p.screenshot({path:`${output}/facts-${mode}-${width}-${language}.png`,animations:'disabled'});}
      }
      if(mode!=='practice') {
        await clickResultAction(p,'#next');
        for(const iso of ['FRA','JPN','USA','GBR']){
          await tap(iso,width<600?'touch':'mouse',p);await p.locator('#resultDialog[open]').waitFor();await clickResultAction(p,'#next');
        }
        await p.locator('#final').waitFor({state:'visible'});
        equal(await p.locator('#finalScore').textContent(),'100 / 100','anecdotes leave scoring unchanged');
      }
      if(mode==='daily') {
        await p.locator('#dailyChest').waitFor({state:'visible'});const beforeOpen=await rewards(p);
        await p.click('#openChest');await p.locator('#cardReveal').waitFor({state:'visible'});
        equal((await rewards(p)).collection,beforeOpen.collection,'revealing a Daily chest gives no duplicate credit');
        await p.click('#finalExploreCollection');await p.locator('#collection').waitFor({state:'visible'});
        check(await p.locator('#collection').isVisible(),'collection remains accessible after the new anecdote');
      }else {
        await clickOutsideResult(p,'#brand');await p.click('#openCollection');await p.locator('#collection').waitFor({state:'visible'});
      }
    }finally{await ctx.close();}
  }
}
