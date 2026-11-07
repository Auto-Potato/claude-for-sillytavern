// Bound the DOM text, not the source content used by search and editing.
export function entryPreview(content) {
  if(!content)return '暂无内容';
  let preview='',count=0;
  for(const char of content){
    if(count++===100)return preview+'…';
    preview+=char;
  }
  return preview;
}
