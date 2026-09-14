// Original theme's Chinese welcome phrases and non-repeating session selection.
export function greetingCandidates(who, hour = new Date().getHours()) {
  const timeLine = hour < 5
    ? (who ? `${who}，还没睡？` : '还没睡？')
    : `${hour < 12 ? '早安' : hour < 18 ? '下午好' : '晚上好'}${who ? `，${who}` : ''}`;
  return [
    timeLine,
    who ? `${who}，今天想做点什么？` : '今天想做点什么？',
    who ? `在忙什么呢，${who}？` : '在忙什么呢？',
    '今天 Claude 能帮你做什么？',
    who ? `${who}，最近怎么样？` : '最近怎么样？',
    who ? `从哪里开始，${who}？` : '从哪里开始？',
    who ? `${who}，在想什么？` : '在想什么？',
    who ? `准备好了就开始吧，${who}` : '准备好了就开始吧',
    who ? `今天一起做点什么，${who}？` : '今天一起做点什么？',
    '新的一页。写点什么？',
  ];
}

export function takeGreeting(win, who) {
  const key = 'claude-theme-next.last-greeting';
  const candidates = greetingCandidates(who);
  let last = '';
  try { last = win.sessionStorage.getItem(key) || ''; } catch {}
  const available = candidates.filter(line => line !== last);
  const pool = available.length ? available : candidates;
  const line = pool[Math.floor(Math.random() * pool.length)];
  try { win.sessionStorage.setItem(key, line); } catch {}
  return line;
}
