(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GeoFactMusic=api;
})(globalThis,function(){
  'use strict';
  const MUSIC_URL='assets/audio/GeoFact-Braise-Aventure-boucle.mp3';
  // Historical voice references are retained; playback is raised by 70%.
  const LEGACY_VOICE_GAINS=Object.freeze({lead:.036,bass:.040,pulse:.024});
  const MUSIC_GAIN=.0612; // .036 × 1.7
  function createAdventureMusic(context,{loadBuffer}={}){
    if(!context?.createBufferSource||!context?.createGain||!loadBuffer)return null;
    let buffer=null,loading=null,source=null,gain=null,wanted=false,disposed=false,position=0,startedAt=0;
    const phase=time=>buffer?.duration?((time%buffer.duration)+buffer.duration)%buffer.duration:0;
    function launch(){
      if(disposed||!wanted||source||!buffer||context.state!=='running')return;
      const node=context.createBufferSource(),bus=context.createGain();
      node.buffer=buffer;node.loop=true;
      bus.gain.setValueAtTime(MUSIC_GAIN,context.currentTime);
      node.connect(bus);bus.connect(context.destination);
      source=node;gain=bus;startedAt=context.currentTime;
      node.onended=()=>{node.disconnect();bus.disconnect();if(source===node){source=null;gain=null;}};
      try{node.start(0,phase(position));}catch{source=null;gain=null;node.disconnect();bus.disconnect();}
    }
    function start(){
      if(disposed)return;wanted=true;
      if(buffer){launch();return;}
      if(!loading)loading=Promise.resolve().then(()=>loadBuffer(MUSIC_URL)).then(value=>{
        buffer=value;loading=null;launch();
      }).catch(()=>{loading=null;});
    }
    function stop(){
      wanted=false;
      if(!source)return;
      position=phase(position+Math.max(0,context.currentTime-startedAt));
      const node=source,bus=gain;source=null;gain=null;
      try{node.stop();}catch{/* Already ended. */}
      node.disconnect();bus?.disconnect();
    }
    return {start,stop,dispose(){stop();disposed=true;},isRunning:()=>source!==null,
      getPosition:()=>phase(position+(source?Math.max(0,context.currentTime-startedAt):0))};
  }
  return {MUSIC_URL,MUSIC_GAIN,LEGACY_VOICE_GAINS,createAdventureMusic};
});
