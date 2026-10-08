// The border label must not influence the existing distance-based penalty.
export async function testBorders({newContext,url,core,tap,check,equal}) {
  const messages={fr:"Tout près ! C'est un pays voisin.",en:"Very close! It's a neighbouring country."};
  const snapshot=p=>p.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  async function openPractice(p,iso) {
    await p.goto(url); await p.click('#choosePractice'); await p.click('#practiceCustom');
    await p.locator(`#practiceCountryList input[value="${iso}"]`).check();
    await p.click('#startCustomPractice'); await p.locator('#playing').waitFor({state:'visible'});
  }
  async function originalDistance(p,a,b) {
    return p.evaluate(([a,b])=>{
      const shape=iso=>{
        const el=document.querySelector(`#map path.country-shape[data-iso="${iso}"], #map circle.microstate[data-iso="${iso}"]`);
        return el.tagName.toLowerCase()==='path' ? GeoFactCore.samplePath(el.getAttribute('d')) :
          {points:[GeoFactCore.spherePoint(+el.getAttribute('cx'),+el.getAttribute('cy'))],vertices:new Set()};
      };
      return GeoFactCore.territoryDistance(shape(a),shape(b));
    },[a,b]);
  }
  async function feedback(p,neighbour,label) {
    check(await p.locator('#distanceRow').isVisible(),label+': wrong-answer feedback visible');
    const lang=await p.locator('#lang').inputValue(),text=await p.locator('#distanceReaction').textContent();
    equal(text.endsWith(messages[lang]),neighbour,label+': exact translated neighbour text');
    equal(await p.locator('#distance').isVisible(),!neighbour,label+': kilometres visibility');
    if(neighbour) equal(await p.locator('#distance').textContent(),'',label+': no kilometres');
    else check(/\d.* km$/.test(await p.locator('#distance').textContent()),label+': original kilometre feedback');
  }
  // SVG interior point in Belgium: real mouse and real touchscreen input paths.
  async function nativeBelgium(p,mobile) {
    await p.locator('#map').scrollIntoViewIfNeeded();
    if(mobile) {
      // At world scale the existing microstate markers overlap Belgium. Zoom
      // towards Europe through the regular pinch handler before the native tap.
      await p.evaluate(()=>{
        const svg=document.getElementById('map');
        for(let i=0;i<2;i++) {
          const pt=svg.createSVGPoint();pt.x=(4.7+180)/.3;pt.y=(90-50.7)/.3;
          const c=pt.matrixTransform(svg.getScreenCTM());
          const send=(event,id,x)=>svg.dispatchEvent(new PointerEvent(event,{bubbles:true,pointerId:id,pointerType:'touch',clientX:x,clientY:c.y,button:0}));
          send('pointerdown',91,c.x-20);send('pointerdown',92,c.x+20);
          send('pointermove',91,c.x-60);send('pointermove',92,c.x+60);
          send('pointerup',92,c.x+60);send('pointerup',91,c.x-60);
        }
      });
      await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    }
    const point=await p.evaluate(()=>{
      const svg=document.getElementById('map'),pt=svg.createSVGPoint();
      pt.x=(4.7+180)*1200/360;pt.y=(90-50.7)*600/180;
      const screen=pt.matrixTransform(svg.getScreenCTM());
      return {x:screen.x,y:screen.y,iso:document.elementFromPoint(screen.x,screen.y)?.dataset.iso};
    });
    equal(point.iso,'BEL','Belgium native hit target');
    if(mobile) await p.touchscreen.tap(point.x,point.y); else await p.mouse.click(point.x,point.y);
  }
  for(const mobile of [false,true]) {
    const label=mobile?'mobile':'desktop'; console.log(`  Borders: ${label}`);
    const ctx=await newContext({locale:'fr-FR',viewport:{width:mobile?390:1280,height:850},hasTouch:mobile,isMobile:mobile});
    try {
      const p=await ctx.newPage(),input=mobile?'touch':'mouse';
      // Keep the same live wrong answer when switching language.
      await p.goto(url+'?challenge='+core.encodeChallenge('easy',['FRA','JPN','USA','GBR','NOR'],100));
      await p.click('#acceptChallenge'); const saved=await snapshot(p);
      await nativeBelgium(p,mobile); await feedback(p,true,label+' France–Belgium FR');
      equal(await p.locator('#roundPoints').textContent(),'19 points',label+': unchanged neighbour penalty');
      equal(await snapshot(p),saved,label+': wrong answer writes no saves');
      await p.selectOption('#lang','en'); await feedback(p,true,label+' France–Belgium EN');
      equal(await p.locator('#penalty').textContent(),'−1 points',label+': translation preserves penalty');
      await p.selectOption('#lang','fr');
      await tap('GBR',input,p); await feedback(p,false,label+' France–UK sea crossing');
      const seaKM=await originalDistance(p,'GBR','FRA');
      check(seaKM<250,label+': close sea crossing is not a neighbour');
      equal(await p.locator('#distance').textContent(),`${new Intl.NumberFormat('fr').format(seaKM)} km`,label+': original sea distance');
      const pointsAfterSea=core.penalise(19,seaKM);
      equal(await p.locator('#roundPoints').textContent(),`${pointsAfterSea} points`,label+': unchanged sea penalty');
      await tap('BRA',input,p); await feedback(p,true,label+' France–Brazil overseas');
      const pointsAfterBrazil=core.penalise(pointsAfterSea,await originalDistance(p,'BRA','FRA'));
      equal(await p.locator('#roundPoints').textContent(),`${pointsAfterBrazil} points`,label+': overseas label preserves original penalty');
      equal(await snapshot(p),{...saved,'wg-lang':'fr'},label+': wrong answers preserve saved progress');
      await tap('FRA-GF',input,p); await p.waitForTimeout(950);
      const fills=await p.locator('#map [data-iso="FRA"], #map [data-iso="FRA-GF"]').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fill));
      equal(fills,fills.map(()=>'rgb(74, 222, 128)'),label+': correct parent and territory stay green after neighbour feedback');
      equal(await p.locator('#totalScore').textContent(),`${pointsAfterBrazil} / 100`,label+': earned challenge score unchanged');
      await p.click('#next');equal(await p.locator('#map .country-found').count(),0,label+': green clears next round');

      // Country-level adjacency applies equally to region aliases and tiny markers.
      const cases=[
        ['BRA','FRA-GF',true],['CAN','USA-AK',true],['CAN','USA-HI',true],
        ['ITA','VAT',true],['FRA','MCO',true],['VAT','ITA',true],['MCO','FRA',true],
        ['IND','PAK',true],['RUS','UKR',true],['ISR','PSE',true],['AZE','ARM',true],
        ['DNK','CAN',true],['CYP','GBR',true],['NLD','FRA',true],
        ['MCO','ITA',false],['IND','LKA',false],['CYP','TUR',false],['MAR','MRT',false],
        ['SGP','MYS',false],['DNK','SWE',false],['BHR','SAU',false]
      ];
      for(const [target,guess,neighbour] of cases) {
        await openPractice(p,target);const before=await snapshot(p);
        if(['VAT','MCO'].includes(guess)) {
          await p.locator(`#map .microstate-marker[data-iso="${guess}"]`).evaluate((marker,type)=>{
            for(const event of ['pointerdown','pointerup']) marker.dispatchEvent(new PointerEvent(event,{bubbles:true,pointerId:7,pointerType:type,clientX:-1,clientY:-1,button:0}));
          },input);
        } else await tap(guess,input,p);
        await feedback(p,neighbour,`${label} ${target} / ${guess}`);
        check(!(await p.locator('#penalty').isVisible()),label+': practice has no penalty');
        equal(await snapshot(p),before,label+': practice wrong answer preserves saves');
        await p.selectOption('#lang','en');await feedback(p,neighbour,`${label} ${target} / ${guess} EN`);
        check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': neighbour feedback has no horizontal overflow');
      }

      // Deterministic Daily has Indonesia first, with real land neighbour Malaysia.
      const daily=await ctx.newPage();await daily.clock.setFixedTime(new Date('2026-10-08T12:00:00Z'));
      await daily.goto(url);await daily.selectOption('#lang','fr');await daily.click('#chooseDaily');
      await daily.locator('#playing').waitFor({state:'visible'});
      equal(await daily.locator('#countryName').textContent(),'Indonésie',label+': deterministic Daily');
      const dailyBefore=await snapshot(daily),dailyKM=await originalDistance(daily,'IDN','MYS');
      await tap('MYS',input,daily);await feedback(daily,true,label+' Daily Indonesia–Malaysia');
      equal(await daily.locator('#roundPoints').textContent(),`${core.penalise(20,dailyKM)} points`,label+': Daily penalty unchanged');
      equal(await snapshot(daily),dailyBefore,label+': Daily wrong answer preserves saves');
      await tap('IDN',input,daily);await daily.waitForTimeout(950);
      equal(await daily.locator('#map [data-iso="IDN"]').evaluate(el=>getComputedStyle(el).fill),'rgb(74, 222, 128)',label+': Daily still green');
      await daily.click('#next');equal(await daily.locator('#map .country-found').count(),0,label+': Daily next clears green');
    } finally {await ctx.close();}
  }
}
