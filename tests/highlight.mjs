// Behavioural checks use computed SVG colours, not only the presence of a class.
export async function testHighlight({newContext, url, core, tap, check, equal}) {
  const green = 'rgb(74, 222, 128)';
  const series = ['FRA','JPN','USA','GBR','NOR'];
  const snapshot = p => p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const shapes = (p, iso) => p.evaluate(iso => [...document.querySelectorAll(
    `#map [data-iso="${iso}"], #map [data-iso^="${iso}-"]`
  )].map(el => ({iso:el.dataset.iso, marker:el.classList.contains('microstate-marker'),
    fill:getComputedStyle(el).fill, animation:getComputedStyle(el).animationName})), iso);
  async function expectGreen(p, iso, label) {
    const actual = await shapes(p, iso);
    check(actual.length > 0, label + ': shapes exist');
    equal(actual.map(s => s.fill), actual.map(() => green), label + ': every shape stays green');
  }
  async function expectCleared(p, iso, baseline, label) {
    equal(await p.locator('#map .country-found, #map .country-correct').count(), 0, label + ': no success classes');
    // The existing marker fill transition may take 180 ms when returning to normal.
    await p.waitForFunction(({iso, colours}) => {
      const nodes = [...document.querySelectorAll(`#map [data-iso="${iso}"], #map [data-iso^="${iso}-"]`)];
      return nodes.length === colours.length && nodes.every((el, i) => getComputedStyle(el).fill === colours[i]);
    }, {iso, colours:baseline.map(s => s.fill)}, {timeout:2000});
    equal(await shapes(p, iso), baseline, label + ': original colours and animations restored');
  }
  async function currentISO(p) {
    return p.evaluate(() => GeoFactCountries.find(c => c.name[document.documentElement.lang] === document.getElementById('countryName').textContent).iso);
  }
  async function openChallenge(p, country) {
    const ordered = [country, ...series.filter(iso => iso !== country)].slice(0, 5);
    await p.goto(url + '?challenge=' + core.encodeChallenge('easy', ordered, 100));
    await p.click('#acceptChallenge');
  }
  async function gestures(p) {
    return p.evaluate(() => {
      const svg = document.getElementById('map'), ocean = svg.querySelector('.ocean');
      const rect = svg.getBoundingClientRect(), x = rect.left + rect.width / 3, y = rect.top + rect.height / 2;
      function dispatch(type, pointerId, clientX, clientY) {
        ocean.dispatchEvent(new PointerEvent(type, {bubbles:true, pointerId, pointerType:'touch', clientX, clientY, button:0}));
      }
      const beforePan = svg.getAttribute('viewBox');
      dispatch('pointerdown', 21, x, y); dispatch('pointermove', 21, x+35, y+25); dispatch('pointerup', 21, x+35, y+25);
      const afterPan = svg.getAttribute('viewBox');
      dispatch('pointerdown', 22, x, y); dispatch('pointerdown', 23, x+100, y);
      dispatch('pointermove', 22, x-20, y); dispatch('pointermove', 23, x+120, y);
      dispatch('pointerup', 23, x+120, y); dispatch('pointerup', 22, x-20, y);
      return {beforePan, afterPan, afterPinch:svg.getAttribute('viewBox')};
    });
  }
  async function interact(p, iso, label) {
    const saved = await snapshot(p), score = await p.locator('#totalScore').textContent();
    const originalLanguage = await p.locator('#lang').inputValue();
    const view = await p.locator('#map').getAttribute('viewBox');
    await p.click('#zoomIn');
    check(await p.locator('#map').getAttribute('viewBox') !== view, label + ': zoom works');
    await expectGreen(p, iso, label + ' after zoom');
    const moved = await gestures(p);
    check(moved.afterPan !== moved.beforePan, label + ': touch pan works');
    check(moved.afterPinch !== moved.afterPan, label + ': pinch works');
    await expectGreen(p, iso, label + ' after pan/pinch');
    await p.click('#resetMap');
    equal(await p.locator('#map').getAttribute('viewBox'), '0 0 1200 600', label + ': recentre works');
    await expectGreen(p, iso, label + ' after recentre');
    equal(await snapshot(p), saved, label + ': map gestures do not write saves');
    await p.selectOption('#lang', originalLanguage === 'fr' ? 'en' : 'fr');
    await expectGreen(p, iso, label + ' after translation');
    await p.selectOption('#lang', originalLanguage);
    await tap(iso === 'BEL' ? 'JPN' : 'BEL', 'touch', p);
    equal(await p.locator('#totalScore').textContent(), score, label + ': interactions preserve score');
    equal(await snapshot(p), {...saved, 'wg-lang':originalLanguage}, label + ': only language preference may be saved');
    await expectGreen(p, iso, label + ' after an ignored guess');
  }

  for (const mobile of [false, true]) for (const reduced of [false, true]) {
    const label = `${mobile ? 'mobile' : 'desktop'} / ${reduced ? 'reduced' : 'animated'}`;
    const ctx = await newContext({locale:'fr-FR', viewport:{width:mobile ? 390 : 1280, height:850}, hasTouch:mobile, isMobile:mobile});
    try {
      const p = await ctx.newPage();
      await p.emulateMedia({reducedMotion:reduced ? 'reduce' : 'no-preference'});
      for (const mode of ['classic','daily','practice']) {
        console.log(`  Highlight: ${label} ${mode}`);
        await p.goto(url);
        if (mode === 'classic') { await p.click('#chooseGame'); await p.click('[data-level="easy"]'); }
        if (mode === 'daily') await p.click('#chooseDaily');
        if (mode === 'practice') {
          await p.click('#choosePractice'); await p.click('#practiceCustom');
          await p.locator('#practiceCountryList input[value="TUV"]').check(); await p.click('#startCustomPractice');
        }
        await p.locator('#playing').waitFor({state:'visible'});
        const iso = await currentISO(p), baseline = await shapes(p, iso);
        await tap(iso, mobile ? 'touch' : 'mouse', p);
        check(await p.locator('#result').isVisible(), `${label} ${mode}: anecdote visible`);
        // Allow the SVG's first paint/style update, without waiting for a pulse.
        await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const immediate = await shapes(p, iso);
        if (reduced) {
          equal(immediate.map(s => s.animation), immediate.map(() => 'none'), `${label} ${mode}: no success animation`);
          await expectGreen(p, iso, `${label} ${mode} immediately`);
        } else {
          check(immediate.some(s => ['countryCorrectPulse','microMarkerCorrect'].includes(s.animation)), `${label} ${mode}: initial animation preserved`);
        }
        await p.waitForTimeout(950); // Real elapsed time past the 780 ms success pulse.
        await expectGreen(p, iso, `${label} ${mode} after animation`);
        equal(await p.locator('#map .country-correct').count(), 0, `${label} ${mode}: pulse ended`);
        if (mode === 'practice') equal((await shapes(p, iso)).length, 2, `${label}: microstate geometry and marker`);
        await interact(p, iso, `${label} ${mode}`);
        check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label} ${mode}: no overflow`);
        await p.click('#next');
        await expectCleared(p, iso, baseline, `${label} ${mode} next round`);
        // Leaving the party also clears an answer, including through the mobile home button.
        const nextISO = await currentISO(p);
        await tap(nextISO, 'touch', p);
        await p.click('#playing [data-home]');
        equal(await p.locator('#map .country-found, #map .country-correct').count(), 0, `${label} ${mode}: exit clears highlight`);
      }
    } finally { await ctx.close(); }
  }

  const ctx = await newContext({locale:'en-GB', viewport:{width:1280,height:850}});
  try {
    const p = await ctx.newPage();
    for (const [region, parent, expected] of [
      ['FRA-GF','FRA',['FRA','FRA-GF']],
      ['USA-AK','USA',['USA','USA-AK','USA-HI']],
      ['USA-HI','USA',['USA','USA-AK','USA-HI']]
    ]) {
      await openChallenge(p, parent);
      const baseline = await shapes(p, parent);
      await tap(region, 'mouse', p);
      await p.waitForTimeout(950);
      equal((await shapes(p, parent)).map(s => s.iso).sort(), expected.sort(), region + ': every territory included');
      await expectGreen(p, parent, region + ' after animation');
      await interact(p, parent, region);
      if (parent === 'FRA') {
        await p.locator('#map').scrollIntoViewIfNeeded();
        const centre = await p.evaluate(() => {
          const svg = document.getElementById('map'), point = svg.createSVGPoint();
          point.x = (2.5+180)/.3; point.y = (90-48)/.3;
          const screen = point.matrixTransform(svg.getScreenCTM()); return {x:screen.x,y:screen.y};
        });
        await p.mouse.move(centre.x, centre.y);
        check(await p.locator('#map [data-iso="FRA"]').evaluate(el => el.matches(':hover')), 'France truly hovered');
        await expectGreen(p, parent, 'France on hover');
      }
      await p.click('#next'); await expectCleared(p, parent, baseline, region + ' next round');
    }
    // Starting another round during a pulse must not leave old animation classes,
    // and an old timer must not remove a later answer on that same country.
    await p.goto(url); await p.click('#choosePractice'); await p.click('#practiceCustom');
    await p.locator('#practiceCountryList input[value="TUV"]').check(); await p.click('#startCustomPractice');
    const baseline = await shapes(p, 'TUV');
    await tap('TUV', 'touch', p);
    await p.locator('#next').evaluate(button => button.click());
    await expectCleared(p, 'TUV', baseline, 'next during animation');
    await tap('TUV', 'touch', p); await p.waitForTimeout(950);
    await expectGreen(p, 'TUV', 'same country answered again');
    await p.locator('#map .microstate-marker[data-iso="TUV"]').hover();
    await expectGreen(p, 'TUV', 'microstate marker on hover');
    await p.click('#brand'); await expectCleared(p, 'TUV', baseline, 'brand exits party');
    await openChallenge(p, 'FRA'); await tap('FRA', 'mouse', p);
    await p.locator('#playing [data-home]').evaluate(button => button.click());
    await p.waitForTimeout(950);
    equal(await p.locator('#map .country-found, #map .country-correct').count(), 0, 'exit during animation stays cleared');
  } finally { await ctx.close(); }
}
