import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual host adapter without importing the browser-only host.
const source=readFileSync(new URL('../src/host.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('  async rerollLastReply(){'),source.indexOf('  async startCharacterChat('));
function setup(chat,{generating=false,saving=false,editing=false,fail=false}={}){
 const calls=[];
 const st={chat,isGenerating:()=>generating,isChatSaving:saving,
  Generate:async type=>{calls.push(['generate',type]);if(fail)throw Error('API failed');},
  swipe:async(...args)=>calls.push(['swipe',...args])};
 const host=vm.runInNewContext(`({${method}})`,{st,document:{querySelector:()=>editing?{}:null},SWIPE_DIRECTION:{RIGHT:'right'}});
 return {run:()=>host.rerollLastReply(),calls};
}
test('retry trailing user message via native regeneration without changing the transcript',async()=>{
 const chat=[{is_user:false,mes:'previous'},{is_user:true,mes:'retry me'}],before=structuredClone(chat);
 const s=setup(chat);await s.run();assert.deepEqual(s.calls,[['generate','regenerate']]);assert.deepEqual(chat,before);
});
test('existing assistant response keeps alternate-reply generation',async()=>{
 const message={is_user:false,mes:'answer',swipes:['answer','other']},s=setup([message]);
 await s.run();assert.equal(s.calls[0][0],'swipe');assert.equal(s.calls[0][3].message,message);assert.equal(s.calls[0][3].forceSwipeId,2);
});
test('generation, saving, editing and missing messages still block retries',async()=>{
 for(const options of [{generating:true},{saving:true},{editing:true}]){
  const s=setup([{is_user:true}],options);await assert.rejects(s.run());assert.equal(s.calls.length,0);
 }
 for(const chat of [[],[{is_system:true}]]){const s=setup(chat);await assert.rejects(s.run());assert.equal(s.calls.length,0);}
});
test('another API failure preserves user message and can be retried again',async()=>{
 const message={is_user:true,mes:'keep me'},chat=[message],s=setup(chat,{fail:true});
 await assert.rejects(s.run(),/API failed/);await assert.rejects(s.run(),/API failed/);
 assert.equal(chat.length,1);assert.equal(chat[0],message);assert.equal(s.calls.length,2);
});
