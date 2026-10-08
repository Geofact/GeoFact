// Pure bonus-reward model. Not loaded by the game; time and draws are inputs.
export const BONUS_TARGET = 10;
export const BONUS_DAILY_LIMIT = 2;
export const BONUS_RARITY_WEIGHTS = Object.freeze({classic:6225,silver:2500,gold:1050,shiny:225});
const own = (record,key) => Object.hasOwn(record,key);

export function createBonusState() {
  return {version:1,progress:0,grantsByDay:{},chests:{},operations:{},solvedRounds:{}};
}

function validateState(state) {
  if (!state || state.version !== 1 || !Number.isInteger(state.progress) || state.progress < 0 || state.progress >= BONUS_TARGET)
    throw new TypeError('Invalid bonus state');
  for (const key of ['grantsByDay','chests','operations','solvedRounds']) {
    const record=state[key];
    if (!record || typeof record !== 'object' || Array.isArray(record) ||
        ![Object.prototype,null].includes(Object.getPrototypeOf(record))) throw new TypeError('Invalid bonus record: '+key);
  }
  for (const count of Object.values(state.grantsByDay))
    if (!Number.isInteger(count) || count < 0 || count > BONUS_DAILY_LIMIT) throw new TypeError('Invalid daily quota');
}

function identifier(value,limit=160) {
  if (typeof value !== 'string' || value.length > limit || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value))
    throw new TypeError('A stable identifier is required');
  return value;
}

export function bonusUTCDate(at) {
  // Explicit epoch milliseconds, restricted to ISO dates with four-digit years.
  if (!Number.isSafeInteger(at) || at < 0 || at >= 253402300800000) throw new TypeError('Invalid timestamp');
  return new Date(at).toISOString().slice(0,10);
}

function unitDraw(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1)
    throw new TypeError('A draw must be in [0, 1)');
  return value;
}

export function rollBonusRarity(draw) {
  unitDraw(draw);
  let cutoff=0;
  for (const rarity of ['shiny','gold','silver','classic']) {
    cutoff+=BONUS_RARITY_WEIGHTS[rarity];
    if (draw < cutoff/10000) return rarity;
  }
}

export function pickBonusCard(catalog,countryDraw,rarityDraw) {
  if (!Array.isArray(catalog) || !catalog.length || new Set(catalog).size !== catalog.length ||
      catalog.some(iso=>typeof iso !== 'string' || !/^[A-Z]{3}$/.test(iso))) throw new TypeError('Invalid country catalog');
  return {iso:catalog[Math.floor(unitDraw(countryDraw)*catalog.length)],rarity:rollBonusRarity(rarityDraw)};
}

export function bonusProgress(state,at) {
  validateState(state);
  const day=bonusUTCDate(at),obtained=own(state.grantsByDay,day)?state.grantsByDay[day]:0;
  return {progress:state.progress,target:BONUS_TARGET,day,obtained,limit:BONUS_DAILY_LIMIT,paused:obtained>=BONUS_DAILY_LIMIT};
}

function duplicate(state,command,type) {
  if (!own(state.operations,command.id)) return null;
  const receipt=state.operations[command.id];
  if (receipt.type !== type || (type === 'answer' ?
      receipt.roundId !== command.roundId || receipt.correct !== command.correct : receipt.chestId !== command.chestId))
    throw new TypeError('Operation identifier reused for a different command');
  return {state,status:'duplicate',chest:receipt.chestId?state.chests[receipt.chestId]:null,credit:null};
}

export function applyBonusAnswer(state,command,catalog) {
  validateState(state);
  if (!command || typeof command.mode !== 'string' || !command.mode) throw new TypeError('A mode is required');
  if (command.mode !== 'practice') return {state,status:'ignored',chest:null,credit:null};
  identifier(command.id);identifier(command.roundId);
  if (typeof command.correct !== 'boolean') throw new TypeError('An answer must be correct or incorrect');
  const replay=duplicate(state,command,'answer');
  if (replay) return replay;
  // A late second click (even with a different operation ID) cannot solve a round twice.
  if (own(state.solvedRounds,command.roundId)) return {state:{...state,
    operations:{...state.operations,[command.id]:{type:'answer',roundId:command.roundId,correct:command.correct,chestId:null}}},
    status:'ignored',chest:null,credit:null};
  const quota=bonusProgress(state,command.at);
  let progress=state.progress,chest=null,grantsByDay=state.grantsByDay,chests=state.chests;
  if (!command.correct) progress=0;
  else if (!quota.paused) {
    progress++;
    if (progress === BONUS_TARGET) {
      const chestId='bonus:'+command.id;
      if (own(chests,chestId)) throw new TypeError('Chest identifier already exists');
      chest={id:chestId,earnedAt:command.at,earnedDay:quota.day,
        card:pickBonusCard(catalog,command.countryDraw,command.rarityDraw),openedAt:null};
      progress=0;
      grantsByDay={...grantsByDay,[quota.day]:quota.obtained+1};
      chests={...chests,[chestId]:chest};
    }
  }
  const receipt={type:'answer',roundId:command.roundId,correct:command.correct,day:quota.day,chestId:chest?.id||null};
  return {state:{...state,progress,grantsByDay,chests,
    operations:{...state.operations,[command.id]:receipt},
    solvedRounds:command.correct?{...state.solvedRounds,[command.roundId]:true}:state.solvedRounds},
    status:'applied',chest,credit:null};
}

export function openBonusChest(state,command) {
  validateState(state);
  if (!command) throw new TypeError('An opening command is required');
  identifier(command.id);identifier(command.chestId,166);
  const replay=duplicate(state,command,'open');
  if (replay) return replay;
  if (!own(state.chests,command.chestId)) throw new TypeError('Unknown chest');
  const chest=state.chests[command.chestId];
  if (chest.openedAt !== null) return {state:{...state,
    operations:{...state.operations,[command.id]:{type:'open',chestId:chest.id}}},status:'already-open',chest,credit:null};
  bonusUTCDate(command.at);
  if (command.at < chest.earnedAt) throw new TypeError('Opening precedes attribution');
  const opened={...chest,openedAt:command.at};
  return {state:{...state,chests:{...state.chests,[chest.id]:opened},
    operations:{...state.operations,[command.id]:{type:'open',chestId:chest.id}}},
    status:'opened',chest:opened,
    credit:{id:'credit:'+chest.id,chestId:chest.id,...chest.card,acquiredAt:command.at}};
}
