import test from 'node:test';
import assert from 'node:assert/strict';
import {createBonusState,applyBonusAnswer,openBonusChest,bonusProgress,bonusUTCDate,
  rollBonusRarity,pickBonusCard,BONUS_RARITY_WEIGHTS,isBonusEligibleMode} from '../bonus-rules.mjs';

const catalog=['FRA','JPN','USA'];
const at=Date.parse('2026-10-08T12:00:00Z');
const nextDay=Date.parse('2026-10-09T00:00:00Z');
const answer=(n,extra={})=>({id:`answer:${n}`,roundId:`round:${n}`,mode:'practice',correct:true,
  at,countryDraw:0,rarityDraw:.5,...extra});
const apply=(state,n,extra={})=>applyBonusAnswer(state,answer(n,extra),catalog);
function run(count,state=createBonusState(),start=1,extra={}) {
  const results=[];
  for(let n=start;n<start+count;n++) {const result=apply(state,n,extra);state=result.state;results.push(result);}
  return {state,results};
}
function freeze(value) {
  if(value && typeof value==='object') {Object.freeze(value);for(const child of Object.values(value)) freeze(child);}
  return value;
}
const chestCount=state=>Object.keys(state.chests).length;

test('9/10/11 correct rounds produce one sealed chest, then progress 1',()=>{
  let {state}=run(9);
  assert.equal(state.progress,9);assert.equal(chestCount(state),0);
  const tenth=apply(state,10);state=tenth.state;
  assert.equal(state.progress,0);assert.equal(chestCount(state),1);assert.equal(tenth.credit,null);
  assert.deepEqual(tenth.chest.card,{iso:'FRA',rarity:'classic'});assert.equal(tenth.chest.openedAt,null);
  assert.equal(state.grantsByDay['2026-10-08'],1);
  state=apply(state,11).state;assert.equal(state.progress,1);assert.equal(chestCount(state),1);
});

test('every wrong answer resets progress; correcting that round begins at 1',()=>{
  let {state}=run(9);state=apply(state,10,{correct:false}).state;
  assert.equal(state.progress,0);assert.equal(chestCount(state),0);
  state=apply(state,11,{roundId:'round:10'}).state;assert.equal(state.progress,1);
  state=apply(state,12,{correct:false}).state;assert.equal(state.progress,0);
  state=apply(state,13,{roundId:'round:12',correct:false}).state;assert.equal(state.progress,0);
});

test('second daily chest pauses all further progress and never banks a third',()=>{
  const {state,results}=run(100);
  assert.deepEqual(results.filter(r=>r.chest).map(r=>r.chest.id),['bonus:answer:10','bonus:answer:20']);
  assert.equal(chestCount(state),2);assert.equal(state.progress,0);
  assert.deepEqual(bonusProgress(state,at),{progress:0,target:10,day:'2026-10-08',obtained:2,limit:2,paused:true});
  const wrong=apply(state,101,{correct:false});assert.equal(wrong.state.progress,0);
  assert.equal(wrong.state.grantsByDay['2026-10-08'],2);
});

test('a wrong answer resets even a paused imported progress value',()=>{
  const state={...createBonusState(),progress:7,grantsByDay:{'2026-10-08':2}};
  assert.equal(apply(state,1).state.progress,7);
  assert.equal(apply(state,2,{correct:false}).state.progress,0);
});

test('progress survives serialization, new sessions and the next UTC day',()=>{
  const initial=run(7).state;
  const restored=JSON.parse(JSON.stringify(initial));
  assert.equal(bonusProgress(restored,nextDay).progress,7);
  let state=restored;
  for(let n=1;n<=3;n++) state=apply(state,n,{id:`session:B:answer:${n}`,roundId:`session:B:round:${n}`,at:nextDay}).state;
  assert.equal(state.progress,0);assert.equal(chestCount(state),1);
  assert.equal(state.grantsByDay['2026-10-09'],1);assert.equal(restored.progress,7);
});

test('UTC dates ignore local offsets, including both sides of midnight',()=>{
  assert.equal(bonusUTCDate(Date.parse('2026-10-09T01:59:59+02:00')),'2026-10-08');
  assert.equal(bonusUTCDate(Date.parse('2026-10-09T02:00:00+02:00')),'2026-10-09');
  assert.equal(bonusUTCDate(Date.parse('2026-10-08T20:00:00-04:00')),'2026-10-09');
  let state=run(9).state;
  const before=apply(state,10,{at:nextDay-1});state=before.state;
  assert.equal(before.chest.earnedDay,'2026-10-08');
  const after=run(10,state,11,{at:nextDay}).state;
  assert.equal(after.grantsByDay['2026-10-08'],1);assert.equal(after.grantsByDay['2026-10-09'],1);
  assert.equal(chestCount(after),2);
});

