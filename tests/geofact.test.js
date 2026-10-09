const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('../data/countries.js');
require('../data/facts.js');
require('../data/borders.js');
const core = require('../core.js');
const countries = GeoFactCountries, facts = GeoFactFacts;
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
const translations = fs.readFileSync(path.join(__dirname, '../i18n.js'), 'utf8');
const shapeTags = [...html.matchAll(/<(path|circle)\b[^>]*data-iso="([A-Z]{3})"[^>]*>/g)].map(m => ({ type: m[1], iso: m[2], tag: m[0] }));
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const contours = new Map(shapeTags.map(s => [s.iso, s.type === 'path' ? core.samplePath(attribute(s.tag, 'd')) : { vertices: new Set(), points: [core.spherePoint(+attribute(s.tag, 'cx'), +attribute(s.tag, 'cy'))] }]));
test('All 195 countries have one selectable geometry, bilingual names, capitals and matching facts', () => {
  assert.equal(countries.length, 195);
  assert.equal(new Set(countries.map(c => c.iso)).size, 195);
  assert.deepEqual(Object.keys(facts).sort(), countries.map(c => c.iso).sort());
  assert.deepEqual(shapeTags.map(s => s.iso).sort(), countries.map(c => c.iso).sort());
  for (const c of countries) {
    assert.match(c.iso, /^[A-Z]{3}$/); assert.match(c.a2, /^[A-Z]{2}$/);
    for (const lang of ['fr', 'en']) { assert.ok(c.name[lang].trim()); assert.ok(c.capital[lang].trim()); }
    assert.ok(['africa','americas','asia','europe','oceania'].includes(c.continent));
    for (const f of facts[c.iso]) for (const key of ['fr', 'en', 'emoji', 'category']) assert.ok(typeof f[key] === 'string' && f[key].trim());
  }
  assert.equal(Object.values(facts).flat().length, 201);
  assert.notDeepEqual(facts.COG, facts.COD);
  assert.deepEqual(Object.fromEntries(['africa','americas','asia','europe','oceania'].map(x => [x, countries.filter(c => c.continent === x).length])), {africa:54,americas:35,asia:48,europe:44,oceania:14});
});
test('Difficulty pools cover every country without duplicates and include confirmed historical choices', () => {
  assert.deepEqual(core.levels.map(level => countries.filter(c => c.difficulty === level).length), [50, 80, 65]);
  for (const iso of ['KAZ', 'KEN', 'MDG', 'NGA', 'PAK', 'PHL']) assert.equal(countries.find(c => c.iso === iso).difficulty, 'easy');
  for (const iso of ['SGP', 'PSE', 'PRK', 'PNG', 'VUT']) assert.equal(countries.find(c => c.iso === iso).difficulty, 'hard');
  for (const iso of ['AUT', 'BEL', 'HRV', 'CZE']) assert.equal(countries.find(c => c.iso === iso).difficulty, 'medium');
  for (const level of core.levels) { const series = core.shuffle(countries.filter(c => c.difficulty === level)).slice(0, 5); assert.equal(new Set(series.map(c => c.iso)).size, 5); }
});
test('Map preserves Norway as four real subpaths and 29 unobtrusive microstate markers', () => {
  assert.equal(shapeTags.filter(s => s.type === 'path').length, 166);
  assert.equal(shapeTags.filter(s => s.type === 'circle').length, 29);
  const norway = shapeTags.find(s => s.iso === 'NOR');
  assert.equal(norway.type, 'path'); assert.equal((attribute(norway.tag, 'd').match(/M/g) || []).length, 4);
  for (const s of shapeTags.filter(s => s.type === 'circle')) assert.equal(+attribute(s.tag, 'r'), .25);
  assert.ok(!html.includes('id="markers"'));
});
test('Score penalties use the compact 100-point scale with exact distance boundaries and floor', () => {
  for (const [distance, penalty] of [[10,1],[249,1],[250,2],[749,2],[750,3],[1999,3],[2000,4],[4999,4],[5000,5],[20000,5]]) assert.equal(core.penaltyFor(distance), penalty);
  let points=20; for(let i=0;i<20;i++) points=core.penalise(points,6000);
  assert.equal(points,2); assert.equal(core.penalise(2,10),2);
  assert.equal(core.ROUND_MAX,20); assert.equal(core.SCORE_MAX,100);
});
test('Territorial distances are symmetric, shared borders use 10 km and islands stay separated', () => {
  const distance=(a,b)=>core.territoryDistance(contours.get(a),contours.get(b));
  assert.equal(distance('FRA','BEL'),10); assert.equal(distance('BEL','FRA'),10);
  assert.equal(distance('FRA','BRA'),10);
  assert.ok(distance('GBR','FRA')>10 && distance('GBR','FRA')<100);
  assert.ok(distance('NZL','JPN')>5000);
  assert.equal(distance('JPN','NZL'),distance('NZL','JPN'));
});
test('Five-country challenge token round-trips in its original order', () => {
  const series=['FRA','JPN','USA','GBR','NOR'];
  const token=core.encodeChallenge('easy',series,74);
  assert.match(token,/^[A-Za-z0-9_-]+$/); assert.ok(!token.includes('='));
  assert.deepEqual(core.parseChallenge(token,countries),{v:3,d:'easy',c:series,s:74});
  for(const score of [10,100]) assert.equal(core.parseChallenge(core.encodeChallenge('easy',series,score),countries).s,score);
  const legacy = Buffer.from(JSON.stringify({v:1,d:'easy',c:series,s:3700})).toString('base64url');
  assert.equal(core.parseChallenge(legacy,countries).s,74);
});
test('Challenge result token round-trips and preserves both scores', () => {
  const series=['FRA','JPN','USA','GBR','NOR'];
  const token=core.encodeChallengeResult('easy',series,74,82);
  assert.match(token,/^[A-Za-z0-9_-]+$/); assert.ok(!token.includes('='));
  assert.deepEqual(core.parseChallenge(token,countries),{v:4,d:'easy',c:series,s:74,r:82});
  for(const score of [10,100]) assert.equal(core.parseChallenge(core.encodeChallengeResult('easy',series,74,score),countries).r,score);
});
test('Malformed, obsolete and incompatible challenge tokens are rejected', () => {
  const encode=p=>Buffer.from(JSON.stringify(p)).toString('base64url');
  const good={v:3,d:'easy',c:['FRA','JPN','USA','GBR','NOR'],s:74};
  const bad=[ {...good,v:5},{...good,d:'unknown'},{...good,c:['FRA','FRA','USA','GBR','NOR']},{...good,c:['FRA','JPN','USA','GBR']},{...good,c:['FRA','JPN','USA','GBR','XXX']},{...good,c:['FRA','JPN','USA','GBR','VAT']}, {...good,s:9},{...good,s:101},{...good,s:50.5},{...good,s:'74'} ];
  for(const payload of bad) assert.equal(core.parseChallenge(encode(payload),countries),null);
  for(const token of ['',null,'%%%','FRA-JPN-USA-GBR-NOR',Buffer.from('not json').toString('base64url'),'x'.repeat(513)]) assert.equal(core.parseChallenge(token,countries),null);
});
test('Fact cycles exhaust unseen facts and never immediately repeat at rollover', () => {
  const history={}; let last;
  for(let cycle=0;cycle<4;cycle++) {
    const selected=[];
    for(let i=0;i<3;i++) { const index=core.chooseFact('FRA',3,history,()=>0); if(i===0&&last!==undefined) assert.notEqual(index,last); selected.push(index); last=index; }
    assert.equal(new Set(selected).size,3);
  }
  const recovered=JSON.parse(JSON.stringify(history));
  assert.notEqual(core.chooseFact('FRA',3,recovered,()=>0),last);
  assert.equal(core.chooseFact('ITA',1,history),0);
});
test('Corrupt fact storage is cleaned without blocking the next round', () => {
  const history={FRA:{seen:[-1,99,0,0,'1'],last:99},ITA:{seen:'bad'}};
  assert.equal(core.chooseFact('FRA',3,history,()=>0),1);
  assert.equal(core.chooseFact('ITA',1,history),0);
});
test('Original branding PNGs and social metadata are present with local favicons', () => {
  const png=fs.readFileSync(path.join(__dirname,'../assets/geofact-og.png'));
  assert.equal(png.readUInt32BE(16),1200); assert.equal(png.readUInt32BE(20),630);
  assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'9cb57bb31fdbe2522870f187c85622304277883dfaaa5accb06a9030a7eadcf8');
  for(const key of ['og:type','og:site_name','og:title','og:description','og:image','og:url','og:image:alt']) assert.equal((html.match(new RegExp(`property="${key}"`,'g'))||[]).length,1);
  assert.ok(html.includes('href="assets/geofact-icon.svg"'));
});
test('Daily challenge is deterministic, balanced and changes with the UTC date', () => {
  const day1 = new Date('2026-10-07T00:05:00Z');
  const sameDay = new Date('2026-10-07T23:59:59Z');
  const day2 = new Date('2026-10-08T00:00:00Z');
  const a = core.dailySeries(countries, day1), b = core.dailySeries(countries, sameDay), c = core.dailySeries(countries, day2);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 5); assert.equal(new Set(a).size, 5);
  const levels = a.map(iso => countries.find(country => country.iso === iso).difficulty);
  assert.equal(levels.filter(level => level === 'easy').length, 2);
  assert.equal(levels.filter(level => level === 'medium').length, 2);
  assert.equal(levels.filter(level => level === 'hard').length, 1);
  assert.equal(core.utcDayKey(day1), '2026-10-07');
  assert.equal(core.dailyNumber(day1), 1); assert.equal(core.dailyNumber(day2), 2);
});
test('Daily result marks use GeoFact circles without revealing countries', () => {
  assert.equal(core.dailyTile(20), 'green'); assert.equal(core.dailyTile(18), 'green');
  assert.equal(core.dailyTile(17), 'yellow'); assert.equal(core.dailyTile(14), 'yellow');
  assert.equal(core.dailyTile(13), 'orange'); assert.equal(core.dailyTile(8), 'orange');
  assert.equal(core.dailyTile(7), 'red'); assert.equal(core.dailyTile(2), 'red');
  assert.equal(['green','yellow','orange','red'].map(core.dailyShareCircle).join(''), '🟢🟡🟠🔴');
});
test('Daily home has one primary daily action plus practice and friend challenge', () => {
  for (const id of ['chooseDaily','choosePractice','chooseGame','dailyCountdown','dailyStreak','dailyBestStreak','dailyPlayed','dailyHomeErrors','dailyFinalErrors']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('data-i18n="dailyDescription"'));
});

