// Minimal, read-only preparation of the two existing reward save keys.
import {BONUS_RARITY_WEIGHTS,bonusUTCDate} from './bonus-rules.mjs';
export const LEGACY_REWARD_KEYS=Object.freeze(['gf-collection-v1','gf-daily-v1']);
export class LegacySaveError extends Error {
  constructor(code,message) {super(message);this.name='LegacySaveError';this.code=code;}
}
const bad=message=>{throw new LegacySaveError('INVALID_LEGACY_SAVES',message);};
const object=(x,label)=>{if(!x||typeof x!=='object'||Array.isArray(x)) bad(label+' must be an object');return x;};
const integer=(x,label,min=0)=>{if(!Number.isSafeInteger(x)||x<min) bad('Invalid '+label);};
const variant=r=>{if(typeof r!=='string'||!Object.hasOwn(BONUS_RARITY_WEIGHTS,r)) bad('Unknown rarity');};
const date=d=>{if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T00:00:00Z'))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d) bad('Invalid date');};

export function readLegacyRewardValues(storage) {
  try {
    const read=()=>Object.fromEntries(LEGACY_REWARD_KEYS.map(key=>[key,storage.getItem(key)]));
    const a=read(),b=read();
    if(LEGACY_REWARD_KEYS.some(k=>a[k]!==b[k])) throw new LegacySaveError('LEGACY_SOURCE_CHANGED','Original saves changed during reading');
    return a;
  } catch(error) {
    if(error instanceof LegacySaveError) throw error;
    throw new LegacySaveError('LEGACY_SOURCE_UNAVAILABLE','Original saves cannot be read');
  }
}
export function sameLegacyValues(a,b) {return LEGACY_REWARD_KEYS.every(k=>a[k]===b[k]);}

export function prepareLegacyRewards(raw) {
  const parse=key=>{
    if(raw[key]===null) return {};
    if(typeof raw[key]!=='string') bad('Missing source value');
    try {return JSON.parse(raw[key]);}catch {bad('Unreadable '+key);}
  };
  const collection=structuredClone(object(parse('gf-collection-v1'),'collection'));
  for(const [iso,entry] of Object.entries(collection)) {
    if(!/^[A-Z]{3}$/.test(iso)) bad('Invalid country code');object(entry,'card entry');
    const rarities=entry.rarities??(entry.rarity?[entry.rarity]:null);
    if(!Array.isArray(rarities)||!rarities.length||new Set(rarities).size!==rarities.length) bad('Invalid variants');
    rarities.forEach(variant);
    if(entry.rarity!==undefined) {variant(entry.rarity);if(!rarities.includes(entry.rarity)) bad('Conflicting legacy rarity');}
    entry.rarities=[...rarities];
    if(entry.counts===undefined) entry.counts=Object.fromEntries(rarities.map(r=>[r,1]));
    else {
      object(entry.counts,'copy counts');
      if(Object.keys(entry.counts).some(r=>!rarities.includes(r))) bad('Copies without variant');
      for(const r of rarities) integer(entry.counts[r],'copy count',1);
    }
    if(entry.firstUnlocked!==undefined) date(entry.firstUnlocked);
    if(entry.acquiredAt!==undefined) {
      object(entry.acquiredAt,'acquisition dates');
      for(const [r,t] of Object.entries(entry.acquiredAt)) {
        if(!rarities.includes(r)) bad('Date without variant');
        try {bonusUTCDate(t);}catch {bad('Invalid acquisition timestamp');}
      }
    }
  }
  // Keep the historical Daily representation exactly, including legacy scores/tiles.
  const daily=structuredClone(object(parse('gf-daily-v1'),'Daily'));
  if(daily.days!==undefined) object(daily.days,'Daily history');
  const credited={};
  for(const [key,result] of Object.entries(daily.days||{})) {
    date(key);object(result,'Daily result');integer(result.score,'Daily score');if(result.score>5000) bad('Invalid Daily score');
    if(!Array.isArray(result.tiles)||result.tiles.length!==5||result.tiles.some(t=>!['green','yellow','orange','red','🟩','🟨','🟧','🟥'].includes(t))) bad('Invalid Daily tiles');
    for(const field of ['number','errors']) if(result[field]!==undefined) integer(result[field],field,field==='number'?1:0);
    if(result.cardOpened!==undefined&&typeof result.cardOpened!=='boolean') bad('Invalid revelation flag');
    if(result.card!==undefined) {
      const card=object(result.card,'Daily card');variant(card.rarity);
      const copies=collection[card.iso]?.counts?.[card.rarity];if(!copies) bad('Daily card is missing from collection');
      const id=card.iso+':'+card.rarity;credited[id]=(credited[id]||0)+1;
      if(copies<credited[id]) bad('Daily history exceeds collection copies');
      if(card.copies!==undefined) {integer(card.copies,'Daily copies',1);if(card.copies>copies) bad('Inconsistent Daily copies');}
    } else if(result.cardOpened===true) bad('Opened Daily has no card');
  }
  for(const field of ['played','streak','bestStreak']) if(daily[field]!==undefined) integer(daily[field],field);
  if(daily.played!==undefined&&daily.played<Object.keys(daily.days||{}).length) bad('Inconsistent Daily history');
  if(daily.streak!==undefined&&daily.bestStreak!==undefined&&daily.streak>daily.bestStreak) bad('Inconsistent Daily streak');
  if(daily.lastDate!==undefined&&daily.lastDate!==null) date(daily.lastDate);
  return {collection,daily,raw:structuredClone(raw)};
}
