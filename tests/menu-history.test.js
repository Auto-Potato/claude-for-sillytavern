import test from 'node:test';
import assert from 'node:assert/strict';
import {createMenuHistory} from '../src/menu-history.js';
function setup(initial=0){let ui=initial,index=0,callback,guard=true;const entries=[{}];const history={get state(){return entries[index]},replaceState(s){entries[index]=s},pushState(s){entries.splice(++index);entries.push(s)},go(n){index+=n;queueMicrotask(()=>callback({state:entries[index]}))}};const c=createMenuHistory({history,read:()=>ui,closeOne:async()=>{if(!guard)return false;ui--;return true},listen:fn=>{callback=fn;return()=>{}},onError:e=>{throw e}});return{c,entries,get index(){return index},get ui(){return ui},setUI(n){ui=n;c.sync()},guard(v){guard=v},async back(){history.go(-1);await new Promise(r=>setImmediate(r))}}}
test('browser back closes detail, panel, rail in order',async()=>{const s=setup();s.setUI(3);for(const n of [2,1,0]){await s.back();assert.equal(s.ui,n);assert.equal(s.index,n)}});
test('manual closing consumes history rather than leaving hidden steps',async()=>{const s=setup();s.setUI(3);s.setUI(1);await new Promise(r=>setImmediate(r));assert.equal(s.index,1);await s.back();assert.equal(s.ui,0)});
test('cancel discard restores history and preserves current detail',async()=>{const s=setup();s.setUI(3);s.guard(false);await s.back();assert.equal(s.ui,3);assert.equal(s.index,3);s.guard(true);await s.back();assert.equal(s.ui,2)});
test('initial desktop rail has one back entry and equal-depth changes add none',async()=>{const s=setup(1);assert.equal(s.index,1);s.setUI(2);s.setUI(2);assert.equal(s.index,2);await s.back();assert.equal(s.ui,1)});
test('popup sits above detail and returns to detail first',async()=>{const s=setup(3);s.setUI(4);await s.back();assert.equal(s.ui,3)});
test('another back during discard prompt dismisses it and restores the detail route',async()=>{
 let ui=3,callback,resolve;const entries=[{}];let index=0;
 const history={get state(){return entries[index]},replaceState(s){entries[index]=s},pushState(s){entries.splice(++index);entries.push(s)},go(n){index+=n;queueMicrotask(()=>callback({state:entries[index]}))}};
 createMenuHistory({history,read:()=>ui,closeOne:()=>new Promise(r=>{ui=4;resolve=r}),dismissPopup:async()=>{ui=3;resolve(false)},listen:fn=>{callback=fn;return()=>{}},onError:e=>{throw e}});
 history.go(-1);await new Promise(r=>setImmediate(r));history.go(-1);await new Promise(r=>setImmediate(r));assert.equal(ui,3);assert.equal(index,3);
});

test('mobile chat is below menus: back reaches welcome before exhausting local history',async()=>{
 const s=setup(1); // Restoring an existing chat also creates a welcome boundary.
 s.setUI(5); // Chat, rail, character list, detail, modal.
 for(const n of [4,3,2,1,0]){await s.back();assert.equal(s.ui,n);assert.equal(s.index,n);}
 s.c.sync();assert.equal(s.index,0); // No extra interception at welcome.
 s.setUI(1);s.setUI(1);assert.equal(s.index,1); // Switching chats does not stack visits.
 s.setUI(0);await new Promise(r=>setImmediate(r));assert.equal(s.index,0); // New-dialog button consumes it too.
});
test('a blocked return to welcome preserves the chat back entry',async()=>{
 const s=setup(1);s.guard(false);await s.back();assert.equal(s.ui,1);assert.equal(s.index,1);
 s.guard(true);await s.back();assert.equal(s.ui,0);assert.equal(s.index,0);
});

test('rapid back during a slow close stays in document and drains queued layers',async()=>{
 let ui=3,index=0,callback,finish,exited=false,calls=0;
 const entries=[{}],tick=()=>new Promise(r=>setImmediate(r));
 const history={get state(){return entries[index]},replaceState(s){entries[index]=s},pushState(s){entries.splice(++index);entries.push(s)},go(n){index+=n;if(index<0){exited=true;return;}queueMicrotask(()=>callback({state:entries[index]}));}};
 createMenuHistory({history,read:()=>ui,closeOne:async()=>{calls++;if(calls===1)await new Promise(r=>finish=r);ui--;return true;},listen:fn=>{callback=fn;return()=>{}},onError:e=>{throw e;}});
 history.go(-1);await tick();
 for(let i=0;i<5;i++){history.go(-1);await tick();}
 assert.equal(exited,false);assert.equal(ui,3);assert.equal(calls,1);
 finish();await tick();await tick();
 assert.equal(ui,0);assert.equal(index,0);assert.equal(calls,3);
 history.go(-1);assert.equal(exited,true); // Welcome still permits normal browser Back.
});

