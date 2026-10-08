import {currentSave} from './save-fixtures.mjs';
import {applyBonusAnswer} from '../bonus-rules.mjs';

export async function testRepository({newContext,url,check,equal}) {
  const ctx=await newContext({locale:'fr-FR'}),at=Date.parse('2026-10-08T12:00:00Z'),tomorrow=Date.parse('2026-10-09T00:00:00Z');
  const catalog=['FRA','JPN','USA'];let sequence=0;
  const command=(n,extra={})=>({id:`answer:${n}`,roundId:`round:${n}`,mode:'practice',correct:true,at,countryDraw:0,rarityDraw:.5,...extra});
  const call=(p,method,...args)=>p.evaluate(({method,args})=>window.repo[method](...args),{method,args});
  const attempt=(p,method,...args)=>p.evaluate(async({method,args})=>{
    try {return {result:await window.repo[method](...args)};}
    catch(error) {return {error:{name:error.name,code:error.code,committed:error.committed,cause:error.cause?.name}};}
  },{method,args});
  let p,q;
  async function setup() {
    const name=`geofact-repository-test-${++sequence}`;
    for(const page of [p,q]) await page.evaluate(async({url,name})=>{
      window.repo?.close();window.rewardModule=await import(url+'reward-repository.mjs');
      window.databaseName=name;window.repo=await rewardModule.openRewardRepository({name});
    },{url,name});
    return name;
  }
  async function feed(page,count,start=1,extra={}) {
    for(let n=start;n<start+count;n++) await call(page,'answer',command(n,extra),catalog);
  }
  async function coherent(page,label) {
    const snapshot=await call(page,'read'),chests=Object.values(snapshot.bonus.chests),quotas={};
    const expected={},credits=Object.values(snapshot.credits);
    for(const chest of chests) {
      quotas[chest.earnedDay]=(quotas[chest.earnedDay]||0)+1;
      if(chest.openedAt!==null) {
        const key=chest.card.iso+':'+chest.card.rarity;expected[key]=(expected[key]||0)+1;
        check(credits.some(c=>c.chestId===chest.id && c.iso===chest.card.iso && c.rarity===chest.card.rarity),label+': open chest has its credit');
      } else check(!credits.some(c=>c.chestId===chest.id),label+': sealed chest has no credit');
    }
    equal(snapshot.bonus.grantsByDay,quotas,label+': quotas equal attributed chests');
    check(Object.values(quotas).every(n=>n<=2),label+': daily quota never exceeded');
    equal(credits.length,chests.filter(c=>c.openedAt!==null).length,label+': exactly one credit per open chest');
    const actual={};
    for(const [iso,entry] of Object.entries(snapshot.collection)) for(const [rarity,count] of Object.entries(entry.counts)) actual[iso+':'+rarity]=count;
    equal(actual,expected,label+': collection copies equal credits');
    return snapshot;
  }
  try {
    await ctx.addInitScript(({seed,origin})=>{
      if(location.origin===origin && localStorage.length===0)
        for(const [key,value] of Object.entries(seed)) localStorage.setItem(key,value);
    },{seed:currentSave,origin:new URL(url).origin});
    p=await ctx.newPage();q=await ctx.newPage();
    for(const page of [p,q]) await page.goto(url+'tests/repository-harness.html');
    console.log('  IndexedDB: real connections, concurrency and atomic credits');
    await setup();
    const schema=await p.evaluate(()=>new Promise((resolve,reject)=>{
      const r=indexedDB.open(databaseName);r.onerror=()=>reject(r.error);r.onsuccess=()=>{
        const db=r.result;const result={version:db.version,stores:[...db.objectStoreNames]};db.close();resolve(result);
      };
    }));
    equal(schema,{version:1,stores:['chests','sessions','state']},'explicit schema and three stores');
    const empty=await coherent(p,'empty repository');equal(empty.bonus.progress,0,'empty progress');
    await feed(p,9);
    const same=await Promise.all([call(p,'answer',command('same'),catalog),call(q,'answer',command('same'),catalog)]);
    equal(same.map(r=>r.status).sort(),['applied','duplicate'],'same operation concurrently applied once');
    let snapshot=await coherent(q,'same operation');equal(snapshot.bonus.progress,0,'tenth answer resets progress');
    equal(Object.keys(snapshot.bonus.chests).length,1,'one attribution');
    const chest=Object.values(snapshot.bonus.chests)[0];
    const opening=await Promise.all([call(p,'openChest',{id:'open:A',chestId:chest.id,at}),call(q,'openChest',{id:'open:B',chestId:chest.id,at})]);
    equal(opening.map(r=>r.status).sort(),['already-open','opened'],'same chest opened concurrently once');
    equal(opening.filter(r=>r.credit).length,1,'one committed credit response');
    snapshot=await coherent(q,'simultaneous openings');equal(snapshot.collection.FRA.counts.classic,1,'single copy');

    await setup();await feed(p,9);
    const sameRound=await Promise.all([
      call(p,'answer',command('A',{roundId:'shared-round'}),catalog),call(q,'answer',command('B',{roundId:'shared-round'}),catalog)
    ]);
    equal(sameRound.map(r=>r.status).sort(),['applied','ignored'],'same round with different action IDs counts once');
    snapshot=await coherent(q,'same round');equal(snapshot.bonus.progress,0,'same round no extra progress');

    await setup();await feed(p,9);
    const different=await Promise.all([call(p,'answer',command('A'),catalog),call(q,'answer',command('B'),catalog)]);
    equal(different.filter(r=>r.chest).length,1,'two threshold contenders create only one chest');
    snapshot=await coherent(q,'two distinct threshold answers');equal(snapshot.bonus.progress,1,'second distinct round advances next block');
    await feed(p,8,20);
    await Promise.all([call(p,'answer',command('cap:A'),catalog),call(q,'answer',command('cap:B'),catalog)]);
    snapshot=await coherent(q,'concurrent second quota');equal(snapshot.bonus.progress,0,'second award suspends progress');
    equal(snapshot.bonus.grantsByDay['2026-10-08'],2,'daily maximum two');
    await feed(q,10,100);equal((await call(p,'read')).bonus.progress,0,'no banked progression while capped');
    await coherent(p,'capped answers');
    const capped=await call(p,'read'),pending=Object.values(capped.bonus.chests);
    await Promise.all([call(p,'openChest',{id:'different:open:A',chestId:pending[0].id,at}),call(q,'openChest',{id:'different:open:B',chestId:pending[1].id,at})]);
    snapshot=await coherent(q,'different concurrent openings');equal(snapshot.collection.FRA.counts.classic,2,'two simultaneous credits both retained');

    await setup();await feed(p,9);const base=await call(p,'read');
    const contenders=[command('wrong',{correct:false}),command('correct')];
    const outcomes=await Promise.all(contenders.map(async(c,n)=>({command:c,result:await call(n?p:q,'answer',c,catalog)})));
    let expectedModel=base.bonus;
    for(const item of outcomes.sort((a,b)=>a.result.revision-b.result.revision)) expectedModel=applyBonusAnswer(expectedModel,item.command,catalog).state;
    snapshot=await coherent(p,'concurrent wrong and correct');equal(snapshot.bonus,expectedModel,'mixed answers follow one serial pure-rule order');

    console.log('  IndexedDB: aborted writes and lost acknowledgement');
    await setup();await feed(p,9);const before=await call(q,'read');
    await p.evaluate(async()=>{
      repo.close();window.observedUncommitted=false;
      window.repo=await rewardModule.openRewardRepository({name:databaseName,transactionProbe:({stage,transaction})=>{
        if(stage==='staged' && transaction.mode==='readwrite') {
          const request=transaction.objectStore('state').get('rewards');
          request.onsuccess=()=>{window.observedUncommitted=request.result.progress===0;transaction.abort();};
        }
      }});
    });
    const aborted=await attempt(p,'answer',command(10),catalog);
    equal(aborted.error.code,'ABORTED','abort rejects rather than reports reward');
    equal(aborted.error.committed,false,'abort explicitly uncommitted');
    check(await p.evaluate(()=>observedUncommitted),'abort occurs after queued writes succeeded');
    equal(await call(q,'read'),before,'progress, quota, chest and receipts rolled back together');
    await coherent(q,'aborted attribution');
    const recovered=await call(q,'answer',command(10),catalog);check(!!recovered.chest,'retry of aborted command can grant');

    await p.evaluate(async()=>{
      repo.close();window.repo=await rewardModule.openRewardRepository({name:databaseName,transactionProbe:({stage,transaction})=>{
        if(stage==='staged' && transaction.mode==='readwrite') transaction.abort();
      }});
    });
    const earned=await call(q,'read');
    equal((await attempt(p,'openChest',{id:'abort:open',chestId:recovered.chest.id,at})).error.code,'ABORTED','opening abort rejects');
    equal(await call(q,'read'),earned,'opening rolls back card credit and opened flag together');
    await coherent(q,'aborted opening');

    await p.evaluate(async()=>{
      repo.close();window.repo=await rewardModule.openRewardRepository({name:databaseName,transactionProbe:({stage,transaction})=>{
        if(stage==='staged' && transaction.mode==='readwrite') transaction.objectStore('state').add({id:'rewards'});
      }});
    });
    const constraint=await attempt(p,'openChest',{id:'constraint:open',chestId:recovered.chest.id,at});
    equal(constraint.error.code,'CONSTRAINT_ERROR','native request error rejects the transaction');
    equal(await call(q,'read'),earned,'native request failure rolls back all writes');await coherent(q,'native constraint failure');

    await setup();await feed(p,9);
    await p.evaluate(async()=>{
      repo.close();window.repo=await rewardModule.openRewardRepository({name:databaseName,transactionProbe:({stage,transaction})=>{
        if(stage==='committed' && transaction.mode==='readwrite') throw new Error('Simulated lost acknowledgement');
      }});
    });
    const lost=await attempt(p,'answer',command(10,{countryDraw:.5,rarityDraw:.0225}),catalog);
    equal(lost.error.code,'ACKNOWLEDGEMENT_FAILED','lost acknowledgement does not announce success');
    equal(lost.error.committed,true,'known completed commit is distinguished');
    snapshot=await coherent(q,'committed without acknowledgement');
    equal(Object.values(snapshot.bonus.chests)[0].card,{iso:'JPN',rarity:'gold'},'card persisted before acknowledgement');
    const retry=await call(q,'answer',command(10,{countryDraw:.9,rarityDraw:0,at:tomorrow}),catalog);
    equal(retry.status,'duplicate','recovery does not reattribute');equal(retry.chest.card,{iso:'JPN',rarity:'gold'},'recovery never rerolls');
    await coherent(q,'attribution recovery');
    const lostOpen=await attempt(p,'openChest',{id:'lost:open',chestId:retry.chest.id,at});
    equal(lostOpen.error.code,'ACKNOWLEDGEMENT_FAILED','lost opening acknowledgement rejects');
    const reopen=await call(q,'openChest',{id:'lost:open',chestId:retry.chest.id,at:tomorrow});
    equal(reopen.status,'duplicate','opening recovery idempotent');equal(reopen.credit,null,'opening recovery emits no second credit');
    await coherent(q,'opening recovery');

    console.log('  IndexedDB: storage errors, reload, export and UTC');
    await setup();await feed(p,9);const quotaBefore=await call(q,'read');
    await p.evaluate(async()=>{
      repo.close();window.repo=await rewardModule.openRewardRepository({name:databaseName,transactionProbe:({stage,transaction})=>{
        if(stage==='staged' && transaction.mode==='readwrite') throw new DOMException('Injected quota error','QuotaExceededError');
      }});
    });
    equal((await attempt(p,'answer',command(10),catalog)).error.code,'QUOTA_EXCEEDED','quota failure classified');
    equal(await call(q,'read'),quotaBefore,'quota failure retains complete old state');await coherent(q,'quota failure');
    const unavailable=await p.evaluate(async()=>{
      const errors=[];
      for(const factory of [null,{open(){throw new DOMException('Storage denied','SecurityError');}}]) {
        try {await rewardModule.openRewardRepository({name:'denied-test',indexedDB:factory});}
        catch(error) {errors.push(error.code);}
      }
      return errors;
    });
    equal(unavailable,['STORAGE_UNAVAILABLE','STORAGE_UNAVAILABLE'],'absent and forbidden storage clearly rejected');

    await setup();await feed(p,10);const sealed=await call(q,'read');
    await p.close();p=await ctx.newPage();await p.goto(url+'tests/repository-harness.html');
    await p.evaluate(async({url,name})=>{
      window.rewardModule=await import(url+'reward-repository.mjs');window.databaseName=name;
      window.repo=await rewardModule.openRewardRepository({name});
    },{url,name:await q.evaluate(()=>databaseName)});
    equal(await call(p,'read'),sealed,'new page recovers sealed chest and progress');
    const persisted=Object.values(sealed.bonus.chests)[0];
    await call(p,'openChest',{id:'later:open',chestId:persisted.id,at:tomorrow});
    snapshot=await coherent(q,'next-day opening');equal(snapshot.bonus.grantsByDay['2026-10-09'],undefined,'opening uses no new-day quota');
    equal(snapshot.bonus.chests[persisted.id].card,persisted.card,'card fixed across reload and midnight');
    await feed(q,10,11,{at:tomorrow});snapshot=await coherent(p,'next-day attribution');
    equal(snapshot.bonus.grantsByDay,{'2026-10-08':1,'2026-10-09':1},'separate UTC quotas');
    const second=Object.values(snapshot.bonus.chests).find(c=>c.openedAt===null);
    await call(q,'openChest',{id:'second:open',chestId:second.id,at:tomorrow+1234});
    snapshot=await coherent(p,'duplicate card variant');equal(snapshot.collection.FRA.counts.classic,2,'copies accumulate without lost update');
    equal(snapshot.collection.FRA.firstUnlocked,'2026-10-09','first acquisition retained');
    equal(snapshot.collection.FRA.acquiredAt.classic,tomorrow,'existing rarity acquisition timestamp retained');
    const exported=await call(p,'export');equal(exported.state,snapshot,'export is a consistent complete snapshot');
    equal([exported.format,exported.version,exported.databaseVersion],['geofact-reward-export',1,1],'export explicitly versioned');
    await p.evaluate(async()=>{const x=await repo.read();x.bonus.progress=8;x.collection.FRA.counts.classic=999;});
    equal(await call(q,'read'),snapshot,'editing returned snapshot cannot mutate database');
    const conflict=await attempt(p,'answer',command(10,{correct:false}),catalog);
    equal(conflict.error.code,'INVALID_COMMAND','conflicting operation reuse rejected');equal(await call(q,'read'),snapshot,'invalid command makes no write');
    await coherent(q,'command conflict');

    // Exercise rarity boundaries through the repository, without sampling randomness.
    await setup();
    const expected=['shiny','gold','silver','classic'],draws=[0,.0225,.1275,.3775];
    const actual=[];
    for(let n=0;n<4;n++) {
      await feed(p,10,n*10+1,{at:at+n*86400000,rarityDraw:draws[n]});
      const state=await coherent(q,'rarity '+expected[n]);actual.push(state.bonus.chests[`bonus:answer:${n*10+10}`].card.rarity);
    }
    equal(actual,expected,'repository preserves pure-rule rarity boundaries');

    const closedBefore=await call(q,'read');await call(p,'close');
    equal((await attempt(p,'answer',command(100),catalog)).error.code,'CLOSED','closed connection cannot confirm writes');
    equal(await call(q,'read'),closedBefore,'before-transaction interruption changes nothing');
    await coherent(q,'closed connection');
    // Native future-version upgrade must close current connections; no silent downgrade.
    await q.evaluate(()=>new Promise((resolve,reject)=>{
      const r=indexedDB.open(databaseName,2);r.onerror=()=>reject(r.error);r.onsuccess=()=>{r.result.close();resolve();};
    }));
    equal((await attempt(q,'read')).error.code,'CLOSED','versionchange closes old connection');
    const newer=await p.evaluate(async()=>{
      try {await rewardModule.openRewardRepository({name:databaseName});}catch(error){return error.code;}
    });equal(newer,'INCOMPATIBLE_SCHEMA','newer schema never reset or downgraded');

    await setup();const corrupt=await p.evaluate(()=>new Promise((resolve,reject)=>{
      const r=indexedDB.open(databaseName);r.onerror=()=>reject(r.error);r.onsuccess=()=>{
        const db=r.result,tx=db.transaction('state','readwrite');
        tx.objectStore('state').delete('rewards');tx.oncomplete=()=>{db.close();resolve(true);};tx.onabort=()=>reject(tx.error);
      };
    }));check(corrupt,'native corruption fixture applied');
    equal((await attempt(p,'read')).error.code,'CORRUPT_STATE','missing state is not silently reset');
    equal((await attempt(q,'answer',command(1),catalog)).error.code,'CORRUPT_STATE','corrupt state prevents all attribution');

    for(const page of [p,q]) equal(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),currentSave,'repository never changes any existing save key or byte');
  } finally {await ctx.close();}
}
