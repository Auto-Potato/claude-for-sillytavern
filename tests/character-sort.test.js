import test from 'node:test';
import assert from 'node:assert/strict';
import {sortCharacters,normalizeCharacterSort} from '../src/character-sort.js';

test('imports sort newest first without reordering host character IDs; editing an old card does not promote it',()=>{
  const rows=[{avatar:'old.png',create_date:'2025-01-01',date_added:Date.parse('2026-01-01')},{avatar:'new.png',create_date:'2025-06-01'}];
  assert.deepEqual(sortCharacters(rows).map(c=>c.avatar),['new.png','old.png']);
  assert.equal(rows[0].avatar,'old.png');
});
test('recent use follows last chat time, not import time; never chatted cards follow',()=>{
  const rows=[{name:'new',create_date:300},{name:'older chat',date_last_chat:100},{name:'latest chat',date_last_chat:200}];
  assert.deepEqual(sortCharacters(rows,'recent').map(c=>c.name),['latest chat','older chat','new']);
});
test('names use Chinese pinyin and natural numeric order',()=>{
  const rows=['张三','李四','阿明','Alice10','Alice2'].map(name=>({name}));
  assert.deepEqual(sortCharacters(rows,'name').map(c=>c.name),['阿明','李四','张三','Alice2','Alice10']);
});
test('legacy dates, missing dates and invalid preference have deterministic fallbacks',()=>{
  const rows=[{avatar:'z',create_date:'invalid'},{avatar:'b',date_added:200},{avatar:'a',create_date:100},{avatar:'y'}];
  assert.equal(normalizeCharacterSort('unknown'),'imported');
  assert.deepEqual(sortCharacters(rows,'unknown').map(c=>c.avatar),['b','a','y','z']);
});
