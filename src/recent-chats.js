// The server has already filtered recent chats against existing character files.
// Native deletion temporarily empties the client character array; it must not
// make valid server rows disappear from the sidebar.
export function resolveRecentRows(rows, characters, groups, isPinned) {
  return rows.flatMap(row => {
    if (typeof row.file_name !== 'string' || (!row.avatar && !row.group)) return [];
    const entity = row.group
      ? groups.find(g => String(g.id) === String(row.group))
      : characters.find(c => c.avatar === row.avatar);
    const file = row.file_name.replace(/\.jsonl$/, '');
    return [{pinned:isPinned({avatar:row.avatar,group:row.group,file}),
      avatar:row.avatar,group:row.group,file,
      name:entity?.name || (row.group ? `群聊 ${row.group}` : row.avatar.replace(/\.png$/i,'')),
      image:row.group ? '/img/five.png' : `/characters/${encodeURIComponent(row.avatar)}`}];
  });
}
