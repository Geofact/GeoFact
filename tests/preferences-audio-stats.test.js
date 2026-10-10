const test=require('node:test');
const assert=require('node:assert/strict');
const {createLanguagePreference}=require('../preferences.js');
const {createSoundEffects,SOUND_KEY}=require('../sound.js');
const {createPublicTelemetry,VISITOR_KEY}=require('../public-statistics.js');
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),data};};
const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
const first='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',second='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fakeAudio(){
 const nodes=[],notes=[];let resumes=0;
 const param=()=>({setValueAtTime(value,at){notes.push([value,at]);},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const audio={state:'suspended',currentTime:12,destination:{},resume(){resumes++;audio.state='running';return Promise.resolve();},
 createGain:()=>({gain:param(),connect(){},disconnect(){}}),
 createOscillator(){const n={frequency:param(),connect(){},disconnect(){},start(){n.started=true;},stop(){n.stops=(n.stops||0)+1;}};nodes.push(n);return n;}};
 return {audio,nodes,notes,resumes:()=>resumes};
}

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
test('sound defaults on but cannot play before a gesture unlocks its context',()=>{
 const f=fakeAudio();let creations=0;
 const sound=createSoundEffects({storage:memory(),createContext:()=>{creations++;return f.audio;}});
 assert.equal(sound.isEnabled(),true);assert.equal(sound.answer(true),false);assert.equal(creations,0);
 sound.unlock();assert.equal(creations,1);assert.equal(f.resumes(),1);assert.equal(sound.answer(true),true);assert.equal(f.nodes.length,4);
});
test('mute stops active sounds immediately, persists and can be restored without any reward writes',()=>{
 const store=memory(),f=fakeAudio();const sound=createSoundEffects({storage:store,createContext:()=>f.audio});
 sound.unlock();sound.reveal('shiny');assert.equal(f.nodes.length,4);sound.setEnabled(false);
 assert.ok(f.nodes.every(n=>n.stops===2));assert.equal(sound.reveal('gold'),false);assert.equal(store.getItem(SOUND_KEY),'off');
 assert.equal(createSoundEffects({storage:store}).isEnabled(),false);sound.setEnabled(true);assert.equal(store.getItem(SOUND_KEY),'on');
 assert.deepEqual([...store.data.keys()],[SOUND_KEY]);
});
test('rarity melodies differ and rapid wrong answers are throttled without suppressing a correct answer',()=>{
 const f=fakeAudio();let time=0;const s=createSoundEffects({storage:memory(),createContext:()=>f.audio,now:()=>time});s.unlock();
 assert.equal(s.answer(false),true);assert.equal(s.answer(false),false);assert.equal(s.answer(true),true);
 time=200;assert.equal(s.answer(false),true);
 for(const rarity of ['classic','silver','gold','shiny'])assert.equal(s.reveal(rarity),true);
 assert.ok(f.notes.some(([v])=>v===1319));assert.ok(f.notes.some(([v])=>v===1047));
});
test('suspended/interrupted Safari contexts resume only via unlock; audio errors never throw',()=>{
 const f=fakeAudio(),s=createSoundEffects({storage:denied,createContext:()=>f.audio});s.unlock();
 f.audio.state='interrupted';assert.equal(s.reveal('gold'),false);s.unlock();assert.equal(f.resumes(),2);assert.equal(s.reveal('gold'),true);
 const bad=createSoundEffects({createContext:()=>{throw new Error('audio denied');}});assert.doesNotThrow(()=>{bad.unlock();bad.answer(true);});
 const absent=createSoundEffects({createContext:()=>null});assert.doesNotThrow(()=>absent.unlock());
 f.audio.createOscillator=()=>{throw new Error('device gone');};assert.equal(s.answer(false),false);
});
test('storage-driven mute updates do not rewrite the shared preference',()=>{
 const store=memory(),s=createSoundEffects({storage:store});s.setEnabled(false,{persist:false});assert.equal(s.isEnabled(),false);assert.equal(store.getItem(SOUND_KEY),null);
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


test('a closed audio device is recreated on the next gesture',()=>{
 const first=fakeAudio(),replacement=fakeAudio();let creates=0;
 const sound=createSoundEffects({createContext:()=>++creates===1?first.audio:replacement.audio});
 sound.unlock();first.audio.state='closed';sound.unlock();assert.equal(creates,2);assert.equal(sound.answer(true),true);assert.ok(replacement.nodes.length>0);
});

test('an answer during asynchronous mobile resume is played once when ready',async()=>{
 const f=fakeAudio();let finish,resumes=0;
 f.audio.resume=()=>{resumes++;return new Promise(resolve=>{finish=()=>{f.audio.state='running';resolve();};});};
 const s=createSoundEffects({storage:memory(),createContext:()=>f.audio});s.unlock();s.unlock();
 assert.equal(resumes,1);assert.equal(s.answer(true),true);assert.equal(f.nodes.length,0);
 finish();await Promise.resolve();assert.equal(f.nodes.length,4);
 await Promise.resolve();assert.equal(f.nodes.length,4);
});
test('mute, failed resume and stale delayed sounds never produce late audio',async()=>{
 for(const scenario of ['mute','stale','failure']){
  const f=fakeAudio();let finish,time=0;
  f.audio.resume=()=>new Promise((resolve,reject)=>{finish=()=>{if(scenario==='failure')reject(new Error('denied'));else{f.audio.state='running';resolve();}};});
  const store=memory(),s=createSoundEffects({storage:store,createContext:()=>f.audio,now:()=>time});
  s.unlock();s.answer(true);if(scenario==='mute')s.setEnabled(false);if(scenario==='stale')time=501;
  finish();await Promise.resolve();await Promise.resolve();assert.equal(f.nodes.length,0,scenario);
  if(scenario==='mute')assert.equal(createSoundEffects({storage:store}).isEnabled(),false);
 }
});

test('correct-answer notification ends with a softer high sparkle within 300ms',()=>{
 const f=fakeAudio();const stops=[],levels=[];
 const createGain=f.audio.createGain;f.audio.createGain=()=>{const gain=createGain();gain.gain.linearRampToValueAtTime=value=>levels.push(value);return gain;};
 const oscillator=f.audio.createOscillator;
 f.audio.createOscillator=()=>{const n=oscillator();const stop=n.stop;n.stop=at=>{stops.push(at);stop();};return n;};
 const s=createSoundEffects({createContext:()=>f.audio});s.unlock();s.answer(true);
 assert.deepEqual(f.notes.filter(([value])=>value>1).map(([value])=>value),[784,988,1175,1568]);
 assert.ok(Math.max(...stops)-f.audio.currentTime<.300);
 assert.deepEqual(levels,[.035,.035,.035,.012]);
});

test('playback session is requested only during an enabled gesture and failures are optional',()=>{
 let calls=0;const store=memory(),f=fakeAudio();
 const s=createSoundEffects({storage:store,createContext:()=>f.audio,preparePlayback:()=>calls++});
 assert.equal(calls,0);s.answer(true);assert.equal(calls,0);s.unlock();assert.equal(calls,1);
 s.setEnabled(false);s.unlock();assert.equal(calls,1);
 const unavailable=createSoundEffects({createContext:()=>fakeAudio().audio,preparePlayback(){throw new Error('unsupported');}});
 assert.doesNotThrow(()=>unavailable.unlock());assert.equal(unavailable.answer(true),true);
});

test('mobile output priming starts a silent source inside the gesture and disconnects it',()=>{
 const f=fakeAudio(),events=[];let source;
 f.audio.createBuffer=(channels,length,rate)=>{events.push(['buffer',channels,length,rate]);return {};};
 f.audio.createBufferSource=()=>source={connect(){events.push('connect');},start(){events.push('start');},disconnect(){events.push('disconnect');}};
 const resume=f.audio.resume;f.audio.resume=()=>{events.push('resume');return resume();};
 const s=createSoundEffects({createContext:()=>f.audio});s.unlock();
 assert.deepEqual(events,[['buffer',1,1,44100],'connect','start','resume']);
 source.onended();assert.equal(events.at(-1),'disconnect');s.unlock();assert.equal(events.filter(x=>x==='start').length,1);
});

const musicModule=require('../music.js');
function musicDevice(){
 const f=fakeAudio();let time=0;f.audio.state='running';Object.defineProperty(f.audio,'currentTime',{get:()=>time});
 f.audio.createPeriodicWave=()=>({});
 const original=f.audio.createOscillator;
 f.audio.createOscillator=()=>{const n=original();n.setPeriodicWave=()=>{};n.start=at=>{n.at=at;};return n;};
 const timers=new Map();let id=0;
 const options={schedule(fn){timers.set(++id,fn);return id;},cancel:id=>timers.delete(id)};
 return {...f,options,timers,advance(value){time=value;for(const fn of [...timers.values()])fn();}};
}
test('original music has a 40-second form, gentle register and sparse percussion',()=>{
 assert.deepEqual(Object.fromEntries(['lead','bass','pulse'].map(voice=>[voice,[...new Set(musicModule.score.filter(n=>n.voice===voice).map(n=>n.level))]])),{lead:[.009],bass:[.010],pulse:[.006]});
 assert.equal(musicModule.LENGTH,40);assert.equal(musicModule.score.filter(n=>n.voice==='pulse').length,4);
 assert.ok(musicModule.score.every(n=>n.level<=.010&&n.at<40));
 assert.ok(musicModule.score.filter(n=>n.voice==='lead').every(n=>musicModule.frequency(n.midi)<=524));
 assert.notDeepEqual(musicModule.score.filter(n=>n.voice==='lead'&&n.at<20).map(n=>n.midi),musicModule.score.filter(n=>n.voice==='lead'&&n.at>=20).map(n=>n.midi));
});
test('music uses one scheduler, pauses at its position and never catches up with a burst',()=>{
 const f=musicDevice(),m=musicModule.createAdventureMusic(f.audio,f.options);m.start();m.start();assert.equal(f.timers.size,1);assert.equal(f.nodes.length,2);
 f.advance(2);assert.ok(f.nodes.length<=5,'only imminent notes are scheduled after a stalled clock');
 m.stop();assert.equal(f.timers.size,0);assert.ok(f.nodes.every(n=>n.stops>=2));
 const before=f.nodes.length;f.advance(30);m.start();m.start();assert.equal(f.timers.size,1);assert.ok(f.nodes.length-before<=3);
 f.audio.state='interrupted';f.advance(31);assert.equal(f.timers.size,0);assert.equal(m.isRunning(),false);
 f.audio.state='running';m.start();assert.equal(f.timers.size,1);m.dispose();m.start();assert.equal(f.timers.size,0);
});
test('same sound preference gates music and effects, visibility and suspended foreground',()=>{
 const f=musicDevice(),store=memory();f.audio.state='suspended';
 const s=createSoundEffects({storage:store,createContext:()=>f.audio,createMusic:c=>musicModule.createAdventureMusic(c,f.options)});
 assert.equal(f.timers.size,0);s.unlock();s.unlock();assert.equal(f.timers.size,1);
 const before=f.nodes.length;assert.equal(s.answer(true),true);assert.equal(f.nodes.length,before+4,'effects remain independently audible');
 s.setVisible(false);assert.equal(f.timers.size,0);assert.equal(s.answer(true),false);
 s.setVisible(true);assert.equal(f.timers.size,1);
 s.setVisible(false);f.audio.state='suspended';const resumes=f.resumes();s.setVisible(true);assert.equal(f.timers.size,0);assert.equal(f.resumes(),resumes,'foreground does not request unauthorized resume');
 s.unlock();assert.equal(f.timers.size,1);s.setEnabled(false);assert.equal(f.timers.size,0);assert.equal(store.getItem(SOUND_KEY),'off');
 s.unlock();assert.equal(f.timers.size,0);assert.equal(createSoundEffects({storage:store}).isEnabled(),false);
 for(let i=0;i<4;i++){s.setEnabled(true);s.unlock();assert.equal(f.timers.size,1);s.setEnabled(false);assert.equal(f.timers.size,0);}
});
test('failed or unavailable music cannot prevent effects or leak timers',()=>{
 const f=musicDevice();f.audio.createOscillator=()=>{throw new Error('device unavailable');};const m=musicModule.createAdventureMusic(f.audio,f.options);assert.doesNotThrow(()=>m.start());assert.equal(f.timers.size,0);
 const a=fakeAudio(),s=createSoundEffects({createContext:()=>a.audio,createMusic(){throw new Error('unsupported');}});s.unlock();assert.equal(s.answer(true),true);
});

test('the 40-second music seam schedules the next phrase once without restarting the timer',()=>{
 const f=musicDevice(),m=musicModule.createAdventureMusic(f.audio,f.options);m.start();f.advance(39.9);
 const seam=f.nodes.filter(n=>n.at>39.9);assert.equal(seam.length,2);assert.ok(seam.every(n=>Math.abs(n.at-40.03)<.001));
 const before=f.nodes.length;f.advance(40);m.start();assert.equal(f.nodes.length,before);assert.equal(f.timers.size,1);m.dispose();
});
