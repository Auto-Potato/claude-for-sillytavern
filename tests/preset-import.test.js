import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPresetDrop } from '../src/import-zone.js';
import { mountCharacterImport } from '../src/character-import.js';

test('preset drops bypass character import, validate a single JSON, and lock until native import settles', async () => {
    const doc = new EventTarget(), win = new EventTarget();
    let warning = 0, error = 0, imported = 0, native = 0, character = 0, finish;
    Object.assign(win, {AbortController, innerWidth:1280, toastr:{warning(){warning++;},error(){error++;}}});
    const zone = new EventTarget();
    const classes = new Set();
    Object.assign(zone, {
        classList:{remove:name=>classes.delete(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)},
        contains:node=>node===zone, closest:selector=>selector.includes('#cwn-preset-import-zone')?zone:null,
    });
    const charZone = new EventTarget();
    Object.assign(charZone,{classList:{remove(){},toggle(){}},contains:t=>t===charZone,remove(){}});
    doc.createElement=()=>charZone;doc.getElementById=()=>({prepend(){}});
    const disposeCharacter=mountCharacterImport(doc,win,()=>{character++;});
    const dispose=mountPresetDrop(doc,win,zone,async()=>{imported++;await new Promise(resolve=>finish=resolve);});
    doc.addEventListener('drop',()=>native++);
    const send=async(type='drop',files=[{name:'preset.json'}],relatedTarget=null)=>{
        const event=new Event(type,{cancelable:true});
        Object.defineProperties(event,{target:{value:zone},relatedTarget:{value:relatedTarget},dataTransfer:{value:{files,types:['Files']}}});
        doc.dispatchEvent(event);await Promise.resolve();return event;
    };
    await send('dragenter');assert.ok(classes.has('cwn-drag-over'));
    await send('dragleave',[],zone);assert.ok(classes.has('cwn-drag-over'));
    await send('dragleave');assert.equal(classes.size,0);
    await send('drop',[{name:'card.png'}]);await send('drop',[{name:'a.json'},{name:'b.json'}]);
    assert.equal(warning,2);assert.equal(imported,0);
    await send();assert.equal(imported,1);assert.equal(zone.disabled,true);assert.equal(classes.size,0);
    await send();assert.equal(imported,1);assert.equal(character,0);assert.equal(native,0);
    finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(zone.disabled,false);
    win.innerWidth=700;await send();assert.equal(imported,1);
    dispose();disposeCharacter();await send();assert.equal(native,1);assert.equal(error,0);
});

test('failed preset import releases the target and reports failure', async()=>{
    const doc=new EventTarget(),win=new EventTarget(),zone={contains:()=>true,classList:{remove(){},toggle(){}}};
    let errors=0;
    Object.assign(win,{AbortController,innerWidth:1280,toastr:{error(){errors++;}}});
    const dispose=mountPresetDrop(doc,win,zone,async()=>{throw new Error('failure');});
    const event=new Event('drop',{cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{files:[{name:'preset.json'}]}});
    doc.dispatchEvent(event);await new Promise(resolve=>setImmediate(resolve));
    assert.equal(errors,1);assert.equal(zone.disabled,false);dispose();
});