test('Daily UI includes mistake tracking and mobile-first circular performance marks', () => {
  assert.ok(app.includes("state.dailyErrors++"));
  assert.ok(app.includes("errors: state.dailyErrors"));
  assert.ok(css.includes('.daily-mark {'));
  assert.ok(css.includes('border-radius:50%'));
  assert.ok(css.includes('@media (max-width:600px)'));
  assert.ok(translations.includes("dailyErrors: 'erreurs'"));
  assert.ok(translations.includes("dailyErrors: 'mistakes'"));
});
test('Exploration collection is bilingual and keeps verified source metadata', () => {
  assert.ok(html.includes('value="continent"')); assert.ok(translations.includes("sortContinent: 'Continent'"));
  const cardsSource = fs.readFileSync(path.join(__dirname, '../data/flag-cards.js'), 'utf8');
  assert.ok(html.includes('id="dailyChest"'));
  assert.ok(html.includes('id="openChest"'));
  assert.ok(html.includes('id="openCollection"'));
  assert.ok(app.includes("if (state.mode === 'daily')"));
  assert.ok(app.includes('rewardsRepository.completeDaily(gameState.pendingDaily)'));
  assert.ok(app.includes('rewardsRepository.answer(command,Object.keys(flagCards))'));
  assert.ok(!app.includes("storage.write('gf-collection-v1'"));
  assert.ok(!app.includes("storage.write('gf-daily-v1'"));
  for (const rarity of ['classic','silver','gold','shiny']) assert.ok(app.includes(rarity));
  for (const key of ['collectionCount','chestReady','openChest','newCard']) assert.ok(translations.includes(key));
  assert.ok(cardsSource.includes('source:'));
  assert.ok((cardsSource.match(/source:/g)||[]).length >= 8);
});

