(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GeoFactSound=api;
})(globalThis,function(){
  'use strict';
  const SOUND_KEY='gf-sound-v1';
  const melodies=Object.freeze({
    correct:[[880,.045,0],[1319,.070,.030]],
    wrong:[[294,.10,0],[247,.08,.08]],
    classic:[[392,.09,0],[523,.10,.08],[659,.18,.16]],
    silver:[[440,.09,0],[659,.10,.08],[880,.20,.16]],
    gold:[[523,.09,0],[659,.10,.08],[784,.12,.16],[1047,.24,.25]],
    shiny:[[659,.08,0],[784,.08,.07],[988,.10,.14],[1319,.28,.23]]
  });
  function createSoundEffects({storage,createContext,preparePlayback,createMusic,now=()=>Date.now()}={}) {
    let enabled=true,context=null,lastAnswer=-Infinity,lastEffect=null,resumeAttempt=null,pendingEffect=null;
    let music=null,visible=true,authorized=false;
    const active=new Set();
    try{enabled=storage?.getItem(SOUND_KEY)!=='off';}catch{/* Default on; persistence is optional. */}
    function silence(){for(const node of active){try{node.stop();node.disconnect();}catch{/* Already ended. */}}active.clear();}
    function syncMusic(){try{if(enabled&&visible&&authorized&&context?.state==='running')music?.start();else music?.stop();}catch{/* optional music */}}
    function setEnabled(value,{persist=true}={}) {
      enabled=!!value;if(!enabled){pendingEffect=null;silence();}syncMusic();
      if(persist)try{storage?.setItem(SOUND_KEY,enabled?'on':'off');}catch{/* Keep the current in-memory choice. */}
    }
    function unlock(){
      if(!enabled||!visible||!createContext)return;
      authorized=true;
      // iOS can route Web Audio through a session silenced by the hardware switch.
      // Request playback only in a gesture, and only when the browser supports it.
      try{preparePlayback?.();}catch{/* An unsupported audio session must not block Web Audio. */}
      try{
        if(context?.state==='closed'){music?.dispose();music=null;context=null;resumeAttempt=null;pendingEffect=null;}
        if(!context){
          context=createContext();
          if(context){try{music=createMusic?.(context)||null;}catch{/* effects remain available */}
            context.addEventListener?.('statechange',syncMusic);
          }
        }
        if(!context)return;
        if((context.state==='suspended'||context.state==='interrupted')&&!resumeAttempt){
          const attempt={context};resumeAttempt=attempt;
          // Older iOS Web Audio needs a source started inside the touch gesture,
          // not only a resume promise. A one-sample silent buffer unlocks output.
          try{
            if(context.createBufferSource&&context.createBuffer){
              const source=context.createBufferSource();
              source.buffer=context.createBuffer(1,1,context.sampleRate||44100);
              source.connect(context.destination);source.onended=()=>source.disconnect();source.start(0);
            }
          }catch{/* Resume still works if buffer priming is unsupported. */}
          Promise.resolve(context.resume()).then(()=>{
            if(resumeAttempt!==attempt)return;
            resumeAttempt=null;const pending=pendingEffect;pendingEffect=null;
            if(context===attempt.context&&enabled&&pending&&now()-pending.at<=500)play(pending.effect);
            syncMusic();
          }).catch(()=>{if(resumeAttempt===attempt){resumeAttempt=null;pendingEffect=null;}});
          // Some devices resume synchronously; avoid treating a later interruption as this attempt.
          if(context.state==='running')resumeAttempt=null;
        }
        syncMusic();
      }catch{resumeAttempt=null;pendingEffect=null;/* Audio must never interrupt validation. */}
    }
    function setVisible(value){
      visible=!!value;
      if(!visible){pendingEffect=null;silence();syncMusic();return;}
      // Never request a new resume outside a gesture. A still-running context can
      // resume the score; a suspended/interrupted one waits for the next gesture.
      syncMusic();
    }
    function play(effect){
      if(!enabled||!visible||!context)return false;
      const notes=melodies[effect];if(!notes)return false;
      if(context.state!=='running'){
        if(resumeAttempt?.context===context){pendingEffect={effect,at:now()};return true;}
        return false;
      }
      if(effect==='correct'||effect==='wrong'){
        const at=now();if(effect===lastEffect&&at-lastAnswer<140)return false;lastAnswer=at;lastEffect=effect;
      }
      try{
        const start=context.currentTime;
        for(const [frequency,duration,delay] of notes){
          const oscillator=context.createOscillator(),gain=context.createGain();
          oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start+delay);
          gain.gain.setValueAtTime(0,start+delay);
          gain.gain.linearRampToValueAtTime(.035,start+delay+.012);
          gain.gain.exponentialRampToValueAtTime(.0001,start+delay+duration);
          oscillator.connect(gain);gain.connect(context.destination);active.add(oscillator);
          oscillator.onended=()=>{active.delete(oscillator);oscillator.disconnect();gain.disconnect();};
          oscillator.start(start+delay);oscillator.stop(start+delay+duration+.015);
        }
        return true;
      }catch{silence();return false;}
    }
    return {isEnabled:()=>enabled,setEnabled,unlock,setVisible,answer:correct=>play(correct?'correct':'wrong'),reveal:rarity=>play(rarity)};
  }
  return {SOUND_KEY,createSoundEffects};
});
