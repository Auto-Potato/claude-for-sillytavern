const KEY='claude-theme-next.appearance';
const MODES=['light','dark','system'];

export function mountAppearance(doc,win) {
  const root=doc.documentElement,previous=root.getAttribute('data-cwn-theme');
  const abort=new win.AbortController(),media=win.matchMedia('(prefers-color-scheme: dark)');
  let mode='light';
  try{const saved=win.localStorage.getItem(KEY);if(MODES.includes(saved))mode=saved;}catch{}
  function render(){root.setAttribute('data-cwn-theme',mode==='system'?(media.matches?'dark':'light'):mode);}
  win.addEventListener('storage',event=>{if(event.key===KEY&&MODES.includes(event.newValue)){mode=event.newValue;render();}},{signal:abort.signal});
  doc.addEventListener('cwn-appearance-change',event=>{if(MODES.includes(event.detail)){mode=event.detail;try{win.localStorage.setItem(KEY,mode);}catch{}render();}},{signal:abort.signal});
  media.addEventListener('change',()=>{if(mode==='system')render();},{signal:abort.signal});
  render();
  return ()=>{abort.abort();if(previous===null)root.removeAttribute('data-cwn-theme');else root.setAttribute('data-cwn-theme',previous);};
}