test('Land borders are canonical, unique, sourced, symmetric and restricted to the country roster', () => {
  const data = GeoFactLandBorders, known = new Set(countries.map(c => c.iso)), pairs = new Set();
  for (const [a,b] of data.pairs) {
    assert.ok(known.has(a) && known.has(b)); assert.ok(a < b); assert.ok(!pairs.has(a+'-'+b)); pairs.add(a+'-'+b);
    assert.equal(core.areLandNeighbours(a,b),true); assert.equal(core.areLandNeighbours(b,a),true);
  }
  for (const c of countries) {
    assert.equal(core.areLandNeighbours(c.iso,c.iso),false);
    for (const neighbour of data.neighbours[c.iso] || []) assert.ok(pairs.has([c.iso,neighbour].sort().join('-')));
  }
  assert.match(data.baseSource.commit,/^[a-f0-9]{40}$/); assert.match(data.baseSource.sha256,/^[a-f0-9]{64}$/);
  assert.equal(data.baseSource.license,'ODbL-1.0'); assert.ok(Object.isFrozen(data.neighbours));
  for (const source of data.overseasSources) { assert.ok(pairs.has(source.pair.join('-'))); assert.match(source.url,/^https:\/\//); }
});
test('Land neighbours include overseas borders, microstates, enclaves and separated territories', () => {
  for (const [a,b] of [['FRA','BEL'],['FRA','BRA'],['FRA','SUR'],['FRA','NLD'],['USA','CAN'],['USA-AK','CAN'],['FRA-GF','BRA'],['VAT','ITA'],['MCO','FRA'],['LSO','ZAF'],['SMR','ITA'],['CAN','DNK'],['CYP','GBR'],['ESP','GBR'],['ESP','MAR'],['RUS','POL'],['RUS','LTU'],['TUR','AZE'],['BWA','ZMB'],['NAM','ZMB']]) {
    assert.equal(core.areLandNeighbours(a,b),true,a+' / '+b); assert.equal(core.areLandNeighbours(b,a),true,b+' / '+a);
  }
  assert.equal(core.areLandNeighbours('USA-HI','CAN'),true,'country-level adjacency also applies to Hawaii');
  for (const [region,parent] of Object.entries(GeoFactLandBorders.territoryParents)) {
    assert.equal(core.areLandNeighbours(region,parent),false);
    for (const c of countries) assert.equal(core.areLandNeighbours(region,c.iso),core.areLandNeighbours(parent,c.iso));
  }
});
test('Sea crossings and claims alone do not create land neighbours', () => {
  for (const [a,b] of [['FRA','GBR'],['DNK','SWE'],['SGP','MYS'],['BHR','SAU'],['IND','LKA'],['USA','CUB'],['MCO','ITA'],['NAM','ZWE'],['MAR','MRT'],['SRB','ALB'],['IND','AFG'],['CYP','TUR']]) {
    assert.equal(core.areLandNeighbours(a,b),false,a+' / '+b); assert.equal(core.areLandNeighbours(b,a),false,b+' / '+a);
  }
  for (const value of [null,undefined,{},'constructor','__proto__','XXX','USA-XX','ESH','UNK']) assert.equal(core.areLandNeighbours(value,'FRA'),false);
});
test('Documented disputed land interfaces remain neighbours without changing the distance penalty', () => {
  for (const [a,b] of [['IND','PAK'],['IND','CHN'],['PAK','CHN'],['ISR','PSE'],['PSE','EGY'],['PSE','JOR'],['RUS','UKR'],['RUS','GEO'],['ARM','AZE']]) {
    assert.equal(core.areLandNeighbours(a,b),true,a+' / '+b); assert.equal(core.areLandNeighbours(b,a),true,b+' / '+a);
  }
  const originalDistance=core.territoryDistance(contours.get('FRA'),contours.get('BEL'));
  assert.equal(originalDistance,10); assert.equal(core.penalise(20,originalDistance),19);
});
