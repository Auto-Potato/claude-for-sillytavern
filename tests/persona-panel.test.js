import test from 'node:test';
import assert from 'node:assert/strict';
import { personaList, initialOf } from '../src/persona-data.js';

test('persona list is sorted by name and marks the active identity',()=>{
  const list=personaList({'b.png':'Kai','a.png':'沐月','c.png':''},{'a.png':{description:'旅人'}},'a.png');
  assert.deepEqual(list.map(p=>p.name),[...list.map(p=>p.name)].sort((a,b)=>a.localeCompare(b,'zh-Hans-CN')));
  assert.equal(list.find(p=>p.current).avatar,'a.png');
  assert.equal(list.find(p=>p.avatar==='a.png').description,'旅人');
  assert.equal(list.find(p=>p.avatar==='c.png').name,'未命名');
  assert.deepEqual(personaList(undefined,undefined,''),[]);
});

test('fallback initial uses the first visible character',()=>{
  assert.equal(initialOf('沐月'),'沐');
  assert.equal(initialOf('  Kai'),'K');
  assert.equal(initialOf(''),'?');
});