test('a streak crossing midnight grants on its tenth answer without resetting progress',()=>{
  const state=run(9,createBonusState(),1,{at:nextDay-1}).state;
  const result=apply(state,10,{at:nextDay});
  assert.equal(result.chest.earnedDay,'2026-10-09');assert.equal(result.state.grantsByDay['2026-10-08'],undefined);
  assert.equal(result.state.grantsByDay['2026-10-09'],1);
});

test('the next day resumes from 0 after a capped day, and old quotas remain remembered',()=>{
  let state=run(30).state;
  assert.equal(bonusProgress(state,nextDay).paused,false);assert.equal(state.progress,0);
  state=run(10,state,31,{at:nextDay}).state;
  assert.equal(state.grantsByDay['2026-10-08'],2);assert.equal(state.grantsByDay['2026-10-09'],1);
  state=run(10,state,41,{at}).state;
  assert.equal(chestCount(state),3);assert.equal(state.progress,0);
});

test('Daily and custom-list modes leave the entire shared bonus state untouched',()=>{
  const state=freeze(run(7).state);
  for(const mode of ['classic','daily','custom-practice']) for(const correct of [true,false]) {
    const result=apply(state,8,{mode,correct});assert.strictEqual(result.state,state);assert.equal(result.credit,null);
  }
});

test('repeated countries and different sessions count as separate rounds',()=>{
  let state=createBonusState();
  for(let n=1;n<=10;n++) state=apply(state,n,{roundId:`session:${n}:FRA`}).state;
  assert.equal(chestCount(state),1);
});

test('stable answer IDs cannot increment progress, grant or reroll twice',()=>{
  const ninth=run(9).state,command=answer(10);
  const first=applyBonusAnswer(ninth,command,catalog);
  const replay=applyBonusAnswer(first.state,{...command,at:nextDay,countryDraw:.999,rarityDraw:0},catalog);
  assert.equal(replay.status,'duplicate');assert.strictEqual(replay.state,first.state);
  assert.deepEqual(replay.chest,first.chest);assert.equal(replay.credit,null);assert.equal(chestCount(replay.state),1);
  assert.equal(replay.state.grantsByDay['2026-10-09'],undefined);
  const earlier=apply(replay.state,1);assert.equal(earlier.status,'duplicate');assert.strictEqual(earlier.state,replay.state);
});

test('serialized receipts suppress both attribution and credit after restoration',()=>{
  const before=run(9).state,command=answer(10);
  const earned=applyBonusAnswer(before,command,catalog);
  assert.deepEqual(applyBonusAnswer(before,command,catalog),earned,'same explicit inputs give the same transition');
  const restored=JSON.parse(JSON.stringify(earned.state));
  const replay=applyBonusAnswer(restored,{...command,at:nextDay,rarityDraw:0},catalog);
  assert.equal(replay.status,'duplicate');assert.equal(chestCount(replay.state),1);
  assert.deepEqual(replay.chest.card,earned.chest.card);
  const opened=openBonusChest(restored,{id:'open:persisted',chestId:earned.chest.id,at:nextDay});
  const reopened=openBonusChest(JSON.parse(JSON.stringify(opened.state)),{id:'open:persisted',chestId:earned.chest.id,at:nextDay+1000});
  assert.equal(reopened.status,'duplicate');assert.equal(reopened.credit,null);assert.equal(reopened.chest.openedAt,nextDay);
});

test('duplicate wrong answers do not erase later progress',()=>{
  const wrong=apply(run(4).state,5,{correct:false});const corrected=apply(wrong.state,6,{roundId:'round:5'});
  const replay=apply(corrected.state,5,{correct:false,at:nextDay});
  assert.equal(replay.state.progress,1);assert.strictEqual(replay.state,corrected.state);
});

test('an answered round cannot be counted again under a new action ID',()=>{
  const state=run(9).state;
  const again=apply(state,100,{roundId:'round:9'});assert.equal(again.status,'ignored');assert.equal(again.state.progress,9);
  assert.equal(chestCount(again.state),0);
  const lateWrong=apply(again.state,101,{roundId:'round:9',correct:false});assert.equal(lateWrong.state.progress,9);
  const paused=run(20).state;
  const pausedAnswer=apply(paused,21);const tomorrow=apply(pausedAnswer.state,22,{roundId:'round:21',at:nextDay});
  assert.equal(tomorrow.status,'ignored');assert.equal(tomorrow.state.progress,0);
});

