const test=require('node:test');
const assert=require('node:assert/strict');
const {createLanguagePreference}=require('../preferences.js');
const {createPublicTelemetry,VISITOR_KEY}=require('../public-statistics.js');
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),data};};
const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
const first='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',second='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('browser language is the initial fallback; explicit choice survives a new visit',()=>{
 const store=memory();const p=createLanguagePreference(store,'fr-CA');assert.equal(p.get(),'fr');p.set('en');
 assert.equal(store.getItem('wg-lang'),'en');assert.equal(createLanguagePreference(store,'fr-FR').get(),'en');
 const q=createLanguagePreference(store,'en-US');q.set('fr');assert.equal(createLanguagePreference(store,'en-US').get(),'fr');
 q.set('de');assert.equal(q.get(),'fr');
});
test('invalid saved language and unavailable storage have a usable in-memory fallback',()=>{
 const store=memory();store.setItem('wg-lang','unknown');assert.equal(createLanguagePreference(store,'en-US').get(),'en');
 const p=createLanguagePreference(denied,'fr');p.set('en');assert.equal(p.get(),'en');
});
test('one persistent visitor is reused after reload and in another tab',async()=>{
 const storage=memory(),sent=[];let creates=0;
 const options={storage,uuid:()=>{creates++;return first;},send:body=>sent.push(body)};
 const a=createPublicTelemetry(options);await a.recordEvent('visit');await a.recordEvent('game_started');
 const b=createPublicTelemetry({...options,uuid:()=>second});await b.recordEvent('visit');
 assert.equal(creates,1);assert.equal(new Set(sent.map(x=>x.p_visitor_id)).size,1);assert.equal(JSON.parse(storage.getItem(VISITOR_KEY)),first);
 assert.equal(sent.length,3,'reload is an event, not a new visitor');
});
test('concurrent first tabs serialize identity creation using Web Locks',async()=>{
 const storage=memory(),sent=[];let tail=Promise.resolve(),creates=0;
 const locks={request(name,callback){assert.equal(name,'geofact-anonymous-visitor');const job=tail.then(callback);tail=job.catch(()=>{});return job;}};
 const a=createPublicTelemetry({storage,locks,uuid:()=>{creates++;return first;},send:b=>sent.push(b)});
 const b=createPublicTelemetry({storage,locks,uuid:()=>{creates++;return second;},send:b=>sent.push(b)});
 await Promise.all([a.recordEvent('visit'),b.recordEvent('visit')]);assert.equal(creates,1);assert.deepEqual(sent.map(x=>x.p_visitor_id),[first,first]);
});
test('unavailable or non-persistent storage cannot generate ephemeral public visitors',async()=>{
 for(const storage of [denied,null,{getItem:()=>null,setItem(){}}]){
  const sent=[];const t=createPublicTelemetry({storage,uuid:()=>first,send:b=>sent.push(b)});
  await t.recordEvent('visit');await t.recordEvent('game_started');assert.deepEqual(sent,[]);
 }
});
test('malformed existing identity remains untouched and telemetry network/lock failures are harmless',async()=>{
 const store=memory();store.setItem(VISITOR_KEY,'{broken');let sends=0;
 const t=createPublicTelemetry({storage:store,uuid:()=>first,send:()=>sends++});await t.recordEvent('visit');
 assert.equal(sends,0);assert.equal(store.getItem(VISITOR_KEY),'{broken');
 const failed=createPublicTelemetry({storage:memory(),uuid:()=>first,send:()=>Promise.reject(new Error('offline'))});await assert.doesNotReject(()=>failed.recordEvent('visit'));
 const lockFailed=createPublicTelemetry({storage:memory(),locks:{request(){throw new Error('denied');}},uuid:()=>first,send:()=>sends++});await lockFailed.recordEvent('visit');assert.equal(sends,0);
});
