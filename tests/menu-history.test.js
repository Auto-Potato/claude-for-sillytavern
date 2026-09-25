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
