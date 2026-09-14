import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChatActions} from '../src/chat-actions.js';
function fixture(){
 const files=new Set(['old','duplicate']);const values=new Map();const events=new Map();let closed=0,fail=false;
 const row={avatar:'a.png',file:'old'};
 const st={characters:[{avatar:'a.png'}],this_chid:0,isGenerating:()=>false,isChatSaving:false,getCurrentChatId:()=> 'old',getRequestHeaders:()=>({}),event_types:{CHAT_DELETED:'deleted'},eventSource:{on:(k,f)=>events.set(k,f),removeListener:k=>events.delete(k)},renameGroupOrCharacterChat:async({oldFileName,newFileName})=>{if(!fail){files.delete(oldFileName);files.add(newFileName);}},deleteCharacterChatByName:async(id,file)=>{if(!fail){files.delete(file);events.get('deleted')?.(file);}},closeCurrentChat:async()=>{closed++;}};
 const actions=createChatActions(st,{groups:[],selected_group:null},{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},async()=>({ok:true,json:async()=>[...files].map(file=>({avatar:'a.png',file_name:file+'.jsonl'}))}));
 return {actions,row,st,files,events,values,get closed(){return closed;},set fail(v){fail=v;}};
}
test('pin toggles, persists and follows rename',async()=>{const f=fixture();await f.actions.pin(f.row);assert.equal(f.actions.isPinned(f.row),true);await f.actions.rename(f.row,'new');assert.equal(f.actions.isPinned({...f.row,file:'new'}),true);assert.equal(f.actions.isPinned(f.row),false);await f.actions.pin({...f.row,file:'new'});assert.equal(f.actions.pins().size,0);});
test('invalid and duplicate names preserve chat',async()=>{const f=fixture();for(const name of ['','../x','duplicate'])await assert.rejects(f.actions.rename(f.row,name));assert(f.files.has('old'));});
test('native silent failure is reported',async()=>{const f=fixture();f.fail=true;await assert.rejects(f.actions.rename(f.row,'new'));await assert.rejects(f.actions.remove(f.row));assert.equal(f.closed,0);assert.equal(f.events.size,0);});
test('delete current exits and removes pin',async()=>{const f=fixture();await f.actions.pin(f.row);await f.actions.remove(f.row);assert(!f.files.has('old'));assert.equal(f.closed,1);assert.equal(f.actions.pins().size,0);assert.equal(f.events.size,0);});
test('generation blocks all mutations',async()=>{const f=fixture();f.st.isGenerating=()=>true;await assert.rejects(f.actions.pin(f.row));await assert.rejects(f.actions.rename(f.row,'new'));await assert.rejects(f.actions.remove(f.row));assert(f.files.has('old'));});