test('operation identifiers cannot be reused for a different answer or command type',()=>{
  const state=run(10).state;
  assert.throws(()=>apply(state,10,{correct:false}),/reused/);
  assert.throws(()=>apply(state,10,{roundId:'different'}),/reused/);
  assert.throws(()=>openBonusChest(state,{id:'answer:10',chestId:'bonus:answer:10',at}),/reused/);
});

test('rarity thresholds have exact boundary behaviour',()=>{
  for(const [draw,expected] of [[0,'shiny'],[.022499999,'shiny'],[.0225,'gold'],[.127499999,'gold'],
    [.1275,'silver'],[.377499999,'silver'],[.3775,'classic'],[.999999999,'classic']])
    assert.equal(rollBonusRarity(draw),expected);
});

test('10,000 deterministic equal bins reproduce the exact rarity percentages',()=>{
  const counts={classic:0,silver:0,gold:0,shiny:0};
  for(let n=0;n<10000;n++) counts[rollBonusRarity((n+.5)/10000)]++;
  assert.deepEqual(counts,{classic:6225,silver:2500,gold:1050,shiny:225});
  assert.deepEqual(counts,BONUS_RARITY_WEIGHTS);assert.equal(Object.values(counts).reduce((a,b)=>a+b),10000);
});

test('country selection is deterministic and uniform over the supplied catalog',()=>{
  const counts={FRA:0,JPN:0,USA:0};
  for(let n=0;n<300;n++) counts[pickBonusCard(catalog,(n+.5)/300,.5).iso]++;
  assert.deepEqual(counts,{FRA:100,JPN:100,USA:100});
  assert.deepEqual(pickBonusCard(catalog,0,0),{iso:'FRA',rarity:'shiny'});
  assert.equal(pickBonusCard(catalog,.999999,.5).iso,'USA');
});

test('draws and catalogs are validated without changing the input state',()=>{
  for(const draw of [-.1,1,NaN,Infinity,null,'0']) assert.throws(()=>rollBonusRarity(draw),TypeError);
  for(const list of [[],['FRA','FRA'],['fra'],['FRA',null],null]) assert.throws(()=>pickBonusCard(list,0,0),TypeError);
  assert.throws(()=>pickBonusCard(catalog,1,0),TypeError);
  const state=freeze(run(9).state),before=JSON.stringify(state);
  assert.throws(()=>apply(state,10,{rarityDraw:1}),TypeError);assert.equal(JSON.stringify(state),before);
  assert.equal(apply(createBonusState(),1,{countryDraw:undefined,rarityDraw:undefined}).state.progress,1);
});

test('opening days later emits the fixed card credit once, without consuming quota',()=>{
  const earned=run(10).state,id='bonus:answer:10',later=Date.parse('2030-01-01T00:00:00Z');
  const opening={id:'opening:1',chestId:id,at:later};
  const result=openBonusChest(earned,opening);
  assert.equal(result.status,'opened');assert.deepEqual(result.chest.card,earned.chests[id].card);
  assert.deepEqual(result.credit,{id:'credit:'+id,chestId:id,iso:'FRA',rarity:'classic',acquiredAt:later});
  assert.equal(result.chest.earnedAt,at);assert.equal(result.chest.earnedDay,'2026-10-08');
  assert.deepEqual(result.state.grantsByDay,earned.grantsByDay);assert.equal(result.state.progress,earned.progress);
  const replay=openBonusChest(result.state,{...opening,at:later+1000});
  assert.equal(replay.status,'duplicate');assert.strictEqual(replay.state,result.state);assert.equal(replay.credit,null);
  const doubleClick=openBonusChest(result.state,{...opening,id:'opening:2'});
  assert.equal(doubleClick.status,'already-open');assert.equal(doubleClick.credit,null);
});

test('opening multiple older chests does not affect the new day quota',()=>{
  let state=run(20).state;const credits=[];
  for(const [n,chestId] of Object.keys(state.chests).entries()) {
    const result=openBonusChest(state,{id:`opening:${n}`,chestId,at:nextDay});state=result.state;credits.push(result.credit);
  }
  assert.equal(credits.length,2);assert.equal(new Set(credits.map(c=>c.id)).size,2);
  assert.equal(bonusProgress(state,nextDay).obtained,0);
  state=run(20,state,21,{at:nextDay}).state;assert.equal(chestCount(state),4);
});

