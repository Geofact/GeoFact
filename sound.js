(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GeoFactSound=api;
})(globalThis,function(){
  'use strict';
  const SOUND_KEY='gf-sound-v1',MUSIC_KEY='gf-music-v1',EFFECTS_KEY='gf-effects-v1';
  const EFFECT_GAIN=.0595; // .035 × 1.7
  const ASSETS=Object.freeze({correct:'assets/audio/GeoFact-Bonne-reponse.wav',wrong:'assets/audio/GeoFact-Mauvaise-reponse.wav',chest:'assets/audio/GeoFact-Coffre-scintillant.wav'});
  // The validated recording rises into its principal shimmer at 0.55 seconds.
  const CHEST_REVEAL_CUE=.55;
  // Preserve the other existing notifications; only answer/chest playback changes.
  const melodies=Object.freeze({
    classic:[[392,.09,0],[523,.10,.08],[659,.18,.16]],
    silver:[[440,.09,0],[659,.10,.08],[880,.20,.16]],
    gold:[[523,.09,0],[659,.10,.08],[784,.12,.16],[1047,.24,.25]],
    shiny:[[659,.08,0],[784,.08,.07],[988,.10,.14],[1319,.28,.23]]
  });
  function createBufferLoader(context,fetchAudio=globalThis.fetch?.bind(globalThis)){
    const buffers=new Map();
    return function loadBuffer(url){
      if(!buffers.has(url)){
        const job=Promise.resolve().then(()=>fetchAudio(url)).then(response=>{
          if(!response.ok)throw new Error('Audio resource unavailable');return response.arrayBuffer();
        }).then(bytes=>new Promise((resolve,reject)=>{
          // Callback overload supports older Safari; modern engines also return a promise.
          const result=context.decodeAudioData(bytes,resolve,reject);result?.then(resolve,reject);
        })).catch(error=>{buffers.delete(url);throw error;});
        buffers.set(url,job);
      }
      return buffers.get(url);
    };
  }
  function createSoundEffects({storage,createContext,preparePlayback,createMusic,loadBuffer:providedLoader,fetchAudio,now=()=>Date.now()}={}) {
    const read=key=>{try{return storage?.getItem(key);}catch{return null;}};
    const save=(key,value)=>{try{storage?.setItem(key,value?'on':'off');}catch{/* In-memory settings remain usable. */}};
    const legacy=read(SOUND_KEY)!=='off';
    const preference=key=>{const saved=read(key);if(saved==='on'||saved==='off')return saved==='on';save(key,legacy);return legacy;};
    let musicEnabled=preference(MUSIC_KEY),effectsEnabled=preference(EFFECTS_KEY);
    let context=null,loadBuffer=null,music=null,visible=true,authorized=false,resumeAttempt=null,pendingEffect=null;
    let lastAnswer=-Infinity,lastEffect=null,effectGeneration=0;
    const active=new Set(),chests=new Set();
    function silence(){
      for(const stop of [...active])stop();
      active.clear();for(const chest of chests)chest.cancelled=true;
    }
    function syncMusic(){try{if(musicEnabled&&visible&&authorized&&context?.state==='running')music?.start();else music?.stop();}catch{/* Optional audio cannot block the game. */}}
    function setMusicEnabled(value,{persist=true}={}){musicEnabled=!!value;if(persist)save(MUSIC_KEY,musicEnabled);syncMusic();}
    function setEffectsEnabled(value,{persist=true}={}){
      effectsEnabled=!!value;if(!effectsEnabled){effectGeneration++;pendingEffect=null;silence();}
      if(persist)save(EFFECTS_KEY,effectsEnabled);
    }
    function setEnabled(value,{persist=true}={}){
      setMusicEnabled(value,{persist});setEffectsEnabled(value,{persist});if(persist)save(SOUND_KEY,!!value);
    }
    function preloadEffects(){if(effectsEnabled&&loadBuffer)for(const url of Object.values(ASSETS))loadBuffer(url).catch(()=>{});}
    function unlock({gesture=true}={}){
      if(!(musicEnabled||effectsEnabled)||!visible||!createContext)return;
      if(!gesture&&!authorized)return;
      authorized=true;
      try{if(gesture)preparePlayback?.();}catch{/* Unsupported playback sessions are optional. */}
      try{
        if(context?.state==='closed'){music?.dispose();silence();music=null;context=null;resumeAttempt=null;pendingEffect=null;effectGeneration++;}
        if(!context){
          context=createContext();
          if(context){
            loadBuffer=providedLoader||createBufferLoader(context,fetchAudio);
            try{music=createMusic?.(context,{loadBuffer})||null;}catch{/* Effects remain available. */}
            context.addEventListener?.('statechange',syncMusic);
          }
        }
        if(!context)return;
        preloadEffects();
        if((context.state==='suspended'||context.state==='interrupted')&&(gesture||!resumeAttempt)){
          // A mobile resume promise can remain pending across interruption.
          // A fresh gesture must be able to retry without replacing the context.
          const attempt={context};resumeAttempt=attempt;
          try{
            if(gesture&&context.createBufferSource&&context.createBuffer){
              const source=context.createBufferSource();source.buffer=context.createBuffer(1,1,context.sampleRate||44100);
              source.connect(context.destination);source.onended=()=>source.disconnect();source.start(0);
            }
          }catch{/* Resume remains usable without priming. */}
          attempt.ready=Promise.resolve(context.resume()).then(()=>{
            if(resumeAttempt!==attempt)return;
            resumeAttempt=null;const pending=pendingEffect;pendingEffect=null;
            if(context===attempt.context&&effectsEnabled&&pending&&now()-pending.at<=500)play(pending.effect);
            syncMusic();
          }).catch(()=>{if(resumeAttempt===attempt){resumeAttempt=null;pendingEffect=null;}});

        }
        syncMusic();
      }catch{resumeAttempt=null;pendingEffect=null;}
    }
    function setVisible(value){
      visible=!!value;
      if(!visible){effectGeneration++;pendingEffect=null;resumeAttempt=null;silence();}
      // Try automatic recovery; autoplay rejection leaves the next gesture free to retry.
      if(visible&&authorized)unlock({gesture:false});
      syncMusic();
    }
    function sample(effect,{when,token,maxAge=500}={}){
      if(!effectsEnabled||!visible||!context||!loadBuffer)return false;
      const device=context,generation=effectGeneration,requested=now(),target=when??device.currentTime;
      Promise.all([loadBuffer(ASSETS[effect]),device.state==='running'?undefined:resumeAttempt?.ready]).then(([buffer])=>{
        if(generation!==effectGeneration||!effectsEnabled||!visible||context!==device||device.state!=='running'||token?.cancelled||(token?.valid&&!token.valid())||now()-requested>maxAge)return;
        const source=device.createBufferSource(),gain=device.createGain();source.buffer=buffer;
        gain.gain.setValueAtTime(EFFECT_GAIN,device.currentTime);source.connect(gain);gain.connect(device.destination);
        let stopped=false;const stop=()=>{if(stopped)return;stopped=true;try{source.stop();}catch{/* Already ended. */}source.disconnect();gain.disconnect();active.delete(stop);};
        active.add(stop);source.onended=()=>{stopped=true;source.disconnect();gain.disconnect();active.delete(stop);};
        if(token)token.stop=stop;
        try{source.start(Math.max(device.currentTime,target));}catch{stop();}
      }).catch(()=>{});
      return true;
    }
    function play(effect){
      if(!effectsEnabled||!visible||!context)return false;
      if(context.state!=='running'){
        if(resumeAttempt?.context===context){pendingEffect={effect,at:now()};return true;}return false;
      }
      if(effect==='correct'||effect==='wrong'){
        const at=now();if(effect===lastEffect&&at-lastAnswer<140)return false;lastAnswer=at;lastEffect=effect;
        return sample(effect);
      }
      const notes=melodies[effect];if(!notes)return false;
      try{
        const start=context.currentTime;
        for(const [frequency,duration,delay,level=EFFECT_GAIN] of notes){
          const oscillator=context.createOscillator(),gain=context.createGain();
          oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start+delay);
          gain.gain.setValueAtTime(0,start+delay);gain.gain.linearRampToValueAtTime(level,start+delay+.012);
          gain.gain.exponentialRampToValueAtTime(.0001,start+delay+duration);
          oscillator.connect(gain);gain.connect(context.destination);
          const stop=()=>{try{oscillator.stop();}catch{/* Already ended. */}oscillator.disconnect();gain.disconnect();active.delete(stop);};active.add(stop);
          oscillator.onended=()=>{active.delete(stop);oscillator.disconnect();gain.disconnect();};
          oscillator.start(start+delay);oscillator.stop(start+delay+duration+.015);
        }
        return true;
      }catch{silence();return false;}
    }
    function openChest({revealDelay=0,reduced=false,isCurrent=()=>true}={}){
      const token={cancelled:!effectsEnabled||!visible||!context,stop:null,valid:isCurrent};chests.add(token);
      if(!token.cancelled)sample('chest',{when:context.currentTime+(reduced?0:Math.max(0,revealDelay-CHEST_REVEAL_CUE)),token,maxAge:reduced?500:Math.max(500,revealDelay*1000)});
      return {cancel(){token.cancelled=true;token.stop?.();chests.delete(token);},finish(){chests.delete(token);}};
    }
    function cancelInvalidChests(){for(const token of chests)if(!token.valid()){token.cancelled=true;token.stop?.();chests.delete(token);}}
    return {isEnabled:()=>musicEnabled||effectsEnabled,isMusicEnabled:()=>musicEnabled,isEffectsEnabled:()=>effectsEnabled,
      setEnabled,setMusicEnabled,setEffectsEnabled,unlock,setVisible,answer:correct=>play(correct?'correct':'wrong'),reveal:rarity=>play(rarity),openChest,cancelInvalidChests};
  }
  return {SOUND_KEY,MUSIC_KEY,EFFECTS_KEY,EFFECT_GAIN,ASSETS,CHEST_REVEAL_CUE,melodies,createBufferLoader,createSoundEffects};
});
