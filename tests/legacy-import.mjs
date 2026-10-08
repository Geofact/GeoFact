import {currentSave,legacySave} from './save-fixtures.mjs';
export async function testLegacyImport({newContext,url,check,equal}) {
 const ctx=await newContext(),p=await ctx.newPage(),q=await ctx.newPage();let seq=0;
 const call=(page,method)=>page.evaluate(async method=>{
  try {return {result:await repo[method](...(method==='importLegacy'?[localStorage]:[]))};}
  catch(e){return {error:e.code,committed:e.committed};}
 },method);
 const read=async()=> (await call(p,'read')).result;
 const seed=async values=>p.evaluate(values=>{localStorage.clear();for(const [k,v] of Object.entries(values))localStorage.setItem(k,v);},values);
 async function setup(values=currentSave,probe=null) {
  await seed(values);const name='geofact-import-test-'+ ++seq;
  for(const page of [p,q])await page.evaluate(async({name,url,probe})=>{
   window.repo?.close();window.module=await import(url+'reward-repository.mjs');
   window.repo=await module.openRewardRepository({name,transactionProbe:probe?({stage,transaction})=>{
    if(probe==='abort'&&stage==='staged')transaction.objectStore('state').get('rewards').onsuccess=()=>transaction.abort();
    if(probe==='ack'&&stage==='committed')throw Error('lost acknowledgement');
   }:undefined});window.nameDB=name;
  },{name,url,probe:page===p?probe:null});
 }
 async function coherent(values,label) {
  const s=await read();equal(s.daily,JSON.parse(values['gf-daily-v1']),label+' Daily');
  equal(s.bonus.progress,0,label+' bonus progress');equal(s.bonus.grantsByDay,{},label+' quotas');
  equal(s.bonus.chests,{},label+' no extra chests');equal(s.credits,{},label+' no extra credits');
  equal(s.legacyImport.raw,Object.fromEntries(['gf-collection-v1','gf-daily-v1'].map(k=>[k,values[k]??null])),label+' original bytes');
  equal(await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))),values,label+' localStorage unchanged');return s;
 }
 try {
  for(const page of [p,q])await page.goto(url+'tests/repository-harness.html');
  console.log('  Legacy import: native atomic transactions and non-destructive saves');
  await setup();let outcomes=await Promise.all([call(p,'importLegacy'),call(q,'importLegacy')]);
  equal(outcomes.map(x=>x.result.status).sort(),['already-imported','imported'],'concurrent import once');
  let s=await coherent(currentSave,'current');equal(s.collection,JSON.parse(currentSave['gf-collection-v1']),'all copies and dates preserved');
  equal((await call(p,'importLegacy')).result.status,'already-imported','repeat idempotent');equal(await read(),s,'repeat changes nothing');
  await p.evaluate(async()=>{repo.close();repo=await module.openRewardRepository({name:nameDB});});equal(await read(),s,'reload retains import');
  await seed({...currentSave,'gf-collection-v1':'{' });equal((await call(p,'importLegacy')).error,'INVALID_LEGACY_SAVES','malformed source rejected');equal(await read(),s,'malformed cannot erase collection');
  await seed({...currentSave,'gf-collection-v1':'{}'});equal((await call(p,'importLegacy')).error,'INVALID_LEGACY_SAVES','partial incoherent save rejected');equal(await read(),s,'partial corruption preserves target');
  await seed({...currentSave,'gf-daily-v1':JSON.stringify({...s.daily,streak:2})});equal((await call(p,'importLegacy')).error,'LEGACY_SOURCE_CHANGED','old tab change detected on repeated import');equal(await read(),s,'changed source never auto merged');
  await setup(legacySave);equal((await call(p,'importLegacy')).result.status,'imported','legacy imported');s=await coherent(legacySave,'legacy');equal(s.collection.FRA.counts,{silver:1},'legacy one copy');equal(s.collection.FRA.firstUnlocked,'2026-10-01','legacy date');
  const sealed=structuredClone(currentSave),daily=JSON.parse(sealed['gf-daily-v1']);daily.days['2026-10-07'].cardOpened=false;sealed['gf-daily-v1']=JSON.stringify(daily);
  await setup(sealed);await call(p,'importLegacy');s=await coherent(sealed,'unrevealed');equal(s.collection,JSON.parse(sealed['gf-collection-v1']),'unrevealed card not credited twice');
  await setup(currentSave,'abort');const before=await (await call(q,'read')).result;
  equal((await call(p,'importLegacy')).error,'ABORTED','abort after staged writes reported');equal((await call(q,'read')).result,before,'aborted import atomic rollback');
  equal((await call(q,'importLegacy')).result.status,'imported','retry after interruption');
  await p.evaluate(async()=>{repo.close();repo=await module.openRewardRepository({name:nameDB});});await coherent(currentSave,'retry');
  await setup(currentSave,'ack');outcomes=await call(p,'importLegacy');equal(outcomes.error,'ACKNOWLEDGEMENT_FAILED','lost acknowledgement reported');check(outcomes.committed,'commit distinguished');
  equal((await call(q,'importLegacy')).result.status,'already-imported','after commit retry does not duplicate');
  await p.evaluate(async()=>{repo.close();repo=await module.openRewardRepository({name:nameDB});});await coherent(currentSave,'lost acknowledgement');
  await setup({});equal((await call(p,'importLegacy')).result.status,'no-data','absent saves no import');equal((await read()).revision,0,'absence does not consume import');await seed(currentSave);equal((await call(p,'importLegacy')).result.status,'imported','later saves can import');
  await setup();const denied=await p.evaluate(async()=>{try{await repo.importLegacy({getItem(){throw Error('denied');}});}catch(e){return e.code;}});equal(denied,'LEGACY_SOURCE_UNAVAILABLE','storage unavailable explicit');equal((await read()).revision,0,'unavailable source leaves empty target');
  const changed=await p.evaluate(async original=>{let n=0;try{await repo.importLegacy({getItem(k){return ++n>4&&k==='gf-daily-v1'?'{}':original[k];}});}catch(e){return e.code;}},currentSave);
  equal(changed,'LEGACY_SOURCE_CHANGED','source changed before write rejected');equal((await read()).revision,0,'changed source rollback');
  await p.evaluate(()=>repo.answer({id:'a',roundId:'r',mode:'practice',correct:true,at:1791460800000,countryDraw:0,rarityDraw:0},['FRA']));s=await read();equal((await call(p,'importLegacy')).error,'IMPORT_TARGET_NOT_EMPTY','active repository not overwritten');equal(await read(),s,'existing progress preserved');
 } finally {await ctx.close();}
}
