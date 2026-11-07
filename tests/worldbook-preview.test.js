import test from 'node:test';
import assert from 'node:assert/strict';
import { entryPreview } from '../src/worldbook-preview.js';

test('large entry previews are bounded without cutting emoji or changing full content',()=>{
  const content='😀'.repeat(100)+'正文后半部分的搜索关键词';
  assert.equal(entryPreview(content),'😀'.repeat(100)+'…');
  assert.ok(content.includes('搜索关键词'));
  assert.equal(entryPreview('短正文'),'短正文');
  assert.equal(entryPreview('字'.repeat(100)),'字'.repeat(100));
  assert.equal(entryPreview(''),'暂无内容');
});
