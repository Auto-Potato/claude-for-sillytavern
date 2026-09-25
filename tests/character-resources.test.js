import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=(await readFile(new URL('../src/character-resources.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
function setup(answers=[]){
 const calls=[], enabled=[], store={settings:{script:{enabled:{characters:enabled}}}};
 const element=()=>({append(){},classList:{add(){}},checked:true});
 const doc={createElement:element,createTextNode:x=>x,getElementById:()=>({__vue_app__:{config:{globalProperties:{$pinia:{_s:new Map([['global_settings',store]])}}}}})};
 const context=vm.createContext({Popup:class{dlg=element();async show(){calls.push('prompt');return answers.shift()??0;}},POPUP_TYPE:{CONFIRM:1},POPUP_RESULT:{AFFIRMATIVE:1},renderExtensionTemplateAsync:async()=>element(),updateWorldInfoList:async()=>{},world_names:[],worldInfoCache:new Map(),convertCharacterBook:x=>x,getRequestHeaders:()=>({}),fetch:async()=>{calls.push('world');return{ok:true};},eventSource:{emit:async()=>{}},event_types:{},allowScopedScripts:c=>calls.push('regex:'+c.avatar),isScopedScriptsAllowed:()=>false,RegexProvider:{instance:{clear(){}}}});
 vm.runInContext(source,context);
 return {context,calls,enabled,options:{doc,win:{toastr:{success(){},info(){},warning(){}}},bind:async key=>calls.push('bind:'+key)}};
}
const card={name:'Fixture',avatar:'fixture.png',data:{character_book:{name:'Fixture World',entries:[{}]},extensions:{regex_scripts:[{}],tavern_helper:{scripts:[{}]}}}};
test('resource confirmations are sequential; cancelling every resource writes nothing',async()=>{const s=setup();await s.context.importCharacterResources(card,s.options);assert.deepEqual(s.calls,['prompt','prompt','prompt']);assert.deepEqual(s.enabled,[]);});
test('explicit approvals import and bind only target avatar and allow target resources',async()=>{const s=setup([1,1,1]);await s.context.importCharacterResources(card,s.options);assert.deepEqual(s.calls,['prompt','world','bind:fixture.png','prompt','regex:fixture.png','prompt']);assert.deepEqual(s.enabled,['Fixture']);});
test('declining world import still offers regex and helper scripts',async()=>{const s=setup([0,1,1]);await s.context.importCharacterResources(card,s.options);assert.deepEqual(s.calls,['prompt','prompt','regex:fixture.png','prompt']);});
test('empty cards and legacy helper resources are recognized without selecting a chat',async()=>{const s=setup();await s.context.importCharacterResources({data:{}},s.options);assert.deepEqual(s.calls,[]);assert.equal(s.context.embeddedResources({data:{extensions:{TavernHelper_scripts:[{}]}}}).scripts,true);assert.equal(s.context.embeddedResources({data:{extensions:{tavern_helper:[['scripts',[{}]]]}}}).scripts,true);});
