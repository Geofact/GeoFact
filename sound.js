(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GeoFactSound=api;
})(globalThis,function(){
  'use strict';
  const SOUND_KEY='gf-sound-v1';
  const melodies=Object.freeze({
    correct:[[523,.07,0],[784,.11,.07]],
    wrong:[[294,.10,0],[247,.08,.08]],
    classic:[[392,.09,0],[523,.10,.08],[659,.18,.16]],
    silver:[[440,.09,0],[659,.10,.08],[880,.20,.16]],
    gold:[[523,.09,0],[659,.10,.08],[784,.12,.16],[1047,.24,.25]],
    shiny:[[659,.08,0],[784,.08,.07],[988,.10,.14],[1319,.28,.23]]
  });
  function createSoundEffects({storage,createContext,now=()=>Date.now()}={}) {
    let enabled=true,context=null,lastAnswer=-Infinity,lastEffect=null;
    const active=new Set();
    try{enabled=storage?.getItem(SOUND_KEY)!=='off';}catch{/* Default on; persistence is optional. */}
    function silence(){for(const node of active){try{node.stop();node.disconnect();}catch{/* Already ended. */}}active.clear();}
    function setEnabled(value,{persist=true}={}) {
      enabled=!!value;if(!enabled)silence();
      if(persist)try{storage?.setItem(SOUND_KEY,enabled?'on':'off');}catch{/* Keep the current in-memory choice. */}
    }
    function unlock(){
      if(!enabled||!createContext)return;
      try{
        if(context?.state==='closed')context=null;
        context ||= createContext();
        if(!context)return;
        if(context.state==='suspended'||context.state==='interrupted')Promise.resolve(context.resume()).catch(()=>{});
      }catch{/* Audio is optional and must never interrupt validation. */}
    }
    function play(effect){
      if(!enabled||!context||context.state!=='running')return false;
      const notes=melodies[effect];if(!notes)return false;
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
    return {isEnabled:()=>enabled,setEnabled,unlock,answer:correct=>play(correct?'correct':'wrong'),reveal:rarity=>play(rarity)};
  }
  return {SOUND_KEY,createSoundEffects};
});
