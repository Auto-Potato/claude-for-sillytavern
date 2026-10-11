export const characterSortOptions = [
  {value:'imported',label:'导入时间',summary:'最新导入',description:'由新到旧'},
  {value:'name',label:'名称排序',summary:'名称排序',description:'按拼音 / A–Z'},
  {value:'recent',label:'最近使用',summary:'最近使用',description:'按最后聊天时间排序'},
];

export const normalizeCharacterSort = value => characterSortOptions.some(option=>option.value===value)?value:'imported';
const collator = new Intl.Collator('zh-CN', {numeric:true,sensitivity:'base'});
function timestamp(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(value);
  const time = Number.isFinite(number) ? number : Date.parse(value);
  return Number.isFinite(time) && time > 0 ? time : 0;
}
// ST stamps create_date on import and preserves it on edit. date_added is a
// filesystem timestamp, so only use it for older cards without create_date.
const importedAt = card => timestamp(card.create_date) || timestamp(card.date_added);
export function sortCharacters(characters, mode='imported') {
  mode=normalizeCharacterSort(mode);
  return [...characters].sort((a,b)=>{
    const name=()=>collator.compare(a.name||'',b.name||'');
    const primary=mode==='name'?name():mode==='recent'
      ?timestamp(b.date_last_chat)-timestamp(a.date_last_chat)
      :importedAt(b)-importedAt(a);
    return primary || (mode==='recent'?importedAt(b)-importedAt(a):0)
      || name() || collator.compare(a.avatar||'',b.avatar||'');
  });
}
