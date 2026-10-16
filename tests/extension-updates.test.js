import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleUpdates, createExtensionUpdater } from '../src/extension-updates.js';

test('automatic updates are opt-in, daily, enabled-only and respect global permissions',()=>{
    const now=2*86400000;
    const items=[{id:'third-party/a',type:'local',enabled:true},{id:'third-party/b',type:'global',enabled:true},{id:'third-party/c',type:'local',enabled:false},{id:'regex',type:'system',enabled:true},{id:'third-party/d',type:'local',enabled:true}];
    const prefs=Object.fromEntries(items.map(x=>[x.id,{enabled:true}]));prefs['third-party/d'].lastAttempt=now-1000;
    assert.deepEqual(eligibleUpdates(items,{},now,true),[]);
    assert.deepEqual(eligibleUpdates(items,prefs,now,false).map(x=>x.id),['third-party/a']);
    assert.deepEqual(eligibleUpdates(items,prefs,now,true).map(x=>x.id),['third-party/a','third-party/b']);
});

test('concurrent updates coalesce; exact native payload and post-update hook run once',async()=>{
    const calls=[];let finish,hooks=0,notices=0;
    const update=createExtensionUpdater({request:(url,data)=>{calls.push({url,data});return new Promise(resolve=>finish=resolve);},runHook:async()=>hooks++,onUpdated:()=>notices++});
    const item={id:'third-party/example',type:'global'};
    const first=update(item),second=update(item);assert.equal(first,second);
    finish({isUpToDate:false});await first;
    assert.deepEqual(calls,[{url:'/api/extensions/update',data:{extensionName:'/example',global:true}}]);
    assert.equal(hooks,1);assert.equal(notices,1);
});

test('failed updates do not claim success and can be retried; current versions skip hooks',async()=>{
    let attempt=0,hooks=0,notices=0;
    const update=createExtensionUpdater({request:async()=>{if(!attempt++)throw Error('offline');return{isUpToDate:true};},runHook:async()=>hooks++,onUpdated:()=>notices++});
    await assert.rejects(update({id:'third-party/a',type:'local'}),/offline/);
    assert.equal((await update({id:'third-party/a',type:'local'})).isUpToDate,true);
    assert.equal(hooks,0);assert.equal(notices,0);
});
