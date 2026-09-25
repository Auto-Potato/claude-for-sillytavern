import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecentRows } from '../src/recent-chats.js';

test('deleting one character removes only its chats while native lists are rebuilding', () => {
  const a={avatar:'A.png',file_name:'a.jsonl'}, b={avatar:'B.png',file_name:'b.jsonl'};
  const names=[{avatar:'A.png',name:'Alpha'},{avatar:'B.png',name:'Beta'}];
  const resolve=(rows,chars=[])=>resolveRecentRows(rows,chars,[],()=>false);
  assert.equal(resolve([a,b],names).length,2);
  // Server response after deleting A, while resetChatState has cleared all names.
  assert.deepEqual(resolve([b]).map(x=>x.avatar),['B.png']);
  assert.equal(resolve([b],names)[0].name,'Beta');
  assert.equal(resolve([b],[names[1]])[0].name,'Beta');
  assert.deepEqual(resolve([]),[]);
});

test('group recents and pinned state survive temporarily empty client lists', () => {
  const rows=resolveRecentRows([{group:'g1',file_name:'session.jsonl'}],[],[],()=>true);
  assert.equal(rows.length,1);assert.equal(rows[0].pinned,true);assert.equal(rows[0].file,'session');
});
