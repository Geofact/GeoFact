// Daily-only rules. Credit still happens at completion, as in the existing game.
import {bonusUTCDate,BONUS_RARITY_WEIGHTS} from './bonus-rules.mjs?v=20261009-fix1';
const dayKey=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&bonusUTCDate(Date.parse(day+'T00:00:00Z'))===day;
export function rollDailyRarity(score,draw) {
 if(!Number.isSafeInteger(score)||score<0||score>100||!Number.isFinite(draw)||draw<0||draw>=1)throw new TypeError('Invalid Daily draw');
 const q=score/100,shiny=.005+.035*q,gold=.05+.11*q,silver=.20+.10*q;
 return draw<shiny?'shiny':draw<shiny+gold?'gold':draw<shiny+gold+silver?'silver':'classic';
}
export function validateDailyCommand(c) {
 if(!c||!dayKey(c.day)||bonusUTCDate(c.at)<c.day||!Number.isSafeInteger(c.number)||c.number<1||
 !Number.isSafeInteger(c.errors)||c.errors<0||!Number.isSafeInteger(c.score)||c.score<0||c.score>100||
 !Array.isArray(c.tiles)||c.tiles.length!==5||c.tiles.some(t=>!['green','yellow','orange','red'].includes(t))||
 !/^[A-Z]{3}$/.test(c.card?.iso)||!Object.hasOwn(BONUS_RARITY_WEIGHTS,c.card?.rarity))throw new TypeError('Invalid Daily completion');
}
export function completeDailyReward(collection,daily,command) {
 validateDailyCommand(command);
 if(daily.days?.[command.day])return {status:'already-completed',collection,daily,result:daily.days[command.day]};
 const {iso,rarity}=command.card,previous=collection[iso],owned=previous?.rarities||[],isNew=!owned.includes(rarity);
 const counts={...previous?.counts,[rarity]:(previous?.counts?.[rarity]||(isNew?0:1))+1};
 if(!Number.isSafeInteger(counts[rarity]))throw new TypeError('Copy count overflow');
 const nextCollection={...collection,[iso]:{...previous,rarities:isNew?[...owned,rarity]:[...owned],counts,
 firstUnlocked:previous?.firstUnlocked||bonusUTCDate(command.at),
 acquiredAt:isNew?{...previous?.acquiredAt,[rarity]:command.at}:{...previous?.acquiredAt}}};
 const result={score:command.score,tiles:[...command.tiles],errors:command.errors,number:command.number,
 card:{iso,rarity,upgraded:isNew,copies:counts[rarity]},cardOpened:false};
 const nextDaily={...daily,days:{...daily.days,[command.day]:result},played:(daily.played||0)+1};
 const yesterday=bonusUTCDate(Date.parse(command.day+'T00:00:00Z')-86400000);
 if(!daily.lastDate||command.day>daily.lastDate) {
  nextDaily.streak=daily.lastDate===yesterday?(daily.streak||0)+1:1;nextDaily.lastDate=command.day;
 } else {
  // A late completion can fill a hole before a newer result without moving lastDate backwards.
  let streak=0,at=Date.parse(daily.lastDate+'T00:00:00Z');
  while(nextDaily.days[bonusUTCDate(at)]){streak++;at-=86400000;if(at<0)break;}
  nextDaily.streak=Math.max(daily.streak||0,streak);
 }
 nextDaily.bestStreak=Math.max(daily.bestStreak||0,nextDaily.streak);
 return {status:'completed',collection:nextCollection,daily:nextDaily,result};
}
