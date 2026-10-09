(function () {
  'use strict';
  const countries = GeoFactCountries, facts = GeoFactFacts, core = GeoFactCore, flagCards = GeoFactFlagCards;
  const byISO = new Map(countries.map(c => [c.iso, c]));
  const $ = id => document.getElementById(id);
  const storage = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Playing also works when browser storage is disabled. */ } }
  };
  // Public statistics are optional: network failures never interrupt gameplay.
  const STATS_URL = 'https://wpxaliifkzyhjsucavbr.supabase.co/rest/v1/rpc/';
  const STATS_KEY = 'sb_publishable_mJwCClCpxIUXqPCqOnfa_A_a5ZlOlqH';
  const statsHeaders = { 'apikey': STATS_KEY, 'Content-Type': 'application/json' };
  let anonymousVisitor = storage.read('gf-anonymous-visitor-v1', null);
  if (typeof anonymousVisitor !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(anonymousVisitor)) {
    anonymousVisitor = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : null;
    if (anonymousVisitor) storage.write('gf-anonymous-visitor-v1', anonymousVisitor);
  }
  function recordEvent(type) {
    if (!anonymousVisitor) return;
    fetch(STATS_URL + 'geofact_record_event', {
      method: 'POST', headers: statsHeaders,
      body: JSON.stringify({ p_visitor_id: anonymousVisitor, p_event_type: type }),
      keepalive: true
    }).catch(() => { /* Telemetry is non-essential. */ });
  }
  async function loadPublicStats() {
    $('statsStatus').textContent = t('statsLoading');
    try {
      const response = await fetch(STATS_URL + 'geofact_stats', {
        method: 'POST', headers: statsHeaders,
        body: JSON.stringify({ period_days: Number($('statsPeriod').value) })
      });
      if (!response.ok) throw new Error('Stats request failed');
      const data = await response.json();
      if (!Array.isArray(data) || !data[0]) throw new Error('Invalid stats response');
      const fields = { statVisitors: 'visitors', statPlayers: 'players', statDailyStarted: 'daily_started', statDailyCompleted: 'daily_completed', statChests: 'chests_opened', statChallenges: 'challenges_completed' };
      for (const [id, key] of Object.entries(fields)) $(id).textContent = format(Number(data[0][key] || 0));
      $('statsStatus').textContent = '';
    } catch {
      $('statsStatus').textContent = t('statsUnavailable');
    }
  }
  let savedLang;
  try { savedLang = localStorage.getItem('wg-lang'); } catch { /* Private or restricted file storage. */ }
  let lang = ['fr', 'en'].includes(savedLang) ? savedLang : navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  const seen = storage.read('wg-seen-facts', {});
  const validHistory = seen && typeof seen === 'object' && !Array.isArray(seen) ? seen : {};
  const oldStats = storage.read('wg-stats', {});
  const stats = { solved: 0, totalClicks: 0, oneClick: 0 };
  for (const key of Object.keys(stats)) if (Number.isSafeInteger(oldStats?.[key]) && oldStats[key] >= 0) stats[key] = oldStats[key];
  const sessionStats = { solved: 0, totalClicks: 0, oneClick: 0 };
  const bestScores = storage.read('gf-best-scores', {});
  // One-time transparent migration from the historical 5,000-point scale to 100.
  for (const key of Object.keys(bestScores)) if (Number.isSafeInteger(bestScores[key]) && bestScores[key] > core.SCORE_MAX) bestScores[key] = Math.round(bestScores[key] / 50);
  let dailyData = {days:{},played:0,streak:0,bestStreak:0}, collection = null;
  const rarityRank = { classic: 0, silver: 1, gold: 2, shiny: 3 };
  const rarities = ['classic', 'silver', 'gold', 'shiny'];
  let rewardsRepository, rewardsLoading = true, rewardError = null, legacyWarning = false;
  let nextBusy = false, rewardModules, bonusRules, bonusSnapshot = null;
  let practiceSaving = false, practiceBlocked = false, pendingPracticeUnreadable = false, pendingPractice = [], latestBonus = null;
  const PRACTICE_PENDING_KEY = 'gf-pending-practice-v1';
  try {
    const raw = sessionStorage.getItem(PRACTICE_PENDING_KEY);
    if (raw !== null) {
      const commands = JSON.parse(raw);
      if (!Array.isArray(commands) || commands.some(c => !c || c.mode !== 'practice')) throw new Error('Invalid pending answers');
      pendingPractice = commands;
    }
  } catch { practiceBlocked = true; pendingPracticeUnreadable = true; }
  let rewardChannel = null, rewardRevision = -1;
  try { if (typeof BroadcastChannel === 'function') rewardChannel = new BroadcastChannel('geofact-rewards'); } catch { /* Focus/navigation still refresh the canonical state. */ }
  function applyRewardSnapshot(snapshot) {
    if (snapshot.revision < rewardRevision) return;
    rewardRevision = snapshot.revision;
    bonusSnapshot = snapshot.bonus;
    collection = snapshot.collection;
    dailyData = structuredClone(snapshot.daily);
    // Display historical 5,000-point results using the existing conversion, without rewriting them.
    for (const result of Object.values(dailyData.days)) if(result.score > core.SCORE_MAX) result.score = Math.round(result.score / 50);
  }
  async function initializeRewards() {
    rewardsLoading = true; rewardError = null; render();
    try {
      rewardModules ||= Promise.all([import('./reward-repository.mjs'), import('./daily-rewards.mjs'), import('./bonus-rules.mjs')]);
      const [repositoryModule,,rules] = await rewardModules; bonusRules = rules;
      rewardsRepository?.close(); rewardsRepository = await repositoryModule.openRewardRepository();
      let snapshot = await rewardsRepository.read();
      if (!snapshot.dailyActive) { await rewardsRepository.activateDaily(localStorage); snapshot = await rewardsRepository.read(); }
      applyRewardSnapshot(snapshot);
      try {
        legacyWarning = Object.entries(snapshot.legacyImport.raw).some(([key,value]) => localStorage.getItem(key) !== value);
      } catch { /* IndexedDB remains authoritative after a completed migration. */ }
    } catch (error) { rewardError = ['INVALID_LEGACY_SAVES','LEGACY_SOURCE_CHANGED','IMPORT_TARGET_NOT_EMPTY'].includes(error.code) ? 'rewardImportFailed' : 'rewardUnavailable'; }
    finally { rewardsLoading = false; if (practiceBlocked) rewardError = pendingPracticeUnreadable ? 'bonusRecoveryFailed' : 'bonusSaveFailed'; render(); }
  }
  async function refreshRewards() {
    if (!rewardsRepository || rewardsLoading || rewardError) return;
    try { applyRewardSnapshot(await rewardsRepository.read()); render(); }
    catch { rewardError = 'rewardUnavailable'; render(); }
  }
  rewardChannel?.addEventListener('message', refreshRewards);
  window.addEventListener('focus', refreshRewards);
  window.addEventListener('storage', event => {
    if (['gf-collection-v1','gf-daily-v1'].includes(event.key)) { legacyWarning = true; render(); }
  });
  function preservePracticeQueue() {
    try {
      if (pendingPractice.length) sessionStorage.setItem(PRACTICE_PENDING_KEY, JSON.stringify(pendingPractice));
      else sessionStorage.removeItem(PRACTICE_PENDING_KEY);
    } catch { /* On write failure, the recovery message requires keeping this tab open. */ }
  }
  function queuePracticeAnswer(correct) {
    const command = {id:'answer:'+state.practiceRoundId+':'+state.attempts,roundId:state.practiceRoundId,
      mode:'practice',correct,at:Date.now(),countryDraw:randomUnit(),rarityDraw:randomUnit()};
    pendingPractice.push(command); preservePracticeQueue();
    savePracticeAnswers();
  }
  async function savePracticeAnswers() {
    if (practiceSaving || !pendingPractice.length) return;
    practiceSaving = true;
    try {
      if (!rewardsRepository || rewardsLoading || rewardError) throw new Error('Reward storage unavailable');
      while (pendingPractice.length) {
        const command = pendingPractice[0];
        const outcome = await rewardsRepository.answer(command,Object.keys(flagCards));
        applyRewardSnapshot(await rewardsRepository.read());
        if (outcome.chest) latestBonus = outcome.chest.id;
        pendingPractice.shift(); preservePracticeQueue();
        rewardChannel?.postMessage('changed');
      }
      practiceBlocked = false; rewardError = null;
    } catch { practiceBlocked = true; rewardError = 'bonusSaveFailed'; }
    finally { practiceSaving = false; render(); }
  }
  function renderBonusRewards() {
    const info = bonusSnapshot && bonusRules ? bonusRules.bonusProgress(bonusSnapshot,Date.now()) : null;
    const resetPending = pendingPractice.some(c=>!c.correct);
    const progress = info ? `${resetPending?0:info.progress}/${info.target}` : '—/10';
    const detail = info ? t(info.paused?'bonusPaused':'bonusQuota',{count:info.obtained,limit:info.limit}) : t('rewardLoading');
    for (const id of ['practiceBonusProgress','homeBonusProgress']) $(id).textContent = `${t('bonusProgress')} ${progress} · ${detail}${pendingPractice.length?' · '+t('bonusSaving'):''}`;
    $('practiceBonus').classList.toggle('hidden',state.mode!=='practice'||state.screen!=='playing');
    const available = Object.values(bonusSnapshot?.chests||{}).filter(c=>c.openedAt===null).sort((a,b)=>a.earnedAt-b.earnedAt||a.id.localeCompare(b.id));
    for (const id of ['openBonusRewards','openPracticeBonusRewards','collectionBonusRewards']) {
      $(id).textContent=t('bonusAvailable',{count:available.length}); $(id).classList.toggle('hidden',!available.length);
    }
    $('practiceChestNotice').textContent=latestBonus&&bonusSnapshot?.chests[latestBonus]?.openedAt===null?t('bonusEarned'):'';
    if (!$('bonusDialog').open) return;
    const list=$('bonusChestList'); list.replaceChildren();
    if (!available.length) {const note=document.createElement('p');note.textContent=t('bonusEmpty');list.appendChild(note);}
    for(const chest of available) {
      const button=document.createElement('button');button.className='secondary';button.type='button';button.dataset.chestId=chest.id;
      button.textContent=t('bonusChestDate',{date:chest.earnedDay});button.disabled=$('openBonusChest').classList.contains('opening');
      button.addEventListener('click',()=>{selectedBonus=chest.id;renderBonusRewards();});list.appendChild(button);
    }
    if ($('openBonusChest').classList.contains('opening')) return;
    const chest=bonusSnapshot?.chests[selectedBonus];
    $('bonusChestStage').classList.toggle('hidden',!chest||chest.openedAt!==null);
    $('bonusCardReveal').classList.toggle('hidden',!chest||chest.openedAt===null);
    if(chest&&chest.openedAt!==null) revealBonusCard(chest);
  }
  let selectedBonus = null;
  function revealBonusCard(chest) {
    justUnlockedCard = false;
    const card = cardElement(chest.card.iso,chest.card.rarity,true);
    $('bonusCardReveal').replaceChildren(card);$('bonusCardReveal').classList.remove('hidden');$('bonusChestStage').classList.add('hidden');
  }
  async function openBonusRewards() {
    await refreshRewards();
    selectedBonus = Object.values(bonusSnapshot?.chests||{}).find(c=>c.openedAt===null)?.id||null;
    if (!$('bonusDialog').open) $('bonusDialog').showModal();renderBonusRewards();
  }
  function cardCopies(iso, rarity) { const n = collection?.[iso]?.counts?.[rarity]; return Number.isSafeInteger(n) && n > 0 ? n : (ownedRarities(iso).includes(rarity) ? 1 : 0); }
  function ownedRarities(iso) { return Array.isArray(collection?.[iso]?.rarities) ? collection?.[iso].rarities : []; }
  function bestRarity(iso) { return ownedRarities(iso).reduce((best, r) => best == null || rarityRank[r] > rarityRank[best] ? r : best, null); }
  function acquiredAt(iso, rarity) {
    const times = collection?.[iso]?.acquiredAt;
    if (times && Number.isFinite(times[rarity])) return times[rarity];
    return collection?.[iso]?.firstUnlocked ? Date.parse(collection?.[iso].firstUnlocked) || 0 : 0;
  }
  let justUnlockedCard = false;
  let finalWasRecord = false;
  let renderedDailyKey = core.utcDayKey();
  function blankState() {
    return { screen: 'home', mode: null, difficulty: 'easy', series: [], queue: [], index: 0, current: null,
      answered: false, attempts: 0, points: core.ROUND_MAX, score: 0, streak: 0, factIndex: null, wrong: null, wrongGuesses: [], challenge: null, dailyTiles: [], dailyErrors: 0, practicePool: [] };
  }
  let state = blankState();
  const t = (key, values = {}) => (GeoFactTranslations[lang][key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  const format = n => n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB');
  const flag = c => [...c.a2].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
  const map = GeoFactMap($('map'), guess);
  const autoScrollGameplay = () => matchMedia('(pointer: coarse), (max-width: 699px)').matches || matchMedia('(pointer: fine) and (min-width: 700px)').matches;
  function scrollToElement(element, block = 'start') {
    if (!autoScrollGameplay() || !element) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block });
  }
  function celebrateCorrect(iso) {
    map.celebrate(state.current.iso, iso);
    const wrap = $('map').closest('.map-wrap');
    const check = document.createElement('div');
    check.className = 'correct-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true');
    wrap.appendChild(check);
    setTimeout(() => check.remove(), 850);
    $('result').classList.remove('result-reveal');
    requestAnimationFrame(() => $('result').classList.add('result-reveal'));
    setTimeout(() => scrollToElement($('result'), 'start'), 430);
  }
  const boundaries = new Map();
  const territoryShapes = new Map();
  const overseas = {
    'FRA-GF': { parent: 'FRA', name: { fr: 'Guyane française', en: 'French Guiana' }, capital: { fr: 'Cayenne', en: 'Cayenne' } },
    'USA-AK': { parent: 'USA', name: { fr: 'Alaska (États-Unis)', en: 'Alaska (United States)' }, capital: { fr: 'Juneau', en: 'Juneau' } },
    'USA-HI': { parent: 'USA', name: { fr: 'Hawaï (États-Unis)', en: 'Hawaii (United States)' }, capital: { fr: 'Honolulu', en: 'Honolulu' } }
  };
  for (const el of $('map').querySelectorAll('path.country-shape[data-iso], circle.microstate[data-iso]')) {
    const shape = el.tagName.toLowerCase() === 'path' ? core.samplePath(el.getAttribute('d')) : {
      points: [core.spherePoint(+el.getAttribute('cx'), +el.getAttribute('cy'))], vertices: new Set()
    };
    boundaries.set(el.dataset.iso, shape);
  }
  // The map module splits distant regions into independent SVG paths before this geometry is read.
  for (const iso of Object.keys(overseas)) {
    if (boundaries.has(iso)) territoryShapes.set(iso, boundaries.get(iso));
  }
  const distanceCache = new Map();
  function distance(a, b) {
    const key = [a, b].sort().join('-');
    if (!distanceCache.has(key)) distanceCache.set(key, core.territoryDistance(territoryShapes.get(a) || boundaries.get(a), territoryShapes.get(b) || boundaries.get(b)));
    return distanceCache.get(key);
  }
  function todayDaily() {
    const now = new Date(), key = core.utcDayKey(now);
    return { key, number: core.dailyNumber(now), series: core.dailySeries(countries, now), result: dailyData.days[key] || null };
  }
  function activeDailyStreak() {
    if (!dailyData.lastDate) return 0;
    const today = core.utcDayKey(), yesterday = core.utcDayKey(new Date(Date.now() - 86400000));
    return dailyData.lastDate === today || dailyData.lastDate === yesterday ? dailyData.streak : 0;
  }
  function updateCountdown() {
    const el = $('dailyCountdown'); if (!el) return;
    const now = new Date(), next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    let seconds = Math.max(0, Math.floor((next - now.getTime()) / 1000));
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0'); seconds %= 3600;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0'), sec = String(seconds % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${sec}`;
  }
  function normalizeDailyMark(mark) { return ({ '🟩': 'green', '🟨': 'yellow', '🟧': 'orange', '🟥': 'red' })[mark] || mark; }
  function renderDailyMarks(element, marks) {
    element.replaceChildren();
    for (const raw of marks || []) {
      const mark = normalizeDailyMark(raw);
      const dot = document.createElement('span');
      dot.className = `daily-mark daily-mark-${mark}`;
      dot.setAttribute('aria-hidden', 'true');
      element.appendChild(dot);
    }
  }
  function dailyErrorsText(errors) { return `${format(errors)} ${t(errors === 1 ? 'dailyError' : 'dailyErrors')}`; }
  function renderDailyHome() {
    const daily = todayDaily();
    $('dailyNumber').textContent = `#${daily.number}`;
    $('dailyStreak').textContent = format(activeDailyStreak());
    $('dailyBestStreak').textContent = format(dailyData.bestStreak);
    $('dailyPlayed').textContent = format(dailyData.played);
    $('dailyCompleted').classList.toggle('hidden', !daily.result);
    $('chooseDaily').textContent = t(daily.result ? 'dailyView' : 'dailyPlay');
    if (daily.result) {
      $('dailyHomeScore').textContent = `${format(daily.result.score)} / ${format(core.SCORE_MAX)}`;
      renderDailyMarks($('dailyHomeTiles'), daily.result.tiles);
      $('dailyHomeErrors').textContent = Number.isSafeInteger(daily.result.errors) ? dailyErrorsText(daily.result.errors) : '';
    }
    const oldPending = Object.entries(dailyData.days).filter(([key,r]) => key !== daily.key && r.card && !r.cardOpened).sort(([a],[b])=>a.localeCompare(b))[0];
    $('resumeDailyChest').classList.toggle('hidden', !oldPending);
    if(oldPending) { $('resumeDailyChest').dataset.day = oldPending[0]; $('resumeDailyChest').textContent = t('resumeDailyChest',{date:oldPending[0]}); }
    updateCountdown();
  }
  function cardFlag(iso) { return flag(byISO.get(iso)); }
  function rarityLabel(rarity) { return ({ classic: 'Classic', silver: 'Silver', gold: 'Gold', shiny: 'Shiny' })[rarity] || rarity; }
  function randomUnit() {
    try {
      if (globalThis.crypto?.getRandomValues) {
        const value = new Uint32Array(1);
        globalThis.crypto.getRandomValues(value);
        return value[0] / 4294967296;
      }
    } catch { /* Fall back for restricted local-file contexts. */ }
    return Math.random();
  }
  async function awardDailyCard(score) {
    const [,rules] = await rewardModules;
    const pool = Object.keys(flagCards);
    return {iso:pool[Math.floor(randomUnit()*pool.length)],rarity:rules.rollDailyRarity(score,randomUnit())};
  }
  function selectedDailyResult() { return dailyData.days[state.dailyKey] || null; }
  function cardElement(iso, rarity, detailed = false) {
    const c = byISO.get(iso), data = flagCards[iso], article = document.createElement('article');
    article.className = `flag-card ${rarity}`;
    const copies = cardCopies(iso, rarity);
    article.innerHTML = `${copies > 1 ? `<span class="copy-count" aria-label="${copies} copies">×${copies}</span>` : ''}<span class="rarity">${rarityLabel(rarity)}</span><div class="card-flag" aria-hidden="true">${cardFlag(iso)}</div><h3></h3><p></p>`;
    article.querySelector('h3').textContent = c.name[lang];
    article.querySelector('p').textContent = data[lang];
    if (detailed) { const note = document.createElement('div'); note.className = 'new-card-note'; note.textContent = justUnlockedCard ? t('newCard') : t('collectionSaved'); article.appendChild(note); }
    return article;
  }
  function attachCardMotion(card) {
    let pressed = false;
    const update = e => {
      if (e.pointerType === 'touch' && !pressed) return;
      const r=card.getBoundingClientRect(), x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)), y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
      card.style.setProperty('--ry', `${(x-.5)*18}deg`); card.style.setProperty('--rx', `${(.5-y)*18}deg`); card.style.setProperty('--mx', `${x*100}%`); card.style.setProperty('--my', `${y*100}%`);
      card.classList.add('is-moving');
    };
    const reset=()=>{ pressed=false; card.classList.remove('is-moving'); card.style.setProperty('--rx','0deg'); card.style.setProperty('--ry','0deg'); };
    card.addEventListener('pointerdown',e=>{ pressed=true; card.setPointerCapture?.(e.pointerId); update(e); });
    card.addEventListener('pointermove',update); card.addEventListener('pointerup',reset); card.addEventListener('pointercancel',reset); card.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch') reset();});
  }
  function openCardModal(iso, rarity) {
    const modal = $('cardModal'), content = $('cardModalContent');
    if (!modal || !content || !flagCards[iso] || !ownedRarities(iso).includes(rarity)) return;
    const card = cardElement(iso, rarity); card.classList.add('tcg-interactive'); content.replaceChildren(card); attachCardMotion(card);
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }
  function closeCardModal() {
    $('cardModal')?.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }
  function renderCollectionDetail(iso) {
    const detail = $('collectionDetail');
    if (!detail || !flagCards[iso]) return;
    const c = byISO.get(iso), owned = ownedRarities(iso);
    detail.dataset.iso = iso;
    detail.replaceChildren();
    const head = document.createElement('div'); head.className = 'collection-detail-head';
    const title = document.createElement('div'); title.innerHTML = `<span>${cardFlag(iso)}</span><div><small>${t('collectionVariants')}</small><h2></h2></div>`; title.querySelector('h2').textContent = c.name[lang];
    const close = document.createElement('button'); close.className='text-button'; close.textContent=t('closeDetails'); close.addEventListener('click',()=>detail.classList.add('hidden'));
    head.append(title, close); detail.appendChild(head);
    const variants=document.createElement('div'); variants.className='rarity-variants';
    for (const rarity of rarities) {
      if (owned.includes(rarity)) { const card=cardElement(iso, rarity); card.classList.add('zoomable-card'); card.tabIndex=0; card.setAttribute('role','button'); const zoom=()=>openCardModal(iso, rarity); card.addEventListener('click',zoom); card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();zoom();}}); variants.appendChild(card); }
      else { const locked=document.createElement('article'); locked.className=`flag-card mini ${rarity} locked-variant`; locked.innerHTML=`<span class="rarity">${rarityLabel(rarity)}</span><div class="card-flag" aria-hidden="true">?</div>`; variants.appendChild(locked); }
    }
    detail.appendChild(variants); detail.classList.remove('hidden'); detail.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth', block:'nearest'});
  }
  function renderCollection() {
    const grid = $('collectionGrid'); if (!grid) return; grid.replaceChildren();
    if (collection === null) { $('collectionCount').textContent = t(rewardsLoading ? 'rewardLoading' : 'collectionUnavailable'); return; }
    const unlocked = Object.keys(collection).filter(iso => flagCards[iso] && ownedRarities(iso).length);
    const cardCount = unlocked.reduce((sum, iso) => sum + ownedRarities(iso).length, 0);
    $('collectionCount').textContent = t('collectionCount', { count: format(cardCount), total: format(countries.length * rarities.length) });
    const mode = $('collectionSort')?.value || 'alpha';
    const continentOrder = ['africa', 'americas', 'asia', 'europe', 'oceania'];
    const order = Object.keys(flagCards).sort((a,b) => {
      if (mode === 'rarity') return (rarityRank[bestRarity(b)] ?? -1) - (rarityRank[bestRarity(a)] ?? -1) || byISO.get(a).name[lang].localeCompare(byISO.get(b).name[lang], lang);
      if (mode === 'date') { const ad=Math.max(0,...ownedRarities(a).map(r=>acquiredAt(a,r))), bd=Math.max(0,...ownedRarities(b).map(r=>acquiredAt(b,r))); return bd-ad || byISO.get(a).name[lang].localeCompare(byISO.get(b).name[lang], lang); }
      if (mode === 'continent') return continentOrder.indexOf(byISO.get(a).continent) - continentOrder.indexOf(byISO.get(b).continent) || byISO.get(a).name[lang].localeCompare(byISO.get(b).name[lang], lang);
      return byISO.get(a).name[lang].localeCompare(byISO.get(b).name[lang], lang);
    });
    let currentContinent = '';
    for (const iso of order) {
      if (mode === 'continent' && byISO.get(iso).continent !== currentContinent) {
        currentContinent = byISO.get(iso).continent;
        const heading = document.createElement('h2'); heading.className = 'continent-heading'; heading.textContent = t('continent' + currentContinent[0].toUpperCase() + currentContinent.slice(1)); grid.appendChild(heading);
      }
      const best = bestRarity(iso);
      if (best) { const el=cardElement(iso, best); el.classList.add('collection-card'); el.tabIndex=0; el.setAttribute('role','button'); const open=()=>renderCollectionDetail(iso); el.addEventListener('click',open); el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}}); grid.appendChild(el); }
      else { const locked=document.createElement('article'); locked.className='flag-card locked'; locked.innerHTML='<div class="card-flag" aria-hidden="true">?</div><p></p>'; locked.querySelector('p').textContent=t('lockedCard'); grid.appendChild(locked); }
    }
  }
  function revealDailyCard(result) {
    if (!result.card) return;
    justUnlockedCard = !!result.card.upgraded;
    const reveal = $('cardReveal'); reveal.dataset.rarity = result.card.rarity; const revealedCard=cardElement(result.card.iso, result.card.rarity, true); revealedCard.classList.add('zoomable-card'); revealedCard.tabIndex=0; revealedCard.setAttribute('role','button'); revealedCard.addEventListener('click',()=>openCardModal(result.card.iso,result.card.rarity)); reveal.replaceChildren(revealedCard); const collectionButton=document.createElement('button'); collectionButton.className='secondary reveal-collection'; collectionButton.textContent=t('openCollectionNow'); collectionButton.addEventListener('click',()=>{ state=blankState(); state.screen='collection'; render(); }); reveal.appendChild(collectionButton); reveal.classList.remove('hidden');
    $('dailyChest').classList.add('hidden');
  }
  function renderRewardStatus() {
    $('chooseDaily').disabled = rewardsLoading;
    const message = rewardError || (rewardsLoading ? 'rewardLoading' : legacyWarning ? 'legacyRewardWarning' : null);
    $('rewardStatus').textContent = message ? t(message) : '';
    $('rewardStatus').classList.toggle('hidden', !message);
    $('retryRewards').classList.toggle('hidden', !rewardError);
    $('retryRewards').textContent = t('rewardRetry');
    $('retryRewards').disabled = nextBusy || rewardsLoading || practiceSaving;
    $('next').disabled = nextBusy || (state.mode === 'practice' && practiceBlocked);
    $('bonusRewardStatus').textContent = message ? t(message) : '';
    $('retryBonusRewards').classList.toggle('hidden', !rewardError);
    $('retryBonusRewards').textContent = t('rewardRetry');
    $('retryBonusRewards').disabled = nextBusy || rewardsLoading || practiceSaving;
  }
  function render() {
    if (state.screen !== 'playing' || !state.answered) map.clearFound();
    document.documentElement.lang = lang;
    $('lang').value = lang;
    const arcText=$('heroArcText'), arcEnd=$('heroArcEnd'), arcCopy=document.querySelector('.hero-arc-copy'); if(arcText) arcText.textContent=t('homeTitleArc'); if(arcEnd) arcEnd.textContent=t('homeTitleEnd'); if(arcCopy) arcCopy.setAttribute('aria-label',t('homeTitle'));
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)); });
    for (const id of ['home', 'publicStats', 'collection', 'practiceSetup', 'difficulty', 'challengeIntro', 'playing', 'final']) $(id).classList.toggle('hidden', id !== state.screen);
    $('modeTitle').textContent = state.mode === 'practice' ? t('practice') : t('game');
    renderDailyHome();
    renderRewardStatus();
    renderBonusRewards();
    if (collection === null) for (const id of ['dailyStreak','dailyBestStreak','dailyPlayed']) $(id).textContent = '—';
    renderCollection();
    $('mapHint').textContent = t(matchMedia('(pointer: coarse)').matches ? 'mapHint' : 'mapHintDesktop');
    const game = state.mode === 'game' || state.mode === 'daily';
    $('roundLabel').classList.toggle('hidden', !game);
    $('totalScore').classList.toggle('hidden', !game);
    $('roundPoints').classList.toggle('hidden', !game);
    $('penalty').classList.toggle('hidden', !game);
    $('roundEarned').classList.toggle('hidden', !game);
    $('streak').textContent = `${t('streak')} : ${state.streak}`;
    $('roundLabel').textContent = `${state.index + 1} / 5`;
    const progress = $('roundProgress');
    progress.innerHTML = '';
    if (game) for (let i = 0; i < 5; i++) { const dot = document.createElement('span'); dot.className = `round-progress-dot ${i < state.index ? 'done' : i === state.index ? 'current' : ''}`; progress.appendChild(dot); }
    progress.classList.toggle('hidden', !game);
    $('totalScore').textContent = `${format(state.score)} / ${format(core.SCORE_MAX)}`;
    $('roundPoints').textContent = `${format(state.points)} ${t('points')}`;
    $('countryName').textContent = state.current?.name[lang] || '';
    $('result').classList.toggle('hidden', !state.answered);
    $('distanceRow').classList.toggle('hidden', !state.wrong || state.answered);
    if (state.wrong) {
      const km = state.wrong.km, guessed = overseas[state.wrong.iso] || byISO.get(state.wrong.iso);
      const neighbour = core.areLandNeighbours(state.wrong.iso, state.current.iso);
      $('distanceReaction').textContent = guessed ? `${guessed.name[lang]} — ${t('capital')} : ${guessed.capital[lang]} · ` : '';
      $('distanceReaction').textContent += neighbour ? t('neighbour') : t(km < 250 ? 'burning' : km < 750 ? 'hot' : km < 2000 ? 'warm' : km < 5000 ? 'cold' : 'freezing');
      $('distance').classList.toggle('hidden', neighbour);
      $('distance').textContent = neighbour ? '' : `${format(km)} km`;
      $('penalty').textContent = state.wrong.penalty ? `−${state.wrong.penalty} ${t('points')}` : '';
    }
    if (state.answered) {
      $('resultFlag').textContent = flag(state.current);
      $('resultCountry').textContent = state.current.name[lang];
      $('capital').textContent = `${t('capital')} : ${state.current.capital[lang]}`;
      $('fact').textContent = facts[state.current.iso][state.factIndex][lang];
      $('roundEarned').textContent = t('roundEarned', { points: format(state.points) });
      $('perfectFeedback').classList.toggle('hidden', !(game && state.attempts === 1));
      $('perfectFeedback').textContent = game && state.attempts === 1 ? t('perfect') : '';
      $('next').textContent = t(game && state.index === 4 ? 'finish' : 'next');
    }
    if (state.challenge) {
      const resultLink = state.challenge.v === 2;
      const opponent = resultLink ? state.challenge.r : state.challenge.s;
      $('challengeHeading').textContent = t(resultLink ? 'challengeResultTitle' : 'challengeTitle');
      $('challengeLabel').textContent = t('scoreToBeat');
      $('challengeScore').textContent = `${format(opponent)} / ${format(core.SCORE_MAX)}`;
      $('challengeDifficulty').textContent = `${t('challengeLevel')} : ${t(state.challenge.d)}`;
      $('challengeResultSummary').classList.toggle('hidden', !resultLink);
      if (resultLink) $('challengeResultSummary').textContent = t('challengeResultSummary', { mine: format(state.challenge.s), friend: format(state.challenge.r) });
      $('acceptChallenge').textContent = t(resultLink ? 'revenge' : 'accept');
    }
    if (state.screen === 'final') {
      $('finalScore').textContent = `${format(state.score)} / ${format(core.SCORE_MAX)}`;
      const dailyMode = state.mode === 'daily';
      $('finalTitle').textContent = t(dailyMode ? 'dailyFinalTitle' : 'finalTitle');
      $('finalMood').textContent = t(state.score >= 90 ? 'finalGreat' : state.score >= 64 ? 'finalStrong' : 'finalKeepGoing');
      $('dailyFinalTiles').classList.toggle('hidden', !dailyMode);
      $('dailyFinalStats').classList.toggle('hidden', !dailyMode);
      $('personalBest').classList.toggle('hidden', dailyMode);
      $('replay').classList.toggle('hidden', dailyMode);
      if (dailyMode) {
        renderDailyMarks($('dailyFinalTiles'), state.dailyTiles);
        $('dailyFinalErrors').classList.remove('hidden');
        $('dailyFinalErrors').textContent = dailyErrorsText(state.dailyErrors);
        $('dailyFinalStats').innerHTML = `<span>🔥 <b>${t('dailyStreak')}</b> <strong>${format(activeDailyStreak())}</strong></span><span>🏆 <b>${t('dailyBestStreak')}</b> <strong>${format(dailyData.bestStreak)}</strong></span><span>✓ <b>${t('dailyPlayed')}</b> <strong>${format(dailyData.played)}</strong></span>`;
        $('challengeFriend').textContent = t('dailyShare');
        const dailyResult = selectedDailyResult();
        const hasCard = !!dailyResult?.card;
        const opened = !!dailyResult?.cardOpened;
        if (!$('openChest').classList.contains('opening')) {
        $('dailyChest').classList.toggle('hidden', !hasCard || opened);
        $('cardReveal').classList.toggle('hidden', !hasCard || !opened);
        if (hasCard && opened) revealDailyCard(dailyResult);
        }
      } else {
        $('dailyChest').classList.add('hidden'); $('cardReveal').classList.add('hidden');
        $('dailyFinalErrors').classList.add('hidden');
        const best = Number.isSafeInteger(bestScores[state.difficulty]) ? bestScores[state.difficulty] : state.score;
        $('personalBest').textContent = finalWasRecord ? `${t('newRecord')} · ${t('personalBest', { level: t(state.difficulty), score: format(best) })}` : t('personalBest', { level: t(state.difficulty), score: format(best) });
        $('personalBest').classList.toggle('new-record', finalWasRecord);
        $('challengeFriend').textContent = t(state.challenge ? 'shareResult' : 'challengeFriend');
      }
      $('versus').classList.toggle('hidden', !state.challenge);
      $('opponentScore').classList.toggle('hidden', !state.challenge);
      if (state.challenge) {
        const opponent = state.challenge.v === 2 ? state.challenge.r : state.challenge.s;
        const delta = state.score - opponent;
        $('versus').textContent = t(delta === 0 ? 'tie' : delta > 0 ? 'win' : 'lose', { difference: format(Math.abs(delta)) });
        $('opponentScore').textContent = t('against', { score: format(opponent) });
      }
    }
  }
  function clearURL() {
    try { const url = new URL(location.href); url.search = ''; url.hash = ''; history.replaceState(null, '', url); } catch { /* Some browsers restrict file URL history. */ }
  }
  function home() { state = blankState(); justUnlockedCard = false; map.reset(); clearURL(); render(); $('chooseDaily').focus({ preventScroll: true }); }

  function transitionFromHome(action) {
    const homeEl = $('home');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || state.screen !== 'home') { action(); return; }
    homeEl.classList.remove('home-leaving');
    requestAnimationFrame(() => homeEl.classList.add('home-leaving'));
    setTimeout(() => {
      homeEl.classList.remove('home-leaving');
      action();
      const target = state.screen === 'playing' ? $('playing') : state.screen === 'difficulty' ? $('difficulty') : null;
      if (target) { target.classList.remove('screen-arrive'); requestAnimationFrame(() => target.classList.add('screen-arrive')); setTimeout(() => target.classList.remove('screen-arrive'), 480); }
    }, 300);
  }
  function chooseMode(mode) { state.mode = mode; state.screen = mode === 'practice' ? 'practiceSetup' : 'difficulty'; render(); const target = mode === 'practice' ? $('practiceByDifficulty') : $('difficulty').querySelector('button'); target?.focus({ preventScroll: true }); }
  function start(mode, difficulty, challenge = null, customPool = null) {
    state = blankState(); state.mode = mode; state.difficulty = difficulty; state.challenge = challenge;
    recordEvent(mode === 'daily' ? 'daily_started' : 'game_started');
    const pool = Array.isArray(customPool) && customPool.length ? [...customPool] : countries.filter(c => c.difficulty === difficulty).map(c => c.iso);
    state.practicePool = mode === 'practice' ? [...pool] : [];
    if (mode === 'daily') { const daily = todayDaily(); state.dailyKey = daily.key; state.dailyNumber = daily.number; }
    state.series = challenge ? [...challenge.c] : mode === 'daily' ? core.dailySeries(countries, new Date(state.dailyKey+'T12:00:00Z')) : mode === 'game' ? core.shuffle(pool).slice(0, 5) : [];
    state.queue = mode === 'practice' ? core.shuffle(pool) : [];
    round();
  }
  function round() {
    if (state.mode === 'practice' && !state.queue.length) {
      state.queue = core.shuffle(state.practicePool.length ? state.practicePool : countries.filter(c => c.difficulty === state.difficulty).map(c => c.iso));
      if (state.queue.length > 1 && state.queue[0] === state.current?.iso) [state.queue[0], state.queue[1]] = [state.queue[1], state.queue[0]];
    }
    state.current = byISO.get((state.mode === 'game' || state.mode === 'daily') ? state.series[state.index] : state.queue.shift());
    if (state.mode === 'practice') state.practiceRoundId = 'round:' + (globalThis.crypto?.randomUUID?.() || Array.from({length:4},()=>Math.floor(randomUnit()*4294967296).toString(16).padStart(8,'0')).join(''));
    state.screen = 'playing'; state.answered = false; state.attempts = 0; state.points = core.ROUND_MAX; state.factIndex = null; state.wrong = null; state.wrongGuesses = [];
    map.reset(); render();
  }
  function guess(iso) {
    if (state.screen !== 'playing' || state.answered || (!byISO.has(iso) && !overseas[iso])) return;
    if (state.mode === 'practice' && (practiceBlocked || rewardsLoading)) return;
    state.attempts++;
    if (iso !== state.current.iso && overseas[iso]?.parent !== state.current.iso) {
      state.streak = 0;
      const km = distance(iso, state.current.iso), before = state.points;
      if (state.mode === 'game' || state.mode === 'daily') state.points = core.penalise(state.points, km);
      if (state.mode === 'daily') state.dailyErrors++;
      state.wrong = { iso, km, penalty: before - state.points };
      if (!state.wrongGuesses.includes(iso)) state.wrongGuesses.push(iso);
      map.reject(iso);
    } else {
      state.answered = true; state.streak++;
      if (state.mode === 'game' || state.mode === 'daily') { state.score += state.points; if (state.mode === 'daily') state.dailyTiles.push(core.dailyTile(state.points)); }
      const countryISO = state.current.iso;
      state.factIndex = core.chooseFact(countryISO, facts[countryISO].length, validHistory);
      storage.write('wg-seen-facts', validHistory);
      for (const total of [stats, sessionStats]) { total.solved++; total.totalClicks += state.attempts; if (state.attempts === 1) total.oneClick++; }
      storage.write('wg-stats', stats);
    }
    if (state.mode === 'practice') queuePracticeAnswer(state.answered);
    render();
    if (state.wrong && !state.answered) {
      const row = $('distanceRow'); row.classList.remove('wrong-reveal'); void row.offsetWidth; row.classList.add('wrong-reveal');
    }
    if (state.answered) celebrateCorrect(iso);
  }
  async function saveDaily(gameState) {
    try {
      if (!rewardsRepository || rewardError || rewardsLoading) throw new Error('Rewards unavailable');
      if (!gameState.pendingDaily) gameState.pendingDaily = {day:gameState.dailyKey,number:gameState.dailyNumber,score:gameState.score,
        tiles:[...gameState.dailyTiles],errors:gameState.dailyErrors,at:Date.now(),card:await awardDailyCard(gameState.score)};
      const outcome = await rewardsRepository.completeDaily(gameState.pendingDaily);
      applyRewardSnapshot(await rewardsRepository.read()); gameState.pendingDaily = null; rewardError = null;
      if (outcome.status === 'completed') recordEvent('daily_completed');
      rewardChannel?.postMessage('changed');
      if (state === gameState) {
        state.score = outcome.result.score; state.dailyTiles = [...outcome.result.tiles]; state.dailyErrors = outcome.result.errors;
      }
      return true;
    } catch { rewardError = 'rewardSaveFailed'; return false; }
  }
  async function next() {
    if (!state.answered || nextBusy || (state.mode === 'practice' && practiceBlocked)) return;
    const gameState = state;
    if ((state.mode === 'game' || state.mode === 'daily') && state.index === 4) {
      nextBusy = true; $('next').disabled = true;
      try {
        if (state.mode === 'daily') await saveDaily(gameState);
        else {
          recordEvent('challenge_completed');
          const previous = Number.isSafeInteger(bestScores[state.difficulty]) ? bestScores[state.difficulty] : 0;
          finalWasRecord = state.score > previous;
          if (finalWasRecord) { bestScores[state.difficulty] = state.score; storage.write('gf-best-scores', bestScores); }
        }
        if (state === gameState) { state.screen = 'final'; render(); $('challengeFriend').focus({ preventScroll: true }); }
      } finally { nextBusy = false; $('next').disabled = false; }
    } else {
      state.index++; round();
      setTimeout(() => { const mapWrap = $('map')?.closest('.map-wrap'); scrollToElement(mapWrap || $('playing'), 'center'); }, 80);
    }
  }
  function baseURL() { const url = new URL(location.href); url.search = ''; url.hash = ''; return url; }
  function factPayload() {
    if (!state.answered) return null;
    return { title: 'GeoFact', text: t('factShare', { flag: flag(state.current), country: state.current.name[lang], fact: facts[state.current.iso][state.factIndex][lang] }), url: baseURL().href };
  }
  function challengePayload() {
    if (state.screen !== 'final') return null;
    const url = baseURL();
    if (state.mode === 'daily') {
      const daily = {number:state.dailyNumber}, result = selectedDailyResult() || { score: state.score, tiles: state.dailyTiles, errors: state.dailyErrors, number: daily.number };
      const marks = result.tiles.map(normalizeDailyMark).map(core.dailyShareCircle).join('');
      const errors = Number.isSafeInteger(result.errors) ? result.errors : state.dailyErrors;
      return { title: 'GeoFact Daily', text: t('dailyShareText', { number: result.number, score: format(result.score), errors: dailyErrorsText(errors), tiles: marks, streak: format(activeDailyStreak()) }), url: url.href };
    }
    if (state.challenge) {
      const opponent = state.challenge.v === 2 ? state.challenge.r : state.challenge.s;
      const delta = state.score - opponent;
      const outcome = t(delta === 0 ? 'tie' : delta > 0 ? 'win' : 'lose', { difference: format(Math.abs(delta)) });
      url.searchParams.set('challenge', core.encodeChallengeResult(state.difficulty, state.series, opponent, state.score));
      return { title: 'GeoFact', text: t('resultShare', { opponent: format(opponent), score: format(state.score), outcome }), url: url.href };
    }
    url.searchParams.set('challenge', core.encodeChallenge(state.difficulty, state.series, state.score));
    return { title: 'GeoFact', text: t('challengeShare', { score: format(state.score), level: t(state.difficulty) }), url: url.href };
  }
  let toastTimer;
  async function share(payload) {
    if (!payload) return;
    if (navigator.share) {
      try { await navigator.share(payload); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    const text = `${payload.text}\n\n${payload.url}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      $('toast').textContent = t('copied'); $('toast').classList.remove('hidden');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 2200);
    } catch {
      $('copyText').value = text; $('copyDialog').showModal(); $('copyText').focus(); $('copyText').select();
    }
  }
  const customPracticeSelection = new Set();
  function renderPracticePicker() {
    const list = $('practiceCountryList'); if (!list) return;
    const q = ($('practiceSearch')?.value || '').trim().toLocaleLowerCase(lang === 'fr' ? 'fr-FR' : 'en-GB');
    list.replaceChildren();
    const sorted = [...countries].sort((a,b)=>a.name[lang].localeCompare(b.name[lang], lang));
    for (const c of sorted) {
      if (q && !c.name[lang].toLocaleLowerCase(lang === 'fr' ? 'fr-FR' : 'en-GB').includes(q)) continue;
      const label=document.createElement('label'); label.className='practice-country-option';
      const input=document.createElement('input'); input.type='checkbox'; input.checked=customPracticeSelection.has(c.iso); input.value=c.iso;
      const name=document.createElement('span'); name.textContent=`${flag(c)} ${c.name[lang]}`;
      input.addEventListener('change',()=>{ input.checked ? customPracticeSelection.add(c.iso) : customPracticeSelection.delete(c.iso); updatePracticeSelection(); });
      label.append(input,name); list.appendChild(label);
    }
    updatePracticeSelection();
  }
  function updatePracticeSelection() {
    if ($('practiceSelectedCount')) $('practiceSelectedCount').textContent=t('selectedCountries',{count:format(customPracticeSelection.size)});
    if ($('startCustomPractice')) $('startCustomPractice').disabled=customPracticeSelection.size===0;
  }
  $('openPublicStats').addEventListener('click', () => { state = blankState(); state.screen = 'publicStats'; render(); loadPublicStats(); });
  $('statsPeriod').addEventListener('change', loadPublicStats);
  $('chooseDaily').addEventListener('click', async () => {
    await refreshRewards();
    const daily = todayDaily();
    if (daily.result) {
      state = blankState(); state.mode = 'daily'; state.dailyKey = daily.key; state.dailyNumber = daily.number; state.series = daily.series; state.score = daily.result.score; state.dailyTiles = [...daily.result.tiles].map(normalizeDailyMark); state.dailyErrors = Number.isSafeInteger(daily.result.errors) ? daily.result.errors : 0; state.screen = 'final'; render();
    } else { transitionFromHome(() => start('daily', 'daily')); }
  });
  $('resumeDailyChest').addEventListener('click', async () => {
    const day = $('resumeDailyChest').dataset.day; await refreshRewards();
    const result = dailyData.days[day]; if (!result?.card || result.cardOpened) return;
    state = blankState(); state.mode = 'daily'; state.dailyKey = day; state.dailyNumber = result.number;
    state.score = result.score; state.dailyTiles = [...result.tiles].map(normalizeDailyMark); state.dailyErrors = result.errors || 0;
    state.screen = 'final'; render();
  });
  $('chooseGame').addEventListener('click', () => transitionFromHome(() => chooseMode('game')));
  $('choosePractice').addEventListener('click', () => transitionFromHome(() => chooseMode('practice')));
  $('practiceByDifficulty')?.addEventListener('click',()=>{ state.mode='practice'; state.screen='difficulty'; render(); });
  $('practiceCustom')?.addEventListener('click',()=>{ $('practicePicker').classList.remove('hidden'); renderPracticePicker(); $('practiceSearch')?.focus({preventScroll:true}); });
  $('practiceSearch')?.addEventListener('input',renderPracticePicker);
  $('selectAllPractice')?.addEventListener('click',()=>{ countries.forEach(c=>customPracticeSelection.add(c.iso)); renderPracticePicker(); });
  $('clearPractice')?.addEventListener('click',()=>{ customPracticeSelection.clear(); renderPracticePicker(); });
  $('startCustomPractice')?.addEventListener('click',()=>{ if(customPracticeSelection.size) start('practice','custom',null,[...customPracticeSelection]); });
  document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => start(state.mode, button.dataset.level)));
  $('openCollection').addEventListener('click', async () => { await refreshRewards(); state = blankState(); state.screen = 'collection'; render(); });
  const openHow=()=>{ $('howModal')?.classList.remove('hidden'); document.body.classList.add('modal-open'); };
  const closeHow=()=>{ $('howModal')?.classList.add('hidden'); document.body.classList.remove('modal-open'); };
  $('howToPlay')?.addEventListener('click',openHow); $('closeHow')?.addEventListener('click',closeHow); $('howModal')?.addEventListener('click',e=>{if(e.target===$('howModal')) closeHow();});
  async function animateChest({button,box,rarity,commit,reveal,isCurrent,errorKey,afterCommit}) {
    if (button.classList.contains('opening')) return;
    button.dataset.rarity=rarity; button.classList.add('opening'); button.disabled=true;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      await new Promise(resolve=>setTimeout(resolve,reduced?80:4650));
      const outcome = await commit();
      applyRewardSnapshot(await rewardsRepository.read()); rewardError = null; renderRewardStatus();
      afterCommit?.(outcome); rewardChannel?.postMessage('changed');
      if (!isCurrent()) return;
      box.classList.add('chest-fade');
      await new Promise(resolve=>setTimeout(resolve,reduced?0:260));
      if (isCurrent()) reveal(outcome);
    } catch { rewardError = errorKey; render(); }
    finally { button.classList.remove('opening'); button.disabled=false; box.classList.remove('chest-fade'); renderBonusRewards(); }
  }
  $('openChest').addEventListener('click', async () => {
    const gameState = state, day = state.dailyKey, result = selectedDailyResult();
    if (!result?.card || result.cardOpened) return;
    await animateChest({button:$('openChest'),box:$('dailyChest'),rarity:result.card.rarity,
      commit:()=>rewardsRepository.revealDaily({day,at:Date.now()}),
      afterCommit:outcome=>{if(outcome.status==='revealed')recordEvent('chest_opened');},
      isCurrent:()=>state===gameState,reveal:outcome=>revealDailyCard(outcome.result),errorKey:'rewardRevealFailed'});
  });
  async function retryRewards() {
    if (nextBusy || rewardsLoading || practiceSaving) return;
    if (pendingPracticeUnreadable) {
      try {
        const commands = JSON.parse(sessionStorage.getItem(PRACTICE_PENDING_KEY) || '[]');
        if (!Array.isArray(commands) || commands.some(c=>!c || c.mode!=='practice')) throw new Error('Invalid pending answers');
        pendingPractice = commands; pendingPracticeUnreadable = false;
      } catch { rewardError = 'bonusRecoveryFailed'; render(); return; }
    }
    const gameState = state; nextBusy = true;
    try {
    practiceBlocked = false;
    await initializeRewards();
    if (!rewardError && pendingPractice.length) await savePracticeAnswers();
    if (!rewardError && gameState === state && state.mode === 'daily' && state.screen === 'final' && !selectedDailyResult()) {
      await saveDaily(gameState); render();
    }
    } finally { nextBusy = false; renderRewardStatus(); }
  }
  $('retryRewards').addEventListener('click', retryRewards);
  $('retryBonusRewards').addEventListener('click', retryRewards);
  const bonusChestButton=$('openChest').cloneNode(true);bonusChestButton.id='openBonusChest';
  $('bonusChestStage').appendChild(bonusChestButton);
  for(const id of ['openBonusRewards','openPracticeBonusRewards','collectionBonusRewards']) $(id).addEventListener('click',openBonusRewards);
  $('closeBonusRewards').addEventListener('click',()=>$('bonusDialog').close());
  bonusChestButton.addEventListener('click',async()=>{
    const chest=bonusSnapshot?.chests[selectedBonus];if(!chest||chest.openedAt!==null)return;
    const selected=selectedBonus;
    await animateChest({button:bonusChestButton,box:$('bonusChestStage'),rarity:chest.card.rarity,
      commit:()=>rewardsRepository.openChest({id:'open:'+chest.id,chestId:chest.id,at:Date.now()}),
      isCurrent:()=>$('bonusDialog').open&&selectedBonus===selected,
      reveal:outcome=>revealBonusCard(outcome.chest),errorKey:'bonusOpenFailed'});
  });
  $('collectionSort')?.addEventListener('change', renderCollection);
  $('closeCardModal')?.addEventListener('click', closeCardModal);
  $('cardModal')?.addEventListener('click', e => { if (e.target === $('cardModal')) closeCardModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('cardModal')?.classList.contains('hidden')) closeCardModal(); if (!$('howModal')?.classList.contains('hidden')) closeHow(); } });
  document.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', home));
  $('brand').addEventListener('click', home);
  $('lang').addEventListener('change', e => {
    lang = e.target.value;
    try { localStorage.setItem('wg-lang', lang); } catch { /* Language still changes without persistence. */ }
    const openCollectionIso = !$('collectionDetail')?.classList.contains('hidden')
      ? $('collectionDetail')?.dataset.iso
      : null;
    render();
    if (openCollectionIso) renderCollectionDetail(openCollectionIso);
  });
  $('acceptChallenge').addEventListener('click', () => start('game', state.challenge.d, state.challenge));
  $('next').addEventListener('click', next);
  $('replay').addEventListener('click', () => start('game', state.difficulty, state.challenge));
  $('shareFact').addEventListener('click', () => share(factPayload()));
  $('challengeFriend').addEventListener('click', () => share(challengePayload()));
  $('zoomIn').addEventListener('click', () => map.zoom(1.5));
  $('zoomOut').addEventListener('click', () => map.zoom(1 / 1.5));
  $('resetMap').addEventListener('click', () => map.reset());
  $('closeCopy').addEventListener('click', () => $('copyDialog').close());
  const params = new URL(location.href).searchParams;
  const challenge = params.getAll('challenge').length === 1 ? core.parseChallenge(params.get('challenge'), countries) : null;
  if (challenge) { state.screen = 'challengeIntro'; state.challenge = challenge; }
  render();
  initializeRewards().then(()=>{if(!rewardError&&pendingPractice.length)savePracticeAnswers();});
  recordEvent('visit');
  setInterval(() => { updateCountdown(); const key = core.utcDayKey(); if (key !== renderedDailyKey) { renderedDailyKey = key; if (state.screen === 'home') render(); else renderBonusRewards(); } }, 1000);
})();
