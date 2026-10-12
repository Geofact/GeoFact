/* UTC Daily periods. Historical 24-hour identities remain untouched. */
(function(root){
  'use strict';
  const INTERVAL=12*60*60*1000;
  const START=Date.UTC(2026,9,13),EPOCH=Date.UTC(2026,9,7);
  function dailyKey(date=new Date()) {
    return date.toISOString().slice(0,10)+(date.getTime()>=START&&date.getUTCHours()>=12?'~12':'');
  }
  function dailyStart(key) {
    if(typeof key!=='string'||!/^\d{4}-\d{2}-\d{2}(?:~12)?$/.test(key))throw new TypeError('Invalid Daily period');
    const at=Date.parse(key.slice(0,10)+(key.endsWith('~12')?'T12:00:00Z':'T00:00:00Z'));
    if(!Number.isFinite(at)||dailyKey(new Date(at))!==key)throw new TypeError('Invalid Daily period');
    return at;
  }
  function dailyNumber(date=new Date()) {
    const at=date.getTime();
    return at<START?Math.floor((at-EPOCH)/86400000)+1:Math.floor((START-EPOCH)/86400000)+1+Math.floor((at-START)/INTERVAL);
  }
  function nextDailyAt(date=new Date()) {
    const at=date.getTime();return at<START?Math.min(START,Math.floor(at/86400000)*86400000+86400000):(Math.floor(at/INTERVAL)+1)*INTERVAL;
  }
  const api={dailyKey,dailyStart,dailyNumber,nextDailyAt};root.GeoFactDailyPeriods=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