test('failed asynchronous close restores usable local history',async()=>{
 let ui=2,index=0,callback,reject,reported=0;
 const entries=[{}],tick=()=>new Promise(r=>setImmediate(r));
 const history={get state(){return entries[index]},replaceState(s){entries[index]=s},pushState(s){entries.splice(++index);entries.push(s)},go(n){index+=n;queueMicrotask(()=>callback({state:entries[index]}));}};
 createMenuHistory({history,read:()=>ui,closeOne:()=>new Promise((_,r)=>reject=r),listen:fn=>{callback=fn;return()=>{}},onError:()=>reported++});
 history.go(-1);await tick();history.go(-1);await tick();
 reject(new Error('load failed'));await tick();
 assert.equal(ui,2);assert.equal(index,2);assert.equal(reported,1);
});

test('mobile welcome back stays on page without accumulating guard entries',async()=>{
 let ui=0,index=0,callback,exited=false;
 const entries=[{}],tick=()=>new Promise(r=>setImmediate(r));
 const history={get state(){return entries[index]},replaceState(s){entries[index]=s},pushState(s){entries.splice(++index);entries.push(s)},go(n){index+=n;if(index<0){exited=true;return;}queueMicrotask(()=>callback({state:entries[index]}));}};
 const mount=()=>createMenuHistory({history,read:()=>ui,protectRoot:()=>true,closeOne:async()=>{ui--;return true;},listen:fn=>{callback=fn;return()=>{}},onError:e=>{throw e;}});
 let c=mount();assert.equal(index,1);
 for(let i=0;i<6;i++){history.go(-1);await tick();assert.equal(ui,0);assert.equal(index,1);assert.equal(entries.length,2);}
 c.dispose();c=mount();assert.equal(entries.length,2);
 ui=3;c.sync();
 for(const n of [2,1,0]){history.go(-1);await tick();assert.equal(ui,n);}
 history.go(-1);await tick();assert.equal(ui,0);assert.equal(exited,false);assert.equal(index,1);
 c.dispose();
});

function mobileHistory(initialState,initialUI){
 let ui=initialUI,index=0,callback,exited=false,slow=null;
 const entries=[initialState],moves=[];
 const history={get state(){return entries[index]},replaceState(s){entries[index]=s},pushState(s){entries.splice(++index);entries.push(s)},go(n){moves.push(n);queueMicrotask(()=>{index+=n;if(index<0){exited=true;return;}void callback({state:entries[index]});});}};
 const mount=()=>createMenuHistory({history,read:()=>ui,protectRoot:()=>true,closeOne:async()=>{if(slow)await slow;ui--;return true;},listen:fn=>{callback=fn;return()=>{}},onError:e=>{throw e;}});
 const controller=mount(),tick=()=>new Promise(r=>setImmediate(r));
 return {entries,moves,controller,mount,history,tick,get ui(){return ui},get exited(){return exited},get index(){return index},setUI(n){ui=n;controller.sync()},delay(p){slow=p},async back(){history.go(-1);await tick()}};
}

test('mobile migrates old nonzero history after reload before any back gesture',async()=>{
 for(const state of [{cwnMenuDepth:4},{cwnMenuDepth:4,cwnMenuRootGuard:true},{cwnMenuDepth:-1,cwnMenuRootGuard:'fixed-v2'}]){
  const s=mobileHistory(state,3);
  assert.equal(s.moves.length,0);assert.equal(s.index,1);
  for(const n of [2,1,0,0,0]){await s.back();assert.equal(s.ui,n);assert.equal(s.exited,false);}
  assert.equal(s.entries.length,2);
  s.controller.dispose();
 }
});

test('mobile manual worldbook close and rapid back never schedule a bulk traversal',async()=>{
 const s=mobileHistory({},4); // entry, book, shelf, rail
 s.setUI(2); // UI Back twice, without browser Back
 assert.deepEqual(s.moves,[]);
 let resolve;s.delay(new Promise(r=>resolve=r));
 for(let i=0;i<5;i++)await s.back();
 assert.equal(s.exited,false);assert.equal(s.ui,2);
 resolve();await s.tick();await s.tick();
 assert.equal(s.ui,0);assert.equal(s.index,1);assert.equal(s.entries.length,2);
 assert.deepEqual(s.moves,[-1,1,-1,1,-1,1,-1,1,-1,1]);
 await s.back();assert.equal(s.exited,false);assert.equal(s.ui,0);
 s.controller.dispose();
});

test('Chrome UI Back does not skip all entries after the first detail return',async()=>{
 let ui=4,index=0,callback,activated=true,skippable=false,exited=false,pushes=0;
 const entries=[{}],tick=()=>new Promise(r=>setImmediate(r));
 const history={get state(){return entries[index]},replaceState(s){entries[index]=s},pushState(s){if(!activated)skippable=true;pushes++;entries.splice(++index);entries.push(s)},go(n){queueMicrotask(()=>{activated=false;index+=n;if(index<0){exited=true;return;}void callback({state:entries[index]});});}};
 const c=createMenuHistory({history,read:()=>ui,protectRoot:()=>true,closeOne:async()=>{ui--;return true;},listen:fn=>{callback=fn;return()=>{}},onError:e=>{throw e;}});
 const initialPushes=pushes;
 // Browser chrome Back skips script-created history; history.back() tests don't.
 for(const expected of [3,2,1,0,0,0]){
  if(skippable)exited=true;else history.go(-1);
  await tick();
  assert.equal(exited,false);assert.equal(skippable,false);
  assert.equal(ui,expected);assert.equal(index,1);
  assert.equal(pushes,initialPushes,'Back must not create a new history entry');
 }
 c.dispose();
});
