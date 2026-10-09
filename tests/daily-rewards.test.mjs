import test from 'node:test';
import assert from 'node:assert/strict';
import {rollDailyRarity,completeDailyReward} from '../daily-rewards.mjs';
import {currentSave} from './save-fixtures.mjs';
const command=(extra={})=>({day:'2026-10-08',at:Date.parse('2026-10-08T12:00:00Z'),number:2,score:100,errors:0,tiles:Array(5).fill('green'),card:{iso:'FRA',rarity:'classic'},...extra});
const seed=()=>({collection:JSON.parse(currentSave['gf-collection-v1']),daily:JSON.parse(currentSave['gf-daily-v1'])});
test('Daily rarity probabilities exactly match previous formula at every score',()=>{
 for(let score=0;score<=100;score++)for(let i=0;i<10000;i++) {
  const draw=i/10000,q=score/100,s=.005+.035*q,g=.05+.11*q,a=.20+.10*q;
  assert.equal(rollDailyRarity(score,draw),draw<s?'shiny':draw<s+g?'gold':draw<s+g+a?'silver':'classic');
 }
});
test('Daily duplicate adds a copy, preserves dates and all historical records',()=>{
 const {collection,daily}=seed(),before=structuredClone({collection,daily});
 const result=completeDailyReward(collection,daily,command());
 assert.equal(result.collection.FRA.counts.classic,4);assert.deepEqual(result.collection.FRA.acquiredAt,collection.FRA.acquiredAt);
 assert.equal(result.collection.FRA.firstUnlocked,collection.FRA.firstUnlocked);
 assert.deepEqual(result.daily.days['2026-10-07'],daily.days['2026-10-07']);assert.deepEqual([result.daily.played,result.daily.streak,result.daily.bestStreak],[8,4,5]);
 assert.deepEqual({collection,daily},before);assert.equal(result.result.cardOpened,false);
});
test('new variant gets the completion timestamp, existing variants remain intact',()=>{
 const {collection,daily}=seed(),c=command({card:{iso:'FRA',rarity:'shiny'}}),r=completeDailyReward(collection,daily,c);
 assert.equal(r.collection.FRA.counts.shiny,1);assert.equal(r.collection.FRA.acquiredAt.shiny,c.at);
 assert.equal(r.collection.FRA.acquiredAt.classic,collection.FRA.acquiredAt.classic);
});
test('same UTC day cannot credit twice or replace its fixed card',()=>{
 const {collection,daily}=seed(),r=completeDailyReward(collection,daily,command());
 const duplicate=completeDailyReward(r.collection,r.daily,command({card:{iso:'JPN',rarity:'silver'}}));
 assert.equal(duplicate.status,'already-completed');assert.strictEqual(duplicate.collection,r.collection);assert.strictEqual(duplicate.daily,r.daily);assert.deepEqual(duplicate.result.card,r.result.card);
});
test('completion after midnight is attached to launch day',()=>{
 const {collection,daily}=seed(),r=completeDailyReward(collection,daily,command({at:Date.parse('2026-10-09T00:01:00Z')}));
 assert.ok(r.daily.days['2026-10-08']);assert.equal(r.daily.days['2026-10-09'],undefined);
 const newer=completeDailyReward(r.collection,r.daily,command({day:'2026-10-09',at:Date.parse('2026-10-09T01:00:00Z'),number:3}));
 assert.equal(newer.daily.streak,5);assert.equal(newer.daily.played,9);
});
test('late previous-day completion does not move newest history backwards',()=>{
 const first=completeDailyReward({}, {days:{},played:0,streak:0,bestStreak:0},command({day:'2026-10-09',at:Date.parse('2026-10-09T01:00:00Z')}));
 const late=completeDailyReward(first.collection,first.daily,command({at:Date.parse('2026-10-09T01:01:00Z')}));
 assert.equal(late.daily.lastDate,'2026-10-09');assert.equal(late.daily.streak,2);assert.equal(late.daily.bestStreak,2);
});
test('invalid completion and draws are rejected without mutation',()=>{
 const {collection,daily}=seed();for(const c of [command({score:101}),command({tiles:[]}),command({day:'2026-02-30'}),command({card:{iso:'FRA',rarity:'alien'}})])assert.throws(()=>completeDailyReward(collection,daily,c));
 for(const n of [-1,1,NaN])assert.throws(()=>rollDailyRarity(100,n));
});