test('opening identifiers cannot be redirected to another chest',()=>{
  let state=run(20).state;
  state=openBonusChest(state,{id:'open:1',chestId:'bonus:answer:10',at}).state;
  assert.throws(()=>openBonusChest(state,{id:'open:1',chestId:'bonus:answer:20',at}),/reused/);
  const already=openBonusChest(state,{id:'open:2',chestId:'bonus:answer:10',at});
  assert.throws(()=>openBonusChest(already.state,{id:'open:2',chestId:'bonus:answer:20',at}),/reused/);
});

test('unknown chests and openings before attribution fail without altering state',()=>{
  const state=freeze(run(10).state),before=JSON.stringify(state);
  assert.throws(()=>openBonusChest(state,{id:'open:1',chestId:'unknown',at}),/Unknown/);
  assert.throws(()=>openBonusChest(state,{id:'open:1',chestId:'bonus:answer:10',at:at-1}),/precedes/);
  assert.equal(JSON.stringify(state),before);
});

test('all transitions accept frozen inputs and do not mutate previous snapshots',()=>{
  const state=freeze(run(9).state),command=freeze(answer(10)),countries=freeze([...catalog]);
  const before=JSON.stringify(state),result=applyBonusAnswer(state,command,countries);
  assert.equal(JSON.stringify(state),before);assert.equal(chestCount(state),0);assert.equal(chestCount(result.state),1);
  const earned=freeze(result.state),copy=JSON.stringify(earned);
  const opened=openBonusChest(earned,freeze({id:'open:1',chestId:result.chest.id,at:nextDay}));
  assert.equal(JSON.stringify(earned),copy);assert.equal(earned.chests[result.chest.id].openedAt,null);
  assert.equal(opened.chest.openedAt,nextDay);
});

test('long and prototype-like stable IDs remain unique and addressable',()=>{
  for(const id of ['constructor','toString','a'.repeat(160)]) {
    const result=apply(run(9).state,10,{id,roundId:id});
    assert.equal(result.chest.id,'bonus:'+id);
    assert.equal(openBonusChest(result.state,{id:'open:'+id.slice(0,150),chestId:result.chest.id,at}).status,'opened');
  }
});

test('invalid versions, progress, quotas, timestamps and command IDs fail explicitly',()=>{
  for(const state of [null,{...createBonusState(),version:2},{...createBonusState(),progress:10},
    {...createBonusState(),grantsByDay:{'2026-10-08':3}},{...createBonusState(),operations:[]}])
    assert.throws(()=>apply(state,1),TypeError);
  for(const time of [null,NaN,Infinity,-1,1.5,253402300800000]) assert.throws(()=>bonusUTCDate(time),TypeError);
  for(const id of ['',null,'unsafe space','a'.repeat(161),'__proto__']) assert.throws(()=>apply(createBonusState(),1,{id}),TypeError);
  assert.throws(()=>apply(createBonusState(),1,{correct:1}),TypeError);
});


test('practice and both challenge commands share progress, quotas and stable receipts',()=>{
 let state=createBonusState();
 for(let n=1;n<=20;n++)state=apply(state,n,{mode:n%3===0?'challenge':n%2===0?'game':'practice'}).state;
 assert.equal(chestCount(state),2);assert.equal(state.grantsByDay['2026-10-08'],2);
 assert.equal(apply(state,21,{mode:'game'}).state.progress,0);
 const resumed=apply(state,22,{mode:'challenge',at:nextDay});assert.equal(resumed.state.progress,1);
 const duplicate=apply(resumed.state,22,{mode:'challenge',at:nextDay+1000});assert.equal(duplicate.status,'duplicate');
 assert.throws(()=>apply(resumed.state,22,{mode:'practice'}),/reused/);
 const wrong=apply(resumed.state,23,{mode:'practice',correct:false,at:nextDay});assert.equal(wrong.state.progress,0);
});

test('custom lists neither increment nor reset; legacy practice receipts remain replayable',()=>{
 const state=run(7).state;
 for(const mode of ['practice','game','challenge'])for(const correct of [true,false]){
  assert.equal(isBonusEligibleMode(mode,true),false);
  assert.strictEqual(apply(state,8,{mode,custom:true,correct}).state,state);
 }
 const legacy=structuredClone(state);delete legacy.operations['answer:7'].mode;
 assert.equal(apply(legacy,7).status,'duplicate');
 assert.throws(()=>apply(legacy,7,{mode:'game'}),/reused/);
});
