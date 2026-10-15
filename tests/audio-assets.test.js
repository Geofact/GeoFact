const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const sound=require('../sound.js'),music=require('../music.js');
const {SOUND_KEY,MUSIC_KEY,EFFECTS_KEY,createSoundEffects}=sound;
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const memory=(data={})=>{const values=new Map(Object.entries(data));return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
function device(state='suspended'){
 const nodes=[],gains=[],oscillators=[];let resumes=0;
 const param=()=>({events:[],setValueAtTime(v,t){this.events.push([v,t]);},linearRampToValueAtTime(v,t){this.events.push([v,t]);},exponentialRampToValueAtTime(v,t){this.events.push([v,t]);}});
 const ctx={state,currentTime:10,sampleRate:44100,destination:{},resume(){resumes++;ctx.state='running';return Promise.resolve();},
  createBuffer:(channels,length,rate)=>({duration:length/rate,length}),
  createBufferSource(){const n={loop:false,connect(target){this.target=target;},disconnect(){this.disconnected=true;},start(when=0,offset=0){this.when=when;this.offset=offset;this.started=true;},stop(){this.stopped=true;}};nodes.push(n);return n;},
  createGain(){const n={gain:param(),connect(){},disconnect(){this.disconnected=true;}};gains.push(n);return n;},
  createOscillator(){const n={frequency:param(),connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};oscillators.push(n);return n;}
 };
 const buffers=new Map();const loadBuffer=async url=>{if(!buffers.has(url))buffers.set(url,{url,duration:url.endsWith('.mp3')?73.84615625:3.2});return buffers.get(url);};
 const options={loadBuffer,createContext:()=>ctx,createMusic:(c,o)=>music.createAdventureMusic(c,o)};
 return {ctx,nodes,gains,oscillators,buffers,loadBuffer,options,resumes:()=>resumes};
}
const sampled=d=>d.nodes.filter(n=>n.buffer?.url);
const loops=d=>sampled(d).filter(n=>n.loop);
const effects=d=>sampled(d).filter(n=>!n.loop);
test('the four supplied files are byte-identical, with no normalization or re-encoding',()=>{
 const hashes={'GeoFact-Bonne-reponse.wav':'8bca86e7de4cc48b339a9b7092b5d41995ceeb0bc19e3841c92ed986feb160d4','GeoFact-Mauvaise-reponse.wav':'b0471d58646115c3dced97cbbb3d525c238203b95a4575ec4b89cb372dcce89e','GeoFact-Coffre-scintillant.wav':'393c08e55d3e0e207a72479e66bdbe551d444bc9419cc31c762a767bf68f9b82','GeoFact-Braise-Aventure-boucle.mp3':'2ee04e8a6bbfd3d0b544407199240abc464c42831adbd952c40529b60b03f33a'};
 for(const [file,hash]of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/audio/'+file,'file://'+__filename))).digest('hex'),hash);
});
test('legacy on/off/default migrate independently without changing existing saves',()=>{
 for(const legacy of ['off','on',undefined]){
  const data={'wg-stats':'saved stats','gf-collection-v1':'collection','custom-volume':'0.22'};if(legacy)data[SOUND_KEY]=legacy;
  const storage=memory(data),s=createSoundEffects({storage});
  assert.equal(s.isMusicEnabled(),legacy!=='off');assert.equal(s.isEffectsEnabled(),legacy!=='off');
  assert.equal(storage.getItem(MUSIC_KEY),legacy==='off'?'off':'on');assert.equal(storage.getItem(EFFECTS_KEY),legacy==='off'?'off':'on');
  for(const [k,v]of Object.entries(data))assert.equal(storage.getItem(k),v);
  assert.equal(storage.getItem(SOUND_KEY),legacy??null);
 }
});
test('all four choices persist independently and take precedence over the legacy flag',()=>{
 for(const m of [false,true])for(const f of [false,true]){
  const storage=memory({[SOUND_KEY]:'off'}),s=createSoundEffects({storage});s.setMusicEnabled(m);s.setEffectsEnabled(f);
  const reload=createSoundEffects({storage});assert.equal(reload.isMusicEnabled(),m);assert.equal(reload.isEffectsEnabled(),f);assert.equal(reload.isEnabled(),m||f);assert.equal(storage.getItem(SOUND_KEY),'off');
 }
});
test('denied storage leaves working independent in-memory settings',()=>{
 const s=createSoundEffects({storage:{getItem(){throw Error();},setItem(){throw Error();}}});s.setMusicEnabled(false);assert.equal(s.isMusicEnabled(),false);assert.equal(s.isEffectsEnabled(),true);
});
test('no autoplay or context is created before a gesture; a muted gesture creates none',async()=>{
 const d=device();let created=0;const s=createSoundEffects({...d.options,storage:memory(),createContext:()=>{created++;return d.ctx;}});
 assert.equal(s.answer(true),false);assert.equal(created,0);assert.equal(d.nodes.length,0);
 s.setEnabled(false);s.unlock();assert.equal(created,0);s.setMusicEnabled(true);s.unlock();await flush();assert.equal(created,1);assert.equal(loops(d).length,1);
});
test('each combination gates only its category and uses unchanged reference gains',async()=>{
 assert.deepEqual(music.LEGACY_VOICE_GAINS,{lead:.036,bass:.040,pulse:.024});assert.equal(music.MUSIC_GAIN,.036);assert.equal(sound.EFFECT_GAIN,.035);
 for(const m of [false,true])for(const f of [false,true]){
  const d=device(),s=createSoundEffects({...d.options,storage:memory({[MUSIC_KEY]:m?'on':'off',[EFFECTS_KEY]:f?'on':'off'})});s.unlock();await flush();s.answer(true);await flush();
  assert.equal(loops(d).length,m?1:0);assert.equal(effects(d).length,f?1:0);
  if(m)assert.equal(loops(d)[0].target.gain.events[0][0],.036);
  if(f){assert.equal(effects(d)[0].target.gain.events[0][0],.035);assert.ok(effects(d)[0].buffer.url.endsWith('Bonne-reponse.wav'));assert.equal(d.oscillators.length,0);}
 }
});
test('muting effects cuts both active and scheduled sources, leaves music running and never replays them',async()=>{
 const d=device(),s=createSoundEffects({...d.options});s.unlock();await flush();s.answer(false);const chest=s.openChest({revealDelay:4.91});await flush();assert.equal(effects(d).length,2);
 s.setEffectsEnabled(false);assert.ok(effects(d).every(n=>n.stopped));assert.ok(!loops(d)[0].stopped);
 s.setEffectsEnabled(true);s.unlock();await flush();assert.equal(effects(d).length,2);chest.finish();
});
test('muting during decode and immediately re-enabling cannot play a past effect',async()=>{
 const d=device();let release;const loader=url=>url===music.MUSIC_URL?d.loadBuffer(url):new Promise(resolve=>{release=()=>resolve({url,duration:1});});
 const s=createSoundEffects({...d.options,loadBuffer:loader});s.unlock();await flush();s.answer(true);s.setEffectsEnabled(false);s.setEffectsEnabled(true);release();await flush();assert.equal(effects(d).length,0);
});
test('music uses one native loop, no restart timer, resumes its position and does not reset on repeated gestures',async()=>{
 const d=device('running'),m=music.createAdventureMusic(d.ctx,{loadBuffer:d.loadBuffer});m.start();m.start();await flush();const first=loops(d)[0];assert.equal(loops(d).length,1);assert.equal(first.loop,true);assert.equal(first.offset,0);
 d.ctx.currentTime=22;m.start();assert.equal(loops(d).length,1);m.stop();assert.ok(first.stopped);assert.equal(m.getPosition(),12);
 d.ctx.currentTime=150;m.start();await flush();assert.equal(loops(d).length,2);assert.equal(loops(d)[1].offset,12);assert.equal(loops(d).filter(n=>!n.stopped).length,1);
 m.dispose();m.start();await flush();assert.equal(loops(d).length,2);
 assert.ok(!/setInterval|setTimeout/.test(readFileSync(new URL('../music.js','file://'+__filename),'utf8')));
});
test('a music load finishing after mute cannot start playback, and loading twice creates one source',async()=>{
 const d=device('running');let release;const m=music.createAdventureMusic(d.ctx,{loadBuffer:()=>new Promise(resolve=>{release=()=>resolve({duration:20,url:'music.mp3'});})});m.start();await flush();m.stop();release();await flush();assert.equal(loops(d).length,0);m.start();m.start();assert.equal(loops(d).length,1);
});
test('background silences categories and foreground never resumes a suspended device without a gesture',async()=>{
 const d=device(),s=createSoundEffects({...d.options});s.unlock();await flush();s.answer(true);await flush();s.setVisible(false);assert.ok(sampled(d).every(n=>n.stopped));
 d.ctx.state='suspended';const before=d.resumes();s.setVisible(true);assert.equal(d.resumes(),before);assert.equal(loops(d).filter(n=>!n.stopped).length,0);
 s.unlock();await flush();assert.equal(d.resumes(),before+1);assert.equal(loops(d).filter(n=>!n.stopped).length,1);assert.equal(effects(d).length,1);
});
test('delayed Safari resume preserves only the current answer; a mute cancels queued audio',async()=>{
 for(const muted of [false,true]){
  const d=device();let finish;d.ctx.resume=()=>new Promise(resolve=>{finish=()=>{d.ctx.state='running';resolve();};});
  const s=createSoundEffects({...d.options});s.unlock();s.answer(true);if(muted)s.setEffectsEnabled(false);finish();await flush();assert.equal(effects(d).length,muted?0:1);
 }
});
test('the supplied chest sample is scheduled so its shimmer coincides with revelation, without changing speed or pitch',async()=>{
 const d=device(),s=createSoundEffects({...d.options});s.unlock();await flush();let valid=true;const chest=s.openChest({revealDelay:4.91,isCurrent:()=>valid});await flush();
 const node=effects(d)[0];assert.equal(node.buffer.url,sound.ASSETS.chest);assert.ok(Math.abs(node.when-(10+4.91-.55))<1e-9);assert.equal(node.offset,0);assert.equal(node.loop,false);
 valid=false;s.cancelInvalidChests();assert.equal(node.stopped,true);chest.cancel();
});
test('answer throttling remains; each supplied answer plays once at native playback settings',async()=>{
 const d=device();let at=0;const s=createSoundEffects({...d.options,now:()=>at});s.unlock();await flush();assert.equal(s.answer(false),true);assert.equal(s.answer(false),false);assert.equal(s.answer(true),true);await flush();assert.equal(effects(d).length,2);at=200;s.answer(false);await flush();assert.equal(effects(d).length,3);
});
test('other rarity notification melodies and their gains are retained unchanged',async()=>{
 const d=device(),s=createSoundEffects({...d.options});s.unlock();await flush();
 for(const rarity of ['classic','silver','gold','shiny'])assert.equal(s.reveal(rarity),true);
 assert.deepEqual(d.oscillators.map(n=>n.frequency.events[0][0]),[392,523,659,440,659,880,523,659,784,1047,659,784,988,1319]);
 const notificationGains=d.gains.filter(n=>n.gain.events.length===3);assert.ok(notificationGains.every(n=>n.gain.events[1][0]===.035));
});
test('missing audio, resume errors and closed devices do not interrupt game calls',async()=>{
 const d=device(),bad=createSoundEffects({...d.options,loadBuffer:()=>Promise.reject(Error('missing'))});bad.unlock();bad.answer(true);await flush();assert.equal(sampled(d).length,0);
 d.ctx.state='closed';const next=device();let count=0;const s=createSoundEffects({...next.options,createContext:()=>{count++;return count===1?d.ctx:next.ctx;}});s.unlock();s.unlock();await flush();assert.equal(count,2);
 const absent=createSoundEffects({createContext:()=>null});assert.doesNotThrow(()=>absent.unlock());
});
