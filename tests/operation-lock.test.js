import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOperationLock} from '../src/operation-lock.js';
test('conflicting actions are rejected without executing, lock releases on success',async()=>{
 const run=createOperationLock();let release,executed=false;
 const first=run(()=>new Promise(resolve=>{release=resolve;}));
 await assert.rejects(run(()=>{executed=true;}),/正在/);
 assert.equal(executed,false);release();await first;
 assert.equal(await run(()=>42),42);
});
test('lock releases after synchronous and asynchronous failures',async()=>{
 const run=createOperationLock();
 await assert.rejects(run(()=>{throw Error('sync');}),/sync/);
 await assert.rejects(run(async()=>{throw Error('async');}),/async/);
 assert.equal(await run(()=>true),true);
});