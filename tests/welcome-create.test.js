import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/host.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export const host =','const host =');
test('welcome creation never loads old chat or emits synthetic native events',async()=>{
 const calls=[];let file='old',id;
 const st={characters:[{avatar:'card.png',name:'Card'}],isGenerating:()=>false,isChatSaving:false,chat:[],event_types:{},eventSource:{on(){},removeListener(){},emit(){throw Error('synthetic native event');}},getCurrentChatId:()=>file,
 unshallowCharacter:async()=>calls.push('hydrate'),clearChat:async()=>calls.push('clear'),setCharacterId:v=>{id=v;st.this_chid=v;},setCharacterName(){},select_selected_character(){},selectCharacterById:async()=>{throw Error('old chat loaded');},doNewChat:async()=>{calls.push('create');file='new'+calls.length;st.chat=[{mes:'opening'}];},setActiveCharacter(){},saveSettingsDebounced(){}};
 const group={resetSelectedGroup(){},selected_group:null};
 const host=new Function('st','group','accountStorage','createChatActions','getChatCompletionModel',source+';return host;')(st,group,{},()=>({}),()=>null);
 let refresh=0;const off=host.subscribe(()=>refresh++);
 await host.startCharacterChat('card.png');await host.startCharacterChat('card.png');
 assert.deepEqual(calls,['hydrate','clear','create','hydrate','clear','create']);assert.equal(id,0);assert.equal(refresh,2);assert.equal(host.isHome(),false);
 off();await host.startCharacterChat('card.png');assert.equal(refresh,2);
});
