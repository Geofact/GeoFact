import test from 'node:test';
import assert from 'node:assert/strict';
import {openRewardRepository,RewardStorageError,REWARD_DB_VERSION,REWARD_STATE_VERSION} from '../reward-repository.mjs';

test('repository import does not access or open browser storage',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,get(){throw new Error('Unexpected storage access');}});
  try {await import('../reward-repository.mjs?isolated-import');}
  finally {if(previous) Object.defineProperty(globalThis,'indexedDB',previous);else delete globalThis.indexedDB;}
});

test('absent storage and synchronous denial reject explicitly, without a repository',async()=>{
  for(const factory of [null,{}, {open(){throw new DOMException('Denied','SecurityError');}}])
    await assert.rejects(openRewardRepository({indexedDB:factory}),error=>error instanceof RewardStorageError && error.code==='STORAGE_UNAVAILABLE' && !error.committed);
});

test('asynchronous opening errors retain the original cause and schema version',async()=>{
  const cause=new DOMException('Future database','VersionError');let requested;
  const factory={open(name,version){requested={name,version};const request={error:cause};queueMicrotask(()=>request.onerror());return request;}};
  await assert.rejects(openRewardRepository({name:'isolated',indexedDB:factory}),error=>error.code==='INCOMPATIBLE_SCHEMA' && error.cause===cause && !error.committed);
  assert.deepEqual(requested,{name:'isolated',version:REWARD_DB_VERSION});assert.equal(REWARD_STATE_VERSION,1);
});

test('blocked opening rejects and a late connection is closed instead of leaking',async()=>{
  let closed=false;
  const factory={open(){
    const request={result:{close(){closed=true;}}};
    queueMicrotask(()=>{request.onblocked();queueMicrotask(()=>request.onsuccess());});return request;
  }};
  await assert.rejects(openRewardRepository({indexedDB:factory}),error=>error.code==='OPEN_BLOCKED' && !error.committed);
  await new Promise(resolve=>queueMicrotask(resolve));assert.equal(closed,true);
});

test('invalid database names are rejected before opening anything',async()=>{
  let opened=false;const factory={open(){opened=true;}};
  for(const name of ['',null,42]) await assert.rejects(openRewardRepository({name,indexedDB:factory}),error=>error.code==='INVALID_DATABASE');
  assert.equal(opened,false);
});
