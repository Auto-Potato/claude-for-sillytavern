import test from 'node:test';
import assert from 'node:assert/strict';
import { mountCharacterImport } from '../src/character-import.js';

test('file drops import only inside the desktop zone; cleanup restores host handling', async () => {
  const doc = new EventTarget(), win = new EventTarget();
  Object.assign(win, { AbortController, innerWidth:1280 });
  const zone = new EventTarget();
  Object.assign(zone, { classList:{remove(){},toggle(){}},contains:t=>t===zone,remove(){} });
  doc.createElement = () => zone;
  doc.getElementById = () => ({prepend(){}});
  let imported=0, native=0;
  const dispose = mountCharacterImport(doc, win, async files => { imported+=files.length; });
  doc.addEventListener('drop',()=>native++);
  const drop = async (target,files=[{name:'card.png'}]) => {
    const event = new Event('drop',{cancelable:true});
    Object.defineProperties(event,{target:{value:target},dataTransfer:{value:{files}}});
    doc.dispatchEvent(event);
    await Promise.resolve();
    return event;
  };
  assert.equal((await drop(doc)).defaultPrevented,true);
  assert.equal(imported,0); assert.equal(native,0);
  await drop(zone); assert.equal(imported,1);
  win.innerWidth=700;
  await drop(zone); await drop(doc); assert.equal(imported,1); assert.equal(native,0);
  win.innerWidth=701;
  await drop(zone,[]); assert.equal(imported,1);
  await drop(zone); assert.equal(imported,2);
  dispose(); await drop(doc); assert.equal(native,1);
});
