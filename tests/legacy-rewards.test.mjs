import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLegacyRewards,readLegacyRewardValues} from '../legacy-rewards.mjs';
import {currentSave,legacySave} from './save-fixtures.mjs';
const raw=seed=>Object.fromEntries(['gf-collection-v1','gf-daily-v1'].map(k=>[k,seed[k]??null]));
test('current collection, copies, timestamps and complete Daily preserved',()=>{
 const result=prepareLegacyRewards(raw(currentSave));
 assert.deepEqual(result.collection,JSON.parse(currentSave['gf-collection-v1']));
 assert.deepEqual(result.daily,JSON.parse(currentSave['gf-daily-v1']));
 assert.deepEqual(result.raw,raw(currentSave));
});
test('legacy variants normalized without invented acquisition date or changed Daily',()=>{
 const result=prepareLegacyRewards(raw(legacySave));
 assert.deepEqual(result.collection.FRA,{rarity:'silver',rarities:['silver'],counts:{silver:1},firstUnlocked:'2026-10-01'});
 assert.deepEqual(result.daily,JSON.parse(legacySave['gf-daily-v1']));
});
test('unrevealed Daily and unknown fields remain intact',()=>{
 const seed=raw(currentSave),daily=JSON.parse(seed['gf-daily-v1']);daily.days['2026-10-07'].cardOpened=false;daily.record={extra:123};seed['gf-daily-v1']=JSON.stringify(daily);
 assert.deepEqual(prepareLegacyRewards(seed).daily,daily);
});
test('absent keys accepted, JSON null and unreadable data rejected',()=>{
 assert.deepEqual(prepareLegacyRewards(raw({})).collection,{});
 for(const value of ['null','[1]','{']) assert.throws(()=>prepareLegacyRewards({...raw(currentSave),'gf-collection-v1':value}),{code:'INVALID_LEGACY_SAVES'});
});
test('partial corruption never becomes an empty collection',()=>{
 for(const mutation of [c=>c.FRA.counts.classic=0,c=>delete c.FRA.counts.silver,c=>c.FRA.firstUnlocked='2026-02-30',c=>c.FRA.rarities.push('unknown')]) {
  const seed=raw(currentSave),collection=JSON.parse(seed['gf-collection-v1']);mutation(collection);seed['gf-collection-v1']=JSON.stringify(collection);
  assert.throws(()=>prepareLegacyRewards(seed),{code:'INVALID_LEGACY_SAVES'});
 }
});
test('inconsistent Daily card or history rejected',()=>{
 for(const mutation of [d=>d.days['2026-10-07'].card.iso='USA',d=>d.played=0,d=>d.streak=6]) {
  const seed=raw(currentSave),daily=JSON.parse(seed['gf-daily-v1']);mutation(daily);seed['gf-daily-v1']=JSON.stringify(daily);
  assert.throws(()=>prepareLegacyRewards(seed),{code:'INVALID_LEGACY_SAVES'});
 }
});
test('read-only source and immutable input',()=>{
 const seed=Object.freeze(raw(currentSave)),calls=[];
 const storage={getItem:k=>{calls.push(k);return seed[k];},setItem:()=>assert.fail('write'),removeItem:()=>assert.fail('delete')};
 assert.deepEqual(readLegacyRewardValues(storage),seed);assert.equal(calls.length,4);
 prepareLegacyRewards(seed);assert.deepEqual(seed,raw(currentSave));
});
test('unavailable or unstable source reported explicitly',()=>{
 assert.throws(()=>readLegacyRewardValues({getItem(){throw Error('denied');}}),{code:'LEGACY_SOURCE_UNAVAILABLE'});
 let n=0;assert.throws(()=>readLegacyRewardValues({getItem(){return String(++n);}}),{code:'LEGACY_SOURCE_CHANGED'});
});
