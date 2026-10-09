// Isolated IndexedDB repository. Importing this module never opens a database.
import {createBonusState,applyBonusAnswer,openBonusChest,bonusProgress,bonusUTCDate} from './bonus-rules.mjs?v=20261009-fix1';
import {completeDailyReward} from './daily-rewards.mjs?v=20261009-fix1';
import {readLegacyRewardValues,prepareLegacyRewards,sameLegacyValues} from './legacy-rewards.mjs?v=20261009-fix1';

export const REWARD_DB_VERSION=1;
export const REWARD_STATE_VERSION=1;
export const REWARD_DB_NAME='geofact-rewards';
const stores=['state','chests','sessions'];
const own=(object,key)=>Object.hasOwn(object,key);

export class RewardStorageError extends Error {
  constructor(code,message,cause,{committed=false}={}) {
    super(message,{cause});this.name='RewardStorageError';this.code=code;this.committed=committed;
  }
}
function failure(error,fallback='STORAGE_ERROR') {
  if(error instanceof RewardStorageError) return error;
  const code=error?.name==='QuotaExceededError'?'QUOTA_EXCEEDED':
    error?.name==='SecurityError'?'STORAGE_UNAVAILABLE':error?.name==='VersionError'?'INCOMPATIBLE_SCHEMA':
    error?.name==='AbortError'?'ABORTED':error?.name==='ConstraintError'?'CONSTRAINT_ERROR':fallback;
  return new RewardStorageError(code,error?.message||code,error);
}
function initial() {
  return {id:'rewards',schemaVersion:REWARD_STATE_VERSION,modelVersion:1,revision:0,
    progress:0,grantsByDay:{},collection:{},credits:{}};
}
function validate(record) {
  if(!record || record.schemaVersion!==REWARD_STATE_VERSION || record.modelVersion!==1 ||
    !Number.isSafeInteger(record.revision) || record.revision<0 ||
    !record.collection || Array.isArray(record.collection) || typeof record.collection!=='object' ||
    !record.credits || Array.isArray(record.credits) || typeof record.credits!=='object')
    throw new RewardStorageError('CORRUPT_STATE','Missing or unsupported canonical reward state');
  try {bonusProgress({...createBonusState(),progress:record.progress,grantsByDay:record.grantsByDay},0);}
  catch(cause) {throw new RewardStorageError('CORRUPT_STATE','Invalid canonical bonus state',cause);}
}

