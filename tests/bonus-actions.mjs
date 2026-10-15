import {mkdir} from 'node:fs/promises';

// Local, committed chests only: no player saves or production quota changes.
export async function testBonusActions({newContext,url,check,equal,output}) {
  const read=p=>p.evaluate(async()=>{
    const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');
    const r=await openRewardRepository();try{return await r.read();}finally{r.close();}
  });
  const local=p=>p.evaluate(()=>({...localStorage}));
  console.log('Bonus actions: two peach actions without a collection duplicate, FR/EN, small screens, destinations and scrolling…');
  for(const [width,height] of [[1280,900],[320,568],[375,667],[390,844],[568,320],[1280,400]])for(const language of ['fr','en']) {
    const ctx=await newContext({viewport:{width,height},hasTouch:width<600,isMobile:width<600,locale:language==='fr'?'fr-FR':'en-US',reducedMotion:'reduce'});
    try {
      await ctx.addInitScript(language=>{
        if(location.protocol==='http:'&&!localStorage.getItem('wg-lang')){localStorage.setItem('wg-lang',language);localStorage.setItem('gf-sound-v1','off');}
      },language);
      const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-14T10:00:00Z')});await p.goto(url);await p.locator('#chooseDaily:enabled').waitFor();
      await p.evaluate(async()=>{
        window.originalBonusCollection=document.getElementById('bonusViewCollection');
        const {openRewardRepository}=await import('./reward-repository.mjs?v=20261009-update1');
        const r=await openRewardRepository();try{
          for(let n=0;n<20;n++)await r.answer({id:'bonus-layout:'+String(n).padStart(2,'0'),roundId:'bonus-layout-round:'+n,mode:'practice',correct:true,at:Date.now(),countryDraw:0,rarityDraw:.8},[n<10?'USA':'GRC']);
        }finally{r.close();}
        window.dispatchEvent(new Event('focus'));
      });
      await p.click('#openBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});
      await p.click('#closeBonusRewards');check(!await p.locator('#bonusDialog').evaluate(e=>e.open),'original close button works before reveal');
      await p.click('#openBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});
      const originalFooter=await p.locator('#bonusViewCollection').evaluate(e=>({background:getComputedStyle(e).backgroundColor,parent:e.parentElement.id}));
      equal(originalFooter.parent,'bonusDialog','sealed-chest collection action stays in its original position');
      const sealed=await read(p);
      await p.click('#bonusViewCollection');await p.locator('#collection[data-view="continents"]').waitFor({state:'visible'});
      equal(await read(p),sealed,'collection overview remains available before reveal without opening a chest');
      await p.click('#collectionBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});
      await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor({state:'visible'});
      const first=await read(p),saved=await local(p),chests=Object.values(first.bonus.chests);
      equal(chests.filter(c=>c.openedAt!==null).length,1,'opening credits one chest normally');
      equal(first.bonus.grantsByDay[chests[0].earnedDay],2,'synthetic chests respect the daily quota');
      const grid=p.locator('#bonusDialog .bonus-reveal-actions'),buttons=grid.locator('button');
      equal(await buttons.count(),2,'one grid contains the continent and map actions');
      check(await p.locator('#bonusViewCollection').isHidden(),'generic collection action is absent after reveal');
      equal(await p.locator('#bonusViewCollection').count(),1,'no duplicate collection action');
      check(await p.evaluate(()=>document.getElementById('bonusViewCollection')===window.originalBonusCollection),'existing collection node and listener remain available before reveal');
      await grid.scrollIntoViewIfNeeded();
      const layout=await grid.evaluate(e=>({box:e.getBoundingClientRect().toJSON(),gap:parseFloat(getComputedStyle(e).gap),buttons:[...e.children].map(b=>b.getBoundingClientRect().toJSON())}));
      const [a,b]=layout.buttons;
      if(width>600) {
        check(Math.abs(a.y-b.y)<1&&Math.abs(a.height-b.height)<1,'desktop first row has aligned equal-height columns');
        check(Math.abs(a.width-b.width)<1,'desktop first columns have equal widths');
      }else{
        check(Math.abs(a.x-b.x)<1,'mobile left edges are aligned');
        check(Math.abs(a.width-b.width)<1,'mobile actions have the same width');
        check(Math.abs(b.y-a.bottom-layout.gap)<1,'mobile rows have regular gaps');
      }
      const progress=await p.locator('#bonusCardReveal .reward-summary progress').boundingBox();
      check(Math.abs(progress.x-layout.box.x)<1&&Math.abs(progress.width-layout.box.width)<1,'grid is centred and aligned with continent progress');
      check(layout.box.y>=progress.y+progress.height,'actions follow the unchanged continent progress');
      await p.mouse.move(0,0);
      equal(await buttons.evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor)),Array(2).fill('rgb(245, 198, 173)'),'both use the exact Daily peach');
      equal(await buttons.evaluateAll(es=>es.map(e=>getComputedStyle(e).color)),Array(2).fill('rgb(52, 33, 43)'),'same dark Daily text');
      check(await buttons.evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().height>=44)),'long translated labels wrap and keep comfortable targets');
      check(await p.locator('#bonusDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog has no horizontal overflow');
      check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page has no horizontal overflow');
      const dialog=await p.locator('#bonusDialog').boundingBox();
      check(dialog.x>=0&&dialog.x+dialog.width<=width+1&&dialog.y>=0&&dialog.y+dialog.height<=height+1,'dialog remains in the available viewport');
      if(height<500)check(await p.locator('#bonusDialog').evaluate(e=>e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto'),'short screens use existing dialog scrolling');
      for(const selector of ['[data-reward-continent]','[data-country-map]','#closeBonusRewards']){
        const action=p.locator('#bonusDialog '+selector);await action.scrollIntoViewIfNeeded();const box=await action.boundingBox();
        check(box&&box.y>=0&&box.y+box.height<=height+1,'action and close remain reachable '+selector);
      }
      await buttons.first().scrollIntoViewIfNeeded();await buttons.first().hover();await p.waitForTimeout(180);
      equal(await buttons.first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 220, 192)','hover brightens Braise peach');
      equal(await buttons.first().evaluate(e=>getComputedStyle(e).transform),'matrix(1, 0, 0, 1, 0, -1)','subtle hover displacement');
      await p.mouse.down();await p.waitForTimeout(180);
      equal(await buttons.first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 220, 192)','press retains Braise peach');
      equal(await buttons.first().evaluate(e=>getComputedStyle(e).transform),'matrix(1, 0, 0, 1, 0, 1)','subtle pressed displacement');
      await p.mouse.move(0,0);await p.mouse.up();
      await p.keyboard.press('Tab');await buttons.first().focus();
      equal(await buttons.first().evaluate(e=>getComputedStyle(e).outlineWidth),'2px','visible Braise focus outline');
      await buttons.first().evaluate(e=>e.blur());
      await p.mouse.move(0,0);await p.waitForTimeout(180);
      if(output){await mkdir(output,{recursive:true});await grid.scrollIntoViewIfNeeded();await p.screenshot({path:`${output}/bonus-${width}x${height}-${language}.png`,animations:'disabled'});}
      // The country-map round trip cannot change the revealed card or any reward.
      await grid.locator('[data-country-map]').click();await p.locator('#countryMapDialog[open]').waitFor();
      check(await p.locator('#countryLookupMap [data-iso="USA"].country-found').count()>0,'map destination is the unchanged drawn country');
      await p.click('#closeCountryMap');await p.locator('#bonusDialog[open]').waitFor();
      equal(await read(p),first,'map round trip preserves every reward field');equal(await local(p),saved,'map round trip preserves persistent preferences/statistics');
      equal(await p.locator('#bonusDialog .bonus-reveal-actions button').count(),2,'return from map preserves the shared grid');
      await p.locator('#bonusDialog [data-reward-continent]').click();await p.locator('#collection[data-view="northAmerica"]').waitFor({state:'visible'});
      equal(await p.locator('#collection').getAttribute('data-view'),'northAmerica','explore collection opens the drawn continent');
      check(!await p.locator('#bonusDialog').evaluate(e=>e.open),'continent action closes the bonus window');
      equal(await read(p),first,'exploring collection gives no extra reward');
      await p.click('#collectionBonusRewards');await p.locator('#bonusChestStage').waitFor({state:'visible'});
      // Selecting the other sealed chest restores the original footer placement.
      const remaining=chests.find(c=>c.openedAt===null);
      await p.locator(`[data-chest-id="${remaining.id}"]`).click();await p.locator('#bonusChestStage').waitFor({state:'visible'});
      equal(await p.locator('#bonusViewCollection').evaluate(e=>e.parentElement.id),'bonusDialog','original footer position is preserved');
      check(await p.locator('#bonusViewCollection').isVisible(),'general collection access returns for a sealed chest');
      equal(await p.locator('#bonusViewCollection').evaluate(e=>getComputedStyle(e).backgroundColor),originalFooter.background,'sealed-chest action retains its original colour');
      await p.click('#openBonusChest');await p.locator('#bonusCardReveal').waitFor({state:'visible'});
      equal(await p.locator('#bonusDialog .bonus-reveal-actions button').count(),2,'second reveal reuses the same two-action layout');
      check(await p.evaluate(()=>document.getElementById('bonusViewCollection')===window.originalBonusCollection),'second reveal preserves the original listener node');
      const opened=await read(p);
      check(await p.locator('#bonusViewCollection').isHidden(),'second reveal also hides the duplicate');
      await p.locator('#closeBonusRewards').scrollIntoViewIfNeeded();await p.click('#closeBonusRewards');
      check(!await p.locator('#bonusDialog').evaluate(e=>e.open),'close works after a revealed card');
      equal(await read(p),opened,'layout, focus and navigation leave all reward data unchanged');
    }finally{await ctx.close();}
  }
}
