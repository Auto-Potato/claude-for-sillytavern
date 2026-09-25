import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterData,characterFields} from '../src/character-data.js';
function setup(){
 let card={name:'Test',avatar:'test.png',data:{description:'old',first_mes:'first',alternate_greetings:['second','third'],extensions:{world:'Book',other:{keep:true}}}},busy=false,writes=0;
 const api=createCharacterData({isBusy:()=>busy,refresh:async()=>{},request:async(url,body)=>{
  if(url.endsWith('/get'))return {ok:true,json:async()=>structuredClone(card)};
  writes++;assert.equal(body.avatar,'test.png');card.data={...card.data,...body.data,extensions:{...card.data.extensions,...body.data.extensions}};
  return {ok:true};
 }});
 return {api,card:()=>card,writes:()=>writes,busy:()=>busy=true};
}
test('save description and every greeting without losing unrelated card data',async()=>{
 const x=setup(),base=characterFields(x.card()),draft=structuredClone(base);draft.description='new';draft.openings[1]='edited alternate';
 const result=await x.api.save('test.png',draft,base);
 assert.deepEqual(characterFields(result),draft);assert.deepEqual(result.data.extensions.other,{keep:true});assert.equal(result.data.extensions.world,'Book');
});
test('reject stale edits and block writes during generation',async()=>{
 const x=setup(),base=characterFields(x.card());x.card().data.description='external change';
 await assert.rejects(x.api.save('test.png',base,base),/其他位置/);assert.equal(x.writes(),0);
 x.busy();await assert.rejects(x.api.bind('test.png','Other'),/等待/);assert.equal(x.writes(),0);
});
test('bind and unbind preserve card description, greetings and unrelated extensions',async()=>{
 const x=setup(),base=characterFields(x.card());await x.api.bind('test.png','Other');assert.equal(x.card().data.extensions.world,'Other');await x.api.bind('test.png','');assert.deepEqual(characterFields(x.card()),base);assert.equal(x.card().data.extensions.other.keep,true);
});