export function openRewardRepository({name=REWARD_DB_NAME,indexedDB=globalThis.indexedDB,transactionProbe}={}) {
  if(!indexedDB || typeof indexedDB.open!=='function')
    return Promise.reject(new RewardStorageError('STORAGE_UNAVAILABLE','IndexedDB is unavailable'));
  if(typeof name!=='string' || !name) return Promise.reject(new RewardStorageError('INVALID_DATABASE','A database name is required'));
  return new Promise((resolve,reject)=>{
    let request,settled=false;
    const rejectOpen=error=>{settled=true;reject(failure(error,'OPEN_FAILED'));};
    try {request=indexedDB.open(name,REWARD_DB_VERSION);} catch(error) {rejectOpen(error);return;}
    request.onblocked=()=>rejectOpen(new RewardStorageError('OPEN_BLOCKED','Close connections blocking the database opening'));
    request.onerror=()=>rejectOpen(request.error);
    request.onupgradeneeded=()=>{
      if(settled) {request.transaction.abort();return;}
      try {
        const db=request.result;
        for(const store of stores) db.createObjectStore(store,{keyPath:'id'});
        request.transaction.objectStore('state').add(initial());
      } catch(error) {request.transaction.abort();rejectOpen(error);}
    };
    request.onsuccess=()=>{
      const db=request.result;
      if(settled) {db.close();return;}
      if(db.objectStoreNames.length!==stores.length || stores.some(s=>!db.objectStoreNames.contains(s))) {
        db.close();rejectOpen(new RewardStorageError('INCOMPATIBLE_SCHEMA','Unexpected IndexedDB stores'));return;
      }
      try {
        const inspection=db.transaction(stores,'readonly');
        if(stores.some(s=>inspection.objectStore(s).keyPath!=='id' || inspection.objectStore(s).autoIncrement))
          throw new RewardStorageError('INCOMPATIBLE_SCHEMA','Unexpected IndexedDB keys');
      } catch(cause) {db.close();rejectOpen(cause);return;}
      let closed=false;
      db.onversionchange=()=>{closed=true;db.close();};
      db.onclose=()=>{closed=true;};
      function transact(mode,prepare) {
        return new Promise((done,fail)=>{
          if(closed) {fail(new RewardStorageError('CLOSED','Repository connection is closed'));return;}
          let tx,result,error;
          try {
            // Older engines may not support the optional durability argument.
            try {tx=db.transaction(stores,mode,mode==='readwrite'?{durability:'strict'}:undefined);}
            catch(cause) {if(cause instanceof TypeError) tx=db.transaction(stores,mode);else throw cause;}
          } catch(cause) {fail(failure(cause));return;}
          const abort=cause=>{error=cause;try {tx.abort();} catch {} };
          tx.onabort=()=>fail(failure(error||tx.error||new DOMException('Transaction aborted','AbortError')));
          tx.onerror=event=>{error ||= event.target.error;}; // Do not suppress IndexedDB's automatic abort.
          tx.oncomplete=()=>{
            try {
              transactionProbe?.({stage:'committed',transaction:tx});
              done(result);
            } catch(cause) {fail(new RewardStorageError('ACKNOWLEDGEMENT_FAILED','Commit completed but acknowledgement failed',cause,{committed:true}));}
          };
          const read=(store,key)=>new Promise((ok,bad)=>{
            let req;
            try {req=key===undefined?tx.objectStore(store).getAll():tx.objectStore(store).get(key);}
            catch(cause) {bad(cause);return;}
            req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error);
          });
          // Only IndexedDB requests are awaited here; no timer/network/animation.
          prepare({tx,read}).then(value=>{
            result=value;
            try {transactionProbe?.({stage:'staged',transaction:tx});} catch(cause) {abort(cause);}
          },abort);
        });
      }
      async function mutate(kind,input,catalog) {
        let command,countries;
        try {command=structuredClone(input);countries=structuredClone(catalog);}
        catch(cause) {throw failure(cause,'INVALID_COMMAND');}
        return transact('readwrite',async({tx,read})=>{
          const opId='op:'+command?.id,roundId='round:'+command?.roundId;
          const chestId=kind==='answer'?'bonus:'+command?.id:command?.chestId;
          const [record,receipt,round,chest]=await Promise.all([
            read('state','rewards'),read('sessions',opId),
            kind==='answer'?read('sessions',roundId):Promise.resolve(null),
            chestId?read('chests',chestId):Promise.resolve(null)
          ]);
          validate(record);
          if((receipt && (receipt.kind!=='operation' || !receipt.value || typeof receipt.value!=='object')) ||
             (round && round.kind!=='round')) throw new RewardStorageError('CORRUPT_STATE','Invalid operation or round receipt');
          // A replayed answer may point to an already-open chest; load that stored outcome.
          const storedChest=receipt?.value?.chestId && receipt.value.chestId!==chestId?
            await read('chests',receipt.value.chestId):chest;
          const model={...createBonusState(),progress:record.progress,grantsByDay:record.grantsByDay,
            operations:receipt?{[command.id]:receipt.value}:{},solvedRounds:round?{[command.roundId]:true}:{},
            chests:storedChest?{[storedChest.id]:storedChest}:{}};
          let transition;
          try {transition=kind==='answer'?applyBonusAnswer(model,command,countries):openBonusChest(model,command);}
          catch(cause) {throw failure(cause,'INVALID_COMMAND');}
          if(transition.state!==model) {
            const updated={...record,revision:record.revision+1,progress:transition.state.progress,
              grantsByDay:transition.state.grantsByDay};
            if(transition.credit) {
              const credit=transition.credit;
              if(own(record.credits,credit.id)) throw new RewardStorageError('CORRUPT_STATE','Credit exists for a sealed chest');
              const previous=own(record.collection,credit.iso)?record.collection[credit.iso]:null;
              const counts={...(previous?.counts||{})},owned=previous?.rarities||[];
              counts[credit.rarity]=(counts[credit.rarity]||0)+1;
              updated.collection={...record.collection,[credit.iso]:{
                ...previous,rarities:owned.includes(credit.rarity)?owned:[...owned,credit.rarity],counts,
                firstUnlocked:previous?.firstUnlocked||bonusUTCDate(credit.acquiredAt),
                acquiredAt:own(previous?.acquiredAt||{},credit.rarity)||owned.includes(credit.rarity)?(previous?.acquiredAt||{}):
                  {...previous?.acquiredAt,[credit.rarity]:credit.acquiredAt}}};
              updated.credits={...record.credits,[credit.id]:credit};
            }
            tx.objectStore('state').put(updated);
            for(const [id,value] of Object.entries(transition.state.operations))
              if(value!==model.operations[id]) tx.objectStore('sessions').put({id:'op:'+id,kind:'operation',value});
            for(const id of Object.keys(transition.state.solvedRounds))
              if(!own(model.solvedRounds,id)) tx.objectStore('sessions').add({id:'round:'+id,kind:'round'});
            for(const [id,value] of Object.entries(transition.state.chests)) if(value!==model.chests[id]) {
              if(own(model.chests,id)) tx.objectStore('chests').put(value);else tx.objectStore('chests').add(value);
            }
            return {status:transition.status,chest:transition.chest,credit:transition.credit,revision:updated.revision};
          }
          return {status:transition.status,chest:transition.chest,credit:null,revision:record.revision};
        });
      }
      const repository={
        importLegacy:async storage=>{
          let raw,prepared;
          try {raw=readLegacyRewardValues(storage);prepared=prepareLegacyRewards(raw);}
          catch(cause) {throw new RewardStorageError(cause.code||'INVALID_LEGACY_SAVES',cause.message,cause);}
          return transact('readwrite',async({tx,read})=>{
            const [record,chests,sessions]=await Promise.all([read('state','rewards'),read('chests'),read('sessions')]);
            validate(record);
            if(record.legacyImport) {
              if(!sameLegacyValues(record.legacyImport.raw,raw)) throw new RewardStorageError('LEGACY_SOURCE_CHANGED','Original saves differ from the completed import; no merge performed');
              return {status:'already-imported',revision:record.revision};
            }
            if(record.revision!==0||Object.keys(record.collection).length||Object.keys(record.credits).length||chests.length||sessions.length)
              throw new RewardStorageError('IMPORT_TARGET_NOT_EMPTY','Import requires an untouched repository; existing rewards are preserved');
            if(raw['gf-collection-v1']===null && raw['gf-daily-v1']===null) return {status:'no-data',revision:record.revision};
            let current;
            try {current=readLegacyRewardValues(storage);}catch(cause) {throw new RewardStorageError(cause.code,cause.message,cause);}
            if(!sameLegacyValues(current,raw)) throw new RewardStorageError('LEGACY_SOURCE_CHANGED','Original saves changed before import');
            const updated={...record,revision:record.revision+1,collection:prepared.collection,daily:prepared.daily,
              legacyImport:{version:1,raw:prepared.raw}};
            tx.objectStore('state').put(updated);
            return {status:'imported',revision:updated.revision};
          });
        },
        activateDaily:async storage=>{
          await repository.importLegacy(storage);
          return transact('readwrite',async({tx,read})=>{
            const record=await read('state','rewards');validate(record);
            if(record.dailyActive) return {status:'ready'};
            // importLegacy deliberately leaves a truly absent source unmarked in 4B.3.
            // Activation records that empty origin so new players migrate only once.
            const raw=record.legacyImport?.raw||readLegacyRewardValues(storage);
            if(!record.legacyImport && (raw['gf-collection-v1']!==null||raw['gf-daily-v1']!==null))
              throw new RewardStorageError('LEGACY_SOURCE_CHANGED','Saves appeared before activation');
            const daily={...record.daily,days:record.daily?.days||{},played:record.daily?.played??Object.keys(record.daily?.days||{}).length,
              streak:record.daily?.streak??0,bestStreak:record.daily?.bestStreak??0};
            for(const [day,result] of Object.entries(daily.days)) if(result.card)
              tx.objectStore('chests').add({id:'daily:'+day,type:'daily',earnedDay:day,card:result.card,revealed:!!result.cardOpened,revealedAt:null,imported:true});
            tx.objectStore('state').put({...record,revision:record.revision+1,daily,dailyActive:1,
              legacyImport:record.legacyImport||{version:1,raw}});
            return {status:'ready'};
          });
        },
        completeDaily:input=>{
          const command=structuredClone(input);
          return transact('readwrite',async({tx,read})=>{
            const record=await read('state','rewards');validate(record);
            if(!record.dailyActive)throw new RewardStorageError('NOT_READY','Daily storage is not activated');
            let transition;
            try {transition=completeDailyReward(record.collection,record.daily,command);}
            catch(cause){throw failure(cause,'INVALID_COMMAND');}
            if(transition.status==='already-completed')return {status:transition.status,result:transition.result};
            const id='daily:'+command.day,card=transition.result.card;
            tx.objectStore('chests').add({id,type:'daily',earnedDay:command.day,card,revealed:false,revealedAt:null,earnedAt:command.at});
            tx.objectStore('sessions').add({id:'daily-complete:'+command.day,kind:'daily-complete',day:command.day});
            tx.objectStore('state').put({...record,revision:record.revision+1,collection:transition.collection,daily:transition.daily,
              credits:{...record.credits,['credit:'+id]:{id:'credit:'+id,chestId:id,iso:card.iso,rarity:card.rarity,acquiredAt:command.at}}});
            return {status:transition.status,result:transition.result};
          });
        },
        revealDaily:({day,at})=>transact('readwrite',async({tx,read})=>{
          bonusUTCDate(at);
          const [record,chest]=await Promise.all([read('state','rewards'),read('chests','daily:'+day)]);validate(record);
          if(!record.dailyActive||!chest||chest.type!=='daily'||!record.daily.days[day]?.card)
            throw new RewardStorageError('MISSING_DAILY_CHEST','Daily chest is unavailable');
          if(chest.revealed)return {status:'already-revealed',result:record.daily.days[day]};
          const result={...record.daily.days[day],cardOpened:true};
          tx.objectStore('state').put({...record,revision:record.revision+1,daily:{...record.daily,days:{...record.daily.days,[day]:result}}});
          tx.objectStore('chests').put({...chest,revealed:true,revealedAt:at});
          tx.objectStore('sessions').add({id:'daily-reveal:'+day,kind:'daily-reveal',day});
          return {status:'revealed',result};
        }),
        answer:(command,catalog)=>mutate('answer',command,catalog),
        openChest:command=>mutate('open',command),
        read:()=>transact('readonly',async({read})=>{
          const [record,chests,sessions]=await Promise.all([read('state','rewards'),read('chests'),read('sessions')]);
          validate(record);
          const bonus={...createBonusState(),progress:record.progress,grantsByDay:record.grantsByDay};
          for(const chest of chests) if(chest.type!=='daily') bonus.chests[chest.id]=chest;
          for(const session of sessions) {
            if(session.kind==='operation') Object.defineProperty(bonus.operations,session.id.slice(3),{value:session.value,enumerable:true,writable:true,configurable:true});
            else if(session.kind==='round') Object.defineProperty(bonus.solvedRounds,session.id.slice(6),{value:true,enumerable:true,writable:true,configurable:true});
          }
          return {schemaVersion:record.schemaVersion,revision:record.revision,bonus,collection:record.collection,credits:record.credits,
            ...(record.legacyImport?{daily:record.daily,legacyImport:record.legacyImport}:{}),
            ...(record.dailyActive?{dailyActive:record.dailyActive,dailyChests:Object.fromEntries(chests.filter(c=>c.type==='daily').map(c=>[c.id,c]))}:{})};
        }),
        export:async()=>({format:'geofact-reward-export',version:1,databaseVersion:REWARD_DB_VERSION,state:await repository.read()}),
        close:()=>{closed=true;db.close();}
      };
      settled=true;resolve(repository);
    };
  });
}
