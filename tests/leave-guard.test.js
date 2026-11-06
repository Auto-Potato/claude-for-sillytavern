import test from 'node:test';
import assert from 'node:assert/strict';
import { unsavedChoice, confirmUnsaved, runLeaveGuard } from '../src/leave-guard.js';

const RESULTS={AFFIRMATIVE:1,NEGATIVE:0,CANCELLED:null,CUSTOM1:1001};

test('unsaved dialog maps save, discard and every dismissal to stay',()=>{
  assert.equal(unsavedChoice(1,RESULTS),'save');
  assert.equal(unsavedChoice(1001,RESULTS),'discard');
  for(const result of [0,null,undefined,2])assert.equal(unsavedChoice(result,RESULTS),'cancel');
});

test('unsaved dialog offers cancel, discard and save on the native popup',async()=>{
  let seen;
  class Popup{constructor(content,type,value,options){seen={content,type,options};this.dlg={classList:{add:cls=>seen.cls=cls}};}show(){return Promise.resolve(RESULTS.CUSTOM1);}}
  const doc={createElement:tag=>({tag,children:[],textContent:'',append(...nodes){this.children.push(...nodes);}})};
  const choice=await confirmUnsaved({Popup,POPUP_TYPE:{CONFIRM:2},POPUP_RESULT:RESULTS,doc,title:'保存修改？',body:'有未保存的修改。'});
  assert.equal(choice,'discard');
  assert.equal(seen.type,2);
  assert.equal(seen.options.okButton,'保存');
  assert.equal(seen.options.cancelButton,'取消');
  assert.deepEqual(seen.options.customButtons.map(b=>[b.text,b.result]),[['不保存',1001]]);
  assert.equal(seen.content.children[0].textContent,'保存修改？');
  assert.equal(seen.cls,'cwn-character-dialog');
});

test('clean pages leave synchronously; pending edits wait for the dialog',async()=>{
  assert.equal(runLeaveGuard(undefined),true);
  assert.equal(runLeaveGuard({prepareLeave:()=>true}),true);
  assert.equal(runLeaveGuard({prepareLeave:()=>false}),false);
  const pending=runLeaveGuard({prepareLeave:()=>Promise.resolve(false)});
  assert.equal(typeof pending.then,'function');
  assert.equal(await pending,false);
  assert.equal(await runLeaveGuard({prepareLeave:()=>Promise.resolve(true)}),true);
  // A failed save keeps the page open instead of leaving with lost edits.
  assert.equal(await runLeaveGuard({prepareLeave:()=>Promise.reject(new Error('save failed'))}),false);
});
