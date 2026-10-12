(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GeoFactMusic=api;
})(globalThis,function(){
  'use strict';
  // Original eight-bar adventure hook: 108 BPM, ~17.8 seconds, no samples.
  const BEAT=60/108, LENGTH=32*BEAT;
  const phrases=[
    [[0,64,.45],[.75,67,.45],[1.5,69,.45],[2.25,67,.45],[3,72,.75]],
    [[0,71,.65],[.75,67,.45],[1.5,64,.45],[2.25,62,.45],[3,64,.75]],
    [[0,64,.45],[.75,67,.45],[1.5,72,.65],[2.5,69,.45],[3.25,67,.55]],
    [[0,65,.65],[1,69,.45],[1.75,67,.45],[2.5,65,.45],[3.25,62,.55]],
    [[0,64,.45],[.75,67,.45],[1.5,69,.45],[2.25,67,.45],[3,72,.75]],
    [[0,69,.65],[1,72,.45],[1.75,71,.45],[2.5,69,.45],[3.25,67,.55]],
    [[0,65,.45],[.75,64,.45],[1.5,62,.65],[2.5,64,.45],[3.25,65,.55]],
    [[0,67,.65],[1,62,.45],[1.75,67,.45],[2.5,71,.45],[3.25,62,.55]]
  ];
  const roots=[48,43,45,41,48,45,41,43];
  const score=[];
  for(let bar=0;bar<phrases.length;bar++){
    for(const [beat,midi,duration] of phrases[bar])score.push({at:(bar*4+beat)*BEAT,midi,duration:duration*BEAT,voice:'lead',level:.036});
    for(const beat of [0,2])score.push({at:(bar*4+beat)*BEAT,midi:roots[bar]+(beat===2?7:0),duration:1.3*BEAT,voice:'bass',level:.040});
    if(bar%4===3)score.push({at:(bar*4+3)*BEAT,midi:31,duration:.08,voice:'pulse',level:.024});
  }
  score.sort((a,b)=>a.at-b.at);for(const note of score)Object.freeze(note);Object.freeze(score);
  const frequency=midi=>440*Math.pow(2,(midi-69)/12);
  function createAdventureMusic(context,{schedule=setInterval,cancel=clearInterval}={}){
    if(!context?.createPeriodicWave)return null;
    // Give the lead more midrange presence on small speakers while retaining
    // its previous RMS energy. No device sniffing, extra voice or gain increase.
    const leadScale=Math.sqrt((1+.15**2+.04**2)/(1+.35**2+.10**2));
    const wave=context.createPeriodicWave(new Float32Array(6),new Float32Array([0,leadScale,0,.35*leadScale,0,.10*leadScale]),{disableNormalization:true});
    const nodes=new Set();let timer=null,position=0,epoch=0,index=0,cycle=0,running=false,disposed=false;
    const phase=time=>((time%LENGTH)+LENGTH)%LENGTH;
    function seek(time){cycle=Math.floor(time/LENGTH);const offset=phase(time);index=score.findIndex(n=>n.at>=offset-.000001);if(index<0){index=0;cycle++;}}
    function note(n,at){
      const oscillator=context.createOscillator(),gain=context.createGain();
      if(n.voice==='lead')oscillator.setPeriodicWave(wave);else oscillator.type=n.voice==='bass'?'triangle':'sine';
      oscillator.frequency.setValueAtTime(frequency(n.midi),at);
      if(n.voice==='pulse')oscillator.frequency.exponentialRampToValueAtTime(45,at+n.duration);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(n.level,at+.015);
      gain.gain.exponentialRampToValueAtTime(.00001,at+n.duration);
      oscillator.connect(gain);gain.connect(context.destination);nodes.add(oscillator);
      oscillator.onended=()=>{nodes.delete(oscillator);oscillator.disconnect();gain.disconnect();};
      oscillator.start(at);oscillator.stop(at+n.duration+.015);
    }
    function stop(){
      if(running)position=phase(Math.max(0,context.currentTime-epoch));
      running=false;if(timer!==null){cancel(timer);timer=null;}
      for(const node of nodes){try{node.stop();node.disconnect();}catch{/* already stopped */}}nodes.clear();
    }
    function tick(){
      if(!running)return;
      if(context.state!=='running'){stop();return;}
      try{
        const time=context.currentTime;
        if(epoch+cycle*LENGTH+score[index].at<time-.25)seek(Math.max(0,time-epoch));
        while(epoch+cycle*LENGTH+score[index].at<time+.20){
          const n=score[index],at=epoch+cycle*LENGTH+n.at;
          if(at>=time-.02)note(n,Math.max(time,at));
          if(++index===score.length){index=0;cycle++;}
        }
      }catch{stop();}
    }
    function start(){
      if(disposed||running||context.state!=='running')return;
      epoch=context.currentTime+.03-position;seek(position);running=true;tick();
      if(running)try{timer=schedule(tick,50);}catch{stop();}
    }
    return {start,stop,dispose(){stop();disposed=true;},isRunning:()=>running};
  }
  return {BEAT,LENGTH,score,frequency,createAdventureMusic};
});
