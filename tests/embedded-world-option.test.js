import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEmbeddedWorldOption, persistWorldBinding } from '../src/embedded-world-option.js';

test('embedded lore binding choice persists both choices without relying on the native bind event', async () => {
  let checked=true, result=1, imported=0, errors=0;
  let current={avatar:'a.png',name:'A',data:{character_book:{name:'A lore'}}};
  const doc={createElement:()=>({append(...children){this.children=children;},remove(){}})};
  class Popup {
    constructor(text='This character has an embedded World/Lorebook. Would you like to import it now?') {
      this.type=1; this.content={textContent:text,append:label=>{this.label=label;}};
    }
    async show(){if(this.label)this.label.children[0].checked=checked;return result;}
  }
  const original=Popup.prototype.show;
  const dispose=mountEmbeddedWorldOption({Popup,confirmType:1,affirmative:1,doc,getCharacter:()=>current,importWorld:async (card,bind)=>{assert.equal(card.avatar,'a.png');assert.equal(bind,checked);imported++;},onError:()=>errors++});
  assert.equal(await new Popup().show(),0); assert.equal(imported,1);
  checked=false; assert.equal(await new Popup().show(),0); assert.equal(imported,2);
  result=0; assert.equal(await new Popup().show(),0); assert.equal(imported,2);
  result=1; assert.equal(await new Popup('Import scripts?').show(),1); assert.equal(imported,2);
  checked=true;
  const pending=new Popup().show();current={...current,avatar:'b.png'};
  assert.equal(await pending,0);assert.equal(errors,1);
  dispose();assert.equal(Popup.prototype.show,original);
});

test('binding writes only the selected avatar world and verifies persisted server state', async () => {
 const calls=[];
 const request=async(url,body)=>{calls.push({url,body});return {ok:true,json:async()=>({data:{extensions:{world:'Lore'}}})};};
 await persistWorldBinding(request,'a.png','Lore');
 assert.deepEqual(calls[0].body,{avatar:'a.png',data:{extensions:{world:'Lore'}}});
 assert.deepEqual(calls[1].body,{avatar_url:'a.png'});
 await assert.rejects(persistWorldBinding(async()=>({ok:true,json:async()=>({data:{extensions:{world:''}}})}),'a.png','Lore'),/not persisted/);
 await assert.rejects(persistWorldBinding(async()=>({ok:false,status:500}),'a.png','Lore'),/binding failed/);
});
