import test from 'node:test';
import assert from 'node:assert/strict';
import { createExtensionRefresh } from '../src/extension-refresh.js';

function setup(prepare=async()=>{}) {
    let timer=null, allowed=true, reloads=0;
    const notices=[];
    const refresh=createExtensionRefresh({canReload:()=>allowed,prepare,reload:()=>reloads++,notify:m=>notices.push(m),schedule:fn=>(timer=fn),cancel:()=>{timer=null;}});
    return {refresh,notices,block:()=>{allowed=false;},get reloads(){return reloads;},tick:async()=>{const fn=timer;timer=null;await fn?.();}};
}
test('theme refresh waits for all concurrent batches and their remaining updates',async()=>{
    const h=setup();let release;
    const other=h.refresh.run(()=>new Promise(resolve=>{release=resolve;}));
    await h.refresh.run(async()=>h.refresh.updated());
    await h.tick();assert.equal(h.reloads,0);
    release();await other;await h.tick();assert.equal(h.reloads,1);
});
test('no changes never refresh; draft or busy state leaves a manual refresh notice',async()=>{
    const h=setup();await h.refresh.run(async()=>{});await h.tick();assert.equal(h.reloads,0);
    h.block();await h.refresh.run(async()=>h.refresh.updated());await h.tick();
    assert.equal(h.reloads,0);assert.equal(h.notices.length,1);
    await h.tick();assert.equal(h.notices.length,1);
});
test('failed updates and failed chat saves suppress refresh',async()=>{
    const h=setup();await assert.rejects(h.refresh.run(async()=>{h.refresh.updated();throw Error('offline');}));
    await h.tick();assert.equal(h.reloads,0);assert.equal(h.notices.length,1);
    const saving=setup(async()=>{throw Error('save failed');});
    await saving.refresh.run(async()=>saving.refresh.updated());await saving.tick();
    assert.equal(saving.reloads,0);assert.equal(saving.notices.length,1);
});
test('new user activity while saving is checked again before reload',async()=>{
    const h=setup(async()=>h.block());await h.refresh.run(async()=>h.refresh.updated());await h.tick();
    assert.equal(h.reloads,0);assert.equal(h.notices.length,1);
});
test('a batch starting during save postpones reload; teardown cancels it',async()=>{
    let release,other,started=false;
    const h=setup(async()=>{if(!started){started=true;other=h.refresh.run(()=>new Promise(resolve=>{release=resolve;}));}});
    await h.refresh.run(async()=>h.refresh.updated());await h.tick();assert.equal(h.reloads,0);
    release();await other;h.refresh.dispose();await h.tick();assert.equal(h.reloads,0);
});
