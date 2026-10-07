/* Game rules shared by the browser and the regression tests. No dependencies. */
(function (root) {
  'use strict';
  const levels = ['easy', 'medium', 'hard'];
  const ROUND_MAX = 20, SCORE_MAX = 100;
  const penaltyFor = km => km < 250 ? 1 : km < 750 ? 2 : km < 2000 ? 3 : km < 5000 ? 4 : 5;
  const penalise = (points, km) => Math.max(2, points - penaltyFor(km));
  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function encodeChallenge(d, c, s) {
    const json = JSON.stringify({ v: 3, d, c, s });
    const base64 = typeof btoa === 'function' ? btoa(json) : Buffer.from(json).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function encodeChallengeResult(d, c, s, r) {
    const json = JSON.stringify({ v: 4, d, c, s, r });
    const base64 = typeof btoa === 'function' ? btoa(json) : Buffer.from(json).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function parseChallenge(token, countries) {
    if (typeof token !== 'string' || token.length > 512 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
    try {
      const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      const json = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString();
      const p = JSON.parse(json);
      if (!p || ![1, 2, 3, 4].includes(p.v) || !levels.includes(p.d) || !Array.isArray(p.c) || p.c.length !== 5 || new Set(p.c).size !== 5) return null;
      const legacy = p.v <= 2, min = legacy ? 500 : 10, max = legacy ? 5000 : SCORE_MAX;
      if (!Number.isInteger(p.s) || p.s < min || p.s > max) return null;
      if ([2, 4].includes(p.v) && (!Number.isInteger(p.r) || p.r < min || p.r > max)) return null;
      if (!p.c.every(iso => typeof iso === 'string' && countries.some(c => c.iso === iso && c.difficulty === p.d))) return null;
      const keys = Object.keys(p).sort().join(',');
      // Validate canonical payloads. v1/v2 are kept readable so old shared links still work after the score migration.
      const canonical = obj => { const json = JSON.stringify(obj); const b64 = typeof btoa === 'function' ? btoa(json) : Buffer.from(json).toString('base64'); return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
      if ([1,3].includes(p.v) && (keys !== 'c,d,s,v' || canonical(p) !== token)) return null;
      if ([2,4].includes(p.v) && (keys !== 'c,d,r,s,v' || canonical(p) !== token)) return null;
      if (legacy) { p.s = Math.round(p.s / 50); if (p.v === 2) p.r = Math.round(p.r / 50); p.v += 2; }
      return p;
    } catch { return null; }
  }
  const dailyEpoch = Date.UTC(2026, 9, 7);
  function utcDayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
  function dailyNumber(date = new Date()) { return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - dailyEpoch) / 86400000) + 1; }
  function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seededRandom(seed) {
    let x = seed >>> 0;
    return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function dailySeries(countries, date = new Date()) {
    const key = utcDayKey(date), random = seededRandom(hashSeed('GeoFactDaily-v1:' + key));
    const pick = (level, count) => shuffle(countries.filter(c => c.difficulty === level).map(c => c.iso), random).slice(0, count);
    // Deliberately balanced: approachable every day, with one harder country.
    return shuffle([...pick('easy', 2), ...pick('medium', 2), ...pick('hard', 1)], random);
  }
  function dailyTile(points) { return points >= 18 ? 'green' : points >= 14 ? 'yellow' : points >= 8 ? 'orange' : 'red'; }
  function dailyShareCircle(mark) { return ({ green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴' })[mark] || ''; }
  function chooseFact(iso, count, history, random = Math.random) {
    const old = history[iso] || {};
    const valid = index => Number.isInteger(index) && index >= 0 && index < count;
    let seen = [...new Set(Array.isArray(old.seen) ? old.seen.filter(valid) : [])];
    let available = Array.from({ length: count }, (_, i) => i).filter(i => !seen.includes(i));
    if (!available.length) {
      seen = [];
      available = Array.from({ length: count }, (_, i) => i).filter(i => count === 1 || i !== old.last);
    }
    const index = available[Math.floor(random() * available.length)];
    history[iso] = { seen: [...seen, index], last: index };
    return index;
  }
  const rad = Math.PI / 180;
  function spherePoint(x, y) {
    const lat = (90 - y * .3) * rad, lon = (x * .3 - 180) * rad;
    const cos = Math.cos(lat);
    return [cos * Math.cos(lon), cos * Math.sin(lon), Math.sin(lat)];
  }
  function samplePath(d) {
    const commands = d.match(/[MLZ][^MLZ]*/gi) || [];
    const points = [], vertices = new Set();
    let prev, first;
    for (const command of commands) {
      const type = command[0].toUpperCase();
      const nums = command.slice(1).match(/-?\d+(?:\.\d+)?/g);
      const next = type === 'Z' ? first : nums ? nums.slice(0, 2).map(Number) : null;
      if (!next) continue;
      vertices.add(next.map(n => n.toFixed(2)).join(','));
      if (type !== 'M' && prev) {
        const dx = next[0] - prev[0], dy = next[1] - prev[1];
        const steps = Math.abs(dx) > 600 ? 1 : Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
        for (let i = 1; i < steps; i++) points.push(spherePoint(prev[0] + dx * i / steps, prev[1] + dy * i / steps));
      }
      points.push(spherePoint(...next));
      if (type === 'M') first = next;
      prev = next;
    }
    return { points, vertices };
  }
  function territoryDistance(a, b) {
    for (const v of a.vertices) if (b.vertices.has(v)) return 10;
    let minimum = Infinity;
    for (const p of a.points) for (const q of b.points) {
      const chord = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (chord < minimum) minimum = chord;
    }
    const km = 12742 * Math.asin(Math.min(1, Math.sqrt(minimum) / 2));
    return km <= 2 ? 10 : Math.max(1, Math.round(km));
  }
  const core = { ROUND_MAX, SCORE_MAX, levels, penaltyFor, penalise, shuffle, encodeChallenge, encodeChallengeResult, parseChallenge, utcDayKey, dailyNumber, dailySeries, dailyTile, dailyShareCircle, chooseFact, samplePath, spherePoint, territoryDistance };
  root.GeoFactCore = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
})(globalThis);
