(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GeoFactPublicStatistics=api;
})(globalThis,function(){
  'use strict';
  const VISITOR_KEY='gf-anonymous-visitor-v1';
  const valid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(id);
  function createPublicTelemetry({storage,locks,uuid,send}={}) {
    let identity;
    function readOrCreate(){
      try{
        const saved=JSON.parse(storage.getItem(VISITOR_KEY));
        if(valid(saved))return saved;
        const id=uuid?.();if(!valid(id))return null;
        storage.setItem(VISITOR_KEY,JSON.stringify(id));
        // Never count an ephemeral ID when storage cannot retain it.
        return JSON.parse(storage.getItem(VISITOR_KEY))===id?id:null;
      }catch{return null;}
    }
    function visitor(){
      identity ||= (async()=>{
        try{return locks?.request?await locks.request('geofact-anonymous-visitor',readOrCreate):readOrCreate();}
        catch{return null;}
      })();
      return identity;
    }
    async function recordEvent(type){
      try{const id=await visitor();if(id)await send({p_visitor_id:id,p_event_type:type});}catch{/* Telemetry never interrupts gameplay. */}
    }
    return {visitor,recordEvent};
  }
  return {VISITOR_KEY,createPublicTelemetry};
});
